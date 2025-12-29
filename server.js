const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const wordsPath = path.join(__dirname, "data", "words.json");
let WORDS = {};
try {
  WORDS = JSON.parse(fs.readFileSync(wordsPath, "utf8"));
} catch (err) {
  WORDS = {};
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];
  if (urlPath.startsWith("/socket.io")) {
    return;
  }
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(__dirname, safePath);

  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    }[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.end(data);
  });
});

const io = new Server(server, {
  cors: { origin: "*" },
});

const rooms = new Map();

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 5; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function roomSnapshot(room) {
  const game = room.game
    ? {
      started: room.game.started,
      finished: room.game.finished,
      currentRound: room.game.currentRound,
      totalRounds: room.game.totalRounds,
      impostors: room.game.impostors,
      theme: room.game.theme,
    }
    : null;
  return {
    code: room.code,
    hostId: room.hostId,
    players: Array.from(room.players, ([id, name]) => ({ id, name })),
    game,
  };
}

function getWordList(theme, lang) {
  if (!theme || !WORDS[theme] || !WORDS[theme].words) {
    return null;
  }
  return WORDS[theme].words[lang]
    || WORDS[theme].words.es
    || WORDS[theme].words.en;
}

function assignRoles(room) {
  const playerIds = Array.from(room.players.keys());
  const wordList = getWordList(room.game.theme, room.game.lang);
  if (!Array.isArray(wordList) || wordList.length === 0) {
    return null;
  }
  const word = wordList[Math.floor(Math.random() * wordList.length)];
  const roles = playerIds.map(() => word);
  let assigned = 0;
  while (assigned < room.game.impostors) {
    const idx = Math.floor(Math.random() * playerIds.length);
    if (roles[idx] !== "IMPOSTOR") {
      roles[idx] = "IMPOSTOR";
      assigned += 1;
    }
  }
  room.roles = new Map();
  roles.forEach((role, index) => {
    room.roles.set(playerIds[index], role);
  });
  room.game.word = word;
  return { playerIds, roles };
}

io.on("connection", socket => {
  socket.on("create_room", (payload = {}, cb) => {
    const reply = typeof cb === "function" ? cb : () => {};
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) {
      reply({ ok: false, error: "name_required" });
      return;
    }

    const code = generateCode();
    const room = {
      code,
      hostId: socket.id,
      players: new Map(),
      game: null,
      roles: new Map(),
    };
    room.players.set(socket.id, name);
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.name = name;
    const snapshot = roomSnapshot(room);
    reply({ ok: true, room: snapshot, isHost: true });
    io.to(code).emit("room_update", snapshot);
  });

  socket.on("join_room", (payload = {}, cb) => {
    const reply = typeof cb === "function" ? cb : () => {};
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
    if (!name) {
      reply({ ok: false, error: "name_required" });
      return;
    }
    if (!code || !rooms.has(code)) {
      reply({ ok: false, error: "not_found" });
      return;
    }

    const room = rooms.get(code);
    if (room.game && room.game.started && !room.game.finished) {
      reply({ ok: false, error: "in_progress" });
      return;
    }
    room.players.set(socket.id, name);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.name = name;
    const snapshot = roomSnapshot(room);
    reply({ ok: true, room: snapshot, isHost: false });
    io.to(code).emit("room_update", snapshot);
  });

  socket.on("reconnect_room", (payload = {}, cb) => {
    const reply = typeof cb === "function" ? cb : () => {};
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
    if (!name) {
      reply({ ok: false, error: "name_required" });
      return;
    }
    if (!code || !rooms.has(code)) {
      reply({ ok: false, error: "not_found" });
      return;
    }

    const room = rooms.get(code);
    let previousId = null;
    room.players.forEach((playerName, id) => {
      if (playerName === name && !previousId) {
        previousId = id;
      }
    });

    const wasHost = previousId && room.hostId === previousId;
    if (previousId) {
      room.players.delete(previousId);
      if (room.roles) {
        room.roles.delete(previousId);
      }
    }

    room.players.set(socket.id, name);
    if (wasHost) {
      room.hostId = socket.id;
    }
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.name = name;

    const snapshot = roomSnapshot(room);
    reply({ ok: true, room: snapshot, isHost: room.hostId === socket.id });
    io.to(code).emit("room_update", snapshot);

    if (room.game && room.game.started && !room.game.finished) {
      const playerIds = Array.from(room.players.keys());
      const playerIndex = playerIds.indexOf(socket.id);
      let impostorCount = 0;
      if (room.roles) {
        room.roles.forEach(role => {
          if (role === "IMPOSTOR") {
            impostorCount += 1;
          }
        });
      } else {
        room.roles = new Map();
      }
      const role = impostorCount < room.game.impostors ? "IMPOSTOR" : room.game.word;
      room.roles.set(socket.id, role);
      io.to(socket.id).emit("private_role", {
        role,
        playerIndex,
        round: room.game.currentRound,
        totalRounds: room.game.totalRounds,
        impostors: room.game.impostors,
      });
    }
  });

  socket.on("start_game", (payload = {}, cb) => {
    const reply = typeof cb === "function" ? cb : () => {};
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) {
      reply({ ok: false, error: "not_found" });
      return;
    }

    const room = rooms.get(code);
    if (room.hostId !== socket.id) {
      reply({ ok: false, error: "not_host" });
      return;
    }
    if (room.game && room.game.started) {
      reply({ ok: false, error: "in_progress" });
      return;
    }

    const impostors = parseInt(payload.impostors, 10);
    const totalRounds = parseInt(payload.totalRounds, 10);
    const theme = typeof payload.theme === "string" ? payload.theme : "";
    const lang = typeof payload.lang === "string" ? payload.lang : "es";
    const playerIds = Array.from(room.players.keys());
    if (playerIds.length < 3 || !Number.isFinite(impostors) || !Number.isFinite(totalRounds)) {
      reply({ ok: false, error: "invalid_settings" });
      return;
    }
    if (impostors < 1 || impostors >= playerIds.length || totalRounds < 1) {
      reply({ ok: false, error: "invalid_settings" });
      return;
    }
    if (!WORDS[theme] || !WORDS[theme].words) {
      reply({ ok: false, error: "invalid_theme" });
      return;
    }
    const wordList = WORDS[theme].words[lang]
      || WORDS[theme].words.es
      || WORDS[theme].words.en;
    if (!Array.isArray(wordList) || wordList.length === 0) {
      reply({ ok: false, error: "invalid_theme" });
      return;
    }

    room.game = {
      started: true,
      finished: false,
      currentRound: 1,
      totalRounds,
      impostors,
      theme,
      lang,
    };
    const assigned = assignRoles(room);
    if (!assigned) {
      reply({ ok: false, error: "invalid_theme" });
      return;
    }

    const snapshot = roomSnapshot(room);
    reply({ ok: true, room: snapshot });
    io.to(code).emit("game_started", {
      code: room.code,
      hostId: room.hostId,
      players: snapshot.players,
      game: snapshot.game,
    });
    io.to(code).emit("room_update", snapshot);
    assigned.playerIds.forEach((id, index) => {
      io.to(id).emit("private_role", {
        role: assigned.roles[index],
        playerIndex: index,
        round: room.game.currentRound,
        totalRounds: room.game.totalRounds,
        impostors: room.game.impostors,
      });
    });
  });

  socket.on("next_round", (payload = {}, cb) => {
    const reply = typeof cb === "function" ? cb : () => {};
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) {
      reply({ ok: false, error: "not_found" });
      return;
    }

    const room = rooms.get(code);
    if (room.hostId !== socket.id) {
      reply({ ok: false, error: "not_host" });
      return;
    }
    if (!room.game || !room.game.started || room.game.finished) {
      reply({ ok: false, error: "not_started" });
      return;
    }
    if (room.game.currentRound >= room.game.totalRounds) {
      reply({ ok: false, error: "complete" });
      return;
    }

    const playerIds = Array.from(room.players.keys());
    if (playerIds.length < 3 || room.game.impostors < 1 || room.game.impostors >= playerIds.length) {
      reply({ ok: false, error: "invalid_settings" });
      return;
    }

    room.game.currentRound += 1;
    const assigned = assignRoles(room);
    if (!assigned) {
      reply({ ok: false, error: "invalid_theme" });
      return;
    }

    const snapshot = roomSnapshot(room);
    reply({ ok: true, room: snapshot });
    io.to(code).emit("round_started", {
      code: room.code,
      hostId: room.hostId,
      players: snapshot.players,
      game: snapshot.game,
    });
    io.to(code).emit("room_update", snapshot);
    assigned.playerIds.forEach((id, index) => {
      io.to(id).emit("private_role", {
        role: assigned.roles[index],
        playerIndex: index,
        round: room.game.currentRound,
        totalRounds: room.game.totalRounds,
        impostors: room.game.impostors,
      });
    });
  });

  socket.on("end_game", (payload = {}, cb) => {
    const reply = typeof cb === "function" ? cb : () => {};
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) {
      reply({ ok: false, error: "not_found" });
      return;
    }

    const room = rooms.get(code);
    if (room.hostId !== socket.id) {
      reply({ ok: false, error: "not_host" });
      return;
    }
    if (!room.game || !room.game.started) {
      reply({ ok: false, error: "not_started" });
      return;
    }

    room.game.started = false;
    room.game.finished = true;
    room.roles = new Map();

    const snapshot = roomSnapshot(room);
    reply({ ok: true, room: snapshot });
    io.to(code).emit("game_ended", {
      code: room.code,
      hostId: room.hostId,
      players: snapshot.players,
      game: snapshot.game,
    });
    io.to(code).emit("room_update", snapshot);
  });

  socket.on("restart_game", (payload = {}, cb) => {
    const reply = typeof cb === "function" ? cb : () => {};
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) {
      reply({ ok: false, error: "not_found" });
      return;
    }

    const room = rooms.get(code);
    if (room.hostId !== socket.id) {
      reply({ ok: false, error: "not_host" });
      return;
    }
    if (!room.game) {
      reply({ ok: false, error: "not_started" });
      return;
    }

    const playerIds = Array.from(room.players.keys());
    if (playerIds.length < 3 || room.game.impostors < 1 || room.game.impostors >= playerIds.length) {
      reply({ ok: false, error: "invalid_settings" });
      return;
    }

    room.game.started = true;
    room.game.finished = false;
    room.game.currentRound = 1;
    const assigned = assignRoles(room);
    if (!assigned) {
      reply({ ok: false, error: "invalid_theme" });
      return;
    }

    const snapshot = roomSnapshot(room);
    reply({ ok: true, room: snapshot });
    io.to(code).emit("game_restarted", {
      code: room.code,
      hostId: room.hostId,
      players: snapshot.players,
      game: snapshot.game,
    });
    io.to(code).emit("room_update", snapshot);
    assigned.playerIds.forEach((id, index) => {
      io.to(id).emit("private_role", {
        role: assigned.roles[index],
        playerIndex: index,
        round: room.game.currentRound,
        totalRounds: room.game.totalRounds,
        impostors: room.game.impostors,
      });
    });
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) {
      return;
    }

    const room = rooms.get(code);
    room.players.delete(socket.id);
    if (room.roles) {
      room.roles.delete(socket.id);
    }

    if (room.players.size === 0) {
      rooms.delete(code);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players.keys().next().value;
    }

    io.to(code).emit("room_update", roomSnapshot(room));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
