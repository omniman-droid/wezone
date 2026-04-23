const path = require('path');
const express = require('express');
const { joinPlayer, updatePlayer, addChat, spawnProp, resizeProp, getState } = require('./world');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/join', (req, res) => res.json(joinPlayer(req.body || {})));

app.post('/api/update', (req, res) => {
  const { id, ...payload } = req.body || {};
  const player = updatePlayer(id, payload);
  if (!player) return res.status(404).json({ error: 'unknown player' });
  return res.json({ ok: true, player });
});

app.post('/api/chat', (req, res) => {
  const { id, text } = req.body || {};
  const chat = addChat(id, text);
  if (!chat) return res.status(400).json({ error: 'chat rejected' });
  return res.json({ ok: true, chat });
});

app.post('/api/props/spawn', (req, res) => {
  const { id, ...payload } = req.body || {};
  const prop = spawnProp(id, payload);
  if (!prop) return res.status(400).json({ error: 'spawn rejected' });
  return res.json({ ok: true, prop });
});

app.post('/api/props/resize', (req, res) => {
  const { id, ...payload } = req.body || {};
  const prop = resizeProp(id, payload);
  if (!prop) return res.status(400).json({ error: 'resize rejected' });
  return res.json({ ok: true, prop });
});

app.get('/api/state', (req, res) => res.json(getState(req.query.since)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Wezone running on http://localhost:${PORT}`);
});
