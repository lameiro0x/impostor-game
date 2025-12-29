const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];
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
  return {
    code: room.code,
    hostId: room.hostId,
    players: Array.from(room.players, ([id, name]) => ({ id, name })),
  };
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
    room.players.set(socket.id, name);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.name = name;
    const snapshot = roomSnapshot(room);
    reply({ ok: true, room: snapshot, isHost: false });
    io.to(code).emit("room_update", snapshot);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) {
      return;
    }

    const room = rooms.get(code);
    room.players.delete(socket.id);

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
