const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const players = new Map();

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  const spawn = {
    id: socket.id,
    x: (Math.random() - 0.5) * 50,
    y: 0,
    z: (Math.random() - 0.5) * 50,
    rotY: 0,
    color: '#d7dde2',
    nameTag: `Pilot-${socket.id.slice(0, 4)}`
  };

  players.set(socket.id, spawn);

  socket.emit('bootstrap', {
    selfId: socket.id,
    players: Array.from(players.values())
  });

  socket.broadcast.emit('player:join', spawn);

  socket.on('player:update', (payload) => {
    const existing = players.get(socket.id);
    if (!existing) return;

    const updated = {
      ...existing,
      x: Number.isFinite(payload.x) ? payload.x : existing.x,
      y: Number.isFinite(payload.y) ? payload.y : existing.y,
      z: Number.isFinite(payload.z) ? payload.z : existing.z,
      rotY: Number.isFinite(payload.rotY) ? payload.rotY : existing.rotY,
      color: typeof payload.color === 'string' ? payload.color.slice(0, 7) : existing.color,
      nameTag: typeof payload.nameTag === 'string' ? payload.nameTag.slice(0, 20) : existing.nameTag
    };

    players.set(socket.id, updated);
    socket.broadcast.emit('player:update', updated);
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    io.emit('player:leave', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Frutiger Aero MMO running on http://localhost:${PORT}`);
});
