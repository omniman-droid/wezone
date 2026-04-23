const path = require('path');
const express = require('express');
const { joinPlayer, updatePlayer, addChat, getState } = require('./world');

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/join', (req, res) => {
  res.json(joinPlayer(req.body || {}));
});

app.post('/api/update', (req, res) => {
  const { id, ...payload } = req.body || {};
  const player = updatePlayer(id, payload);
  if (!player) return res.status(404).json({ error: 'unknown player' });
  res.json({ ok: true, player });
});

app.post('/api/chat', (req, res) => {
  const { id, text } = req.body || {};
  const chat = addChat(id, text);
  if (!chat) return res.status(400).json({ error: 'chat rejected' });
  res.json({ ok: true, chat });
});

app.get('/api/state', (_req, res) => {
  res.json(getState());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Wezone running on http://localhost:${PORT}`);
});
