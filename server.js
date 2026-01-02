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
const ROUND_COUNTDOWN_SECONDS = 3;
const THEME_HINTS = {
  all: { es: "mezcla", en: "mixed" },
  food: { es: "comida", en: "food" },
  places: { es: "lugar", en: "place" },
  animals: { es: "animal", en: "animal" },
  movies_series: { es: "cine", en: "movie" },
  sports: { es: "deporte", en: "sport" },
  professions: { es: "oficio", en: "job" },
  everyday_objects: { es: "objeto", en: "object" },
  transport: { es: "transporte", en: "transport" },
  actions_verbs: { es: "acción", en: "action" },
  hobbies: { es: "ocio", en: "hobby" },
  footballers: { es: "futbolista", en: "footballer" },
};
const CUSTOM_HINTS = { es: "Personalizado", en: "Custom" };

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
      hintMode: room.game.hintMode,
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

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase();
}

function getThemeHint(themeKey, lang) {
  const theme = WORDS && WORDS[themeKey];
  const hint = (theme && theme.hint) || THEME_HINTS[themeKey];
  if (!hint) {
    return "";
  }
  if (theme && !theme.hint) {
    theme.hint = hint;
  }
  return hint[lang] || hint.es || hint.en || "";
}

function generateHintWord(secretWord, themeKey, lang) {
  const normalized = normalizeWord(secretWord);
  if (!normalized) {
    return "";
  }
  if (themeKey === "custom") {
    return CUSTOM_HINTS[lang] || CUSTOM_HINTS.es || "";
  }
  const theme = WORDS && WORDS[themeKey];
  if (!theme || !theme.words) {
    return "";
  }
  if (!theme.hintMap) {
    theme.hintMap = {};
  }
  if (!theme.hintMap[lang]) {
    const words = theme.words[lang] || theme.words.es || theme.words.en || [];
    const hintValue = getThemeHint(themeKey, lang);
    const map = {};
    if (Array.isArray(words)) {
      words.forEach(word => {
        const key = normalizeWord(word);
        if (key && !map[key]) {
          map[key] = hintValue;
        }
      });
    }
    theme.hintMap[lang] = map;
  }
  return theme.hintMap[lang][normalized] || getThemeHint(themeKey, lang);
}

function assignRoles(room) {
  const playerIds = Array.from(room.players.keys());
  room.discoveredImpostors = new Set();
  room.selectionActive = false;
  const customWords = Array.isArray(room.game.customWords) ? room.game.customWords : [];
  let wordList = null;
  if (room.game.theme === "custom") {
    if (customWords.length < 3) {
      return null;
    }
    wordList = customWords;
  } else {
    wordList = getWordList(room.game.theme, room.game.lang);
    if (!Array.isArray(wordList) || wordList.length === 0) {
      return null;
    }
  }
  const word = wordList[Math.floor(Math.random() * wordList.length)];
  room.game.hintWord = room.game.hintMode
    ? generateHintWord(word, room.game.theme, room.game.lang)
    : "";
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

function getRemainingImpostors(room) {
  if (!room || !room.game) {
    return 0;
  }
  const found = room.discoveredImpostors ? room.discoveredImpostors.size : 0;
  return Math.max(room.game.impostors - found, 0);
}

function getRoomHintWord(room) {
  if (!room || !room.game || !room.game.hintMode) {
    return "";
  }
  if (room.game.hintWord) {
    return room.game.hintWord;
  }
  room.game.hintWord = generateHintWord(room.game.word, room.game.theme, room.game.lang);
  return room.game.hintWord;
}

function normalizeCustomWords(input) {
  let list = [];
  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === "string") {
    list = input.split("\n");
  } else {
    return [];
  }
  const seen = new Set();
  return list
    .map(word => (typeof word === "string" ? word.trim() : ""))
    .filter(word => {
      if (!word || seen.has(word)) {
        return false;
      }
      seen.add(word);
      return true;
    });
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
      discoveredImpostors: new Set(),
      selectionActive: false,
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
      const hintWord = role === "IMPOSTOR" ? getRoomHintWord(room) : "";
      io.to(socket.id).emit("private_role", {
        role,
        playerIndex,
        round: room.game.currentRound,
        totalRounds: room.game.totalRounds,
        impostors: room.game.impostors,
        hint: hintWord,
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
    if (room.countdown) {
      reply({ ok: false, error: "countdown" });
      return;
    }

    const impostors = parseInt(payload.impostors, 10);
    const totalRounds = parseInt(payload.totalRounds, 10);
    const theme = typeof payload.theme === "string" ? payload.theme : "";
    const isCustomTheme = theme === "custom";
    const lang = typeof payload.lang === "string" ? payload.lang : "es";
    const hintMode = Boolean(payload.hintMode);
    const customWords = normalizeCustomWords(payload.customWords);
    const useCustomWords = isCustomTheme ? customWords : [];
    const playerIds = Array.from(room.players.keys());
    if (playerIds.length < 3 || !Number.isFinite(impostors) || !Number.isFinite(totalRounds)) {
      reply({ ok: false, error: "invalid_settings" });
      return;
    }
    if (impostors < 1 || impostors >= playerIds.length || totalRounds < 1) {
      reply({ ok: false, error: "invalid_settings" });
      return;
    }
    if (!isCustomTheme && (!WORDS[theme] || !WORDS[theme].words)) {
      reply({ ok: false, error: "invalid_theme" });
      return;
    }
    let wordList = null;
    if (isCustomTheme) {
      if (useCustomWords.length < 3) {
        reply({ ok: false, error: "invalid_settings" });
        return;
      }
      wordList = useCustomWords;
    } else {
      wordList = WORDS[theme].words[lang]
        || WORDS[theme].words.es
        || WORDS[theme].words.en;
    }
    if (!Array.isArray(wordList) || wordList.length === 0) {
      reply({ ok: false, error: "invalid_theme" });
      return;
    }

    room.pendingGame = {
      impostors,
      totalRounds,
      theme,
      lang,
      customWords: useCustomWords,
      hintMode,
    };

    const countdownSeconds = ROUND_COUNTDOWN_SECONDS;
    room.countdown = setTimeout(() => {
      const activeRoom = rooms.get(code);
      if (!activeRoom || !activeRoom.pendingGame) {
        if (activeRoom) {
          activeRoom.countdown = null;
        }
        return;
      }
      const pending = activeRoom.pendingGame;
      activeRoom.pendingGame = null;
      activeRoom.game = {
        started: true,
        finished: false,
        currentRound: 1,
        totalRounds: pending.totalRounds,
        impostors: pending.impostors,
        theme: pending.theme,
        lang: pending.lang,
        customWords: pending.customWords,
        hintMode: pending.hintMode,
      };
      const assigned = assignRoles(activeRoom);
      if (!assigned) {
        activeRoom.game.started = false;
        activeRoom.game.finished = false;
        activeRoom.countdown = null;
        return;
      }

      const snapshot = roomSnapshot(activeRoom);
      io.to(code).emit("game_started", {
        code: activeRoom.code,
        hostId: activeRoom.hostId,
        players: snapshot.players,
        game: snapshot.game,
      });
      io.to(code).emit("room_update", snapshot);
      assigned.playerIds.forEach((id, index) => {
        const role = assigned.roles[index];
        const hintWord = role === "IMPOSTOR" ? getRoomHintWord(activeRoom) : "";
        io.to(id).emit("private_role", {
          role,
          playerIndex: index,
          round: activeRoom.game.currentRound,
          totalRounds: activeRoom.game.totalRounds,
          impostors: activeRoom.game.impostors,
          hint: hintWord,
        });
      });
      activeRoom.countdown = null;
    }, countdownSeconds * 1000);

    io.to(code).emit("game_start_countdown", {
      seconds: countdownSeconds,
    });
    reply({ ok: true });
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
    if (getRemainingImpostors(room) > 0) {
      reply({ ok: false, error: "impostors_remaining" });
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

    if (room.countdown) {
      reply({ ok: false, error: "countdown" });
      return;
    }

    const nextRound = room.game.currentRound + 1;
    const countdownSeconds = ROUND_COUNTDOWN_SECONDS;
    room.countdown = setTimeout(() => {
      const activeRoom = rooms.get(code);
      if (!activeRoom || !activeRoom.game || !activeRoom.game.started || activeRoom.game.finished) {
        if (activeRoom) {
          activeRoom.countdown = null;
        }
        return;
      }
      if (activeRoom.game.currentRound >= activeRoom.game.totalRounds) {
        activeRoom.countdown = null;
        return;
      }

      activeRoom.game.currentRound = nextRound;
      const assigned = assignRoles(activeRoom);
      if (!assigned) {
        activeRoom.countdown = null;
        return;
      }

      const snapshot = roomSnapshot(activeRoom);
      io.to(code).emit("round_started", {
        code: activeRoom.code,
        hostId: activeRoom.hostId,
        players: snapshot.players,
        game: snapshot.game,
      });
      io.to(code).emit("room_update", snapshot);
      assigned.playerIds.forEach((id, index) => {
        const role = assigned.roles[index];
        const hintWord = role === "IMPOSTOR" ? getRoomHintWord(activeRoom) : "";
        io.to(id).emit("private_role", {
          role,
          playerIndex: index,
          round: activeRoom.game.currentRound,
          totalRounds: activeRoom.game.totalRounds,
          impostors: activeRoom.game.impostors,
          hint: hintWord,
        });
      });
      activeRoom.countdown = null;
    }, countdownSeconds * 1000);

    io.to(code).emit("round_countdown", {
      seconds: countdownSeconds,
      round: nextRound,
    });
    reply({ ok: true });
  });

  socket.on("start_impostor_selection", (payload = {}, cb) => {
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
    if (room.selectionActive) {
      reply({ ok: false, error: "selection_active" });
      return;
    }

    const remaining = getRemainingImpostors(room);
    if (remaining === 0) {
      reply({ ok: false, error: "complete" });
      return;
    }
    room.selectionActive = true;
    io.to(code).emit("impostor_selection_started", {
      round: room.game.currentRound,
      remaining,
    });
    reply({ ok: true });
  });

  socket.on("submit_impostor_selection", (payload = {}, cb) => {
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
    if (!room.selectionActive) {
      reply({ ok: false, error: "selection_inactive" });
      return;
    }

    const playerId = typeof payload.playerId === "string" ? payload.playerId : "";
    if (!playerId || !room.players.has(playerId)) {
      reply({ ok: false, error: "invalid_player" });
      return;
    }
    const role = room.roles ? room.roles.get(playerId) : null;
    const correct = role === "IMPOSTOR";
    if (correct) {
      if (!room.discoveredImpostors) {
        room.discoveredImpostors = new Set();
      }
      room.discoveredImpostors.add(playerId);
    }
    const remaining = getRemainingImpostors(room);
    if (remaining === 0) {
      room.selectionActive = false;
    }

    io.to(code).emit("impostor_selection_result", {
      playerId,
      playerName: room.players.get(playerId),
      correct,
      remaining,
    });
    reply({ ok: true });
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
    if (getRemainingImpostors(room) > 0) {
      reply({ ok: false, error: "impostors_remaining" });
      return;
    }

    if (room.countdown) {
      clearTimeout(room.countdown);
      room.countdown = null;
    }

    room.game.started = false;
    room.game.finished = true;
    room.roles = new Map();
    room.discoveredImpostors = new Set();
    room.selectionActive = false;

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

    if (room.countdown) {
      clearTimeout(room.countdown);
      room.countdown = null;
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
      const role = assigned.roles[index];
      const hintWord = role === "IMPOSTOR" ? getRoomHintWord(room) : "";
      io.to(id).emit("private_role", {
        role,
        playerIndex: index,
        round: room.game.currentRound,
        totalRounds: room.game.totalRounds,
        impostors: room.game.impostors,
        hint: hintWord,
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
