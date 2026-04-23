const players = new Map();
const chatEvents = [];

const WORLD_TTL_MS = 45_000;
const CHAT_TTL_MS = 10_000;

function now() {
  return Date.now();
}

function sanitizeColor(color) {
  if (typeof color !== 'string') return '#d7dde2';
  const match = color.trim().match(/^#[0-9a-fA-F]{6}$/);
  return match ? match[0] : '#d7dde2';
}

function sanitizeName(nameTag) {
  if (typeof nameTag !== 'string') return 'Pilot';
  return nameTag.trim().replace(/\s+/g, ' ').slice(0, 20) || 'Pilot';
}

function sanitizeChat(text) {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ').slice(0, 80);
}

function cleanup() {
  const t = now();
  for (const [id, player] of players) {
    if (t - player.lastSeen > WORLD_TTL_MS) players.delete(id);
  }

  while (chatEvents.length && t - chatEvents[0].createdAt > CHAT_TTL_MS) {
    chatEvents.shift();
  }
}

function joinPlayer(seed = {}) {
  cleanup();
  const id = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
  const player = {
    id,
    x: Number.isFinite(seed.x) ? seed.x : (Math.random() - 0.5) * 50,
    y: 0,
    z: Number.isFinite(seed.z) ? seed.z : (Math.random() - 0.5) * 50,
    rotY: 0,
    color: sanitizeColor(seed.color),
    nameTag: sanitizeName(seed.nameTag || `Pilot-${id.slice(0, 4)}`),
    lastSeen: now()
  };

  players.set(id, player);
  return {
    selfId: id,
    players: Array.from(players.values()),
    chats: chatEvents
  };
}

function updatePlayer(id, payload = {}) {
  cleanup();
  const player = players.get(id);
  if (!player) return null;

  player.x = Number.isFinite(payload.x) ? payload.x : player.x;
  player.y = Number.isFinite(payload.y) ? payload.y : player.y;
  player.z = Number.isFinite(payload.z) ? payload.z : player.z;
  player.rotY = Number.isFinite(payload.rotY) ? payload.rotY : player.rotY;
  player.color = sanitizeColor(payload.color ?? player.color);
  player.nameTag = sanitizeName(payload.nameTag ?? player.nameTag);
  player.lastSeen = now();

  return player;
}

function addChat(id, text) {
  cleanup();
  const player = players.get(id);
  if (!player) return null;

  const message = sanitizeChat(text);
  if (!message) return null;

  const entry = {
    id: `${id}-${now()}`,
    playerId: id,
    text: message,
    createdAt: now()
  };
  chatEvents.push(entry);
  player.lastSeen = now();

  return entry;
}

function getState() {
  cleanup();
  return {
    players: Array.from(players.values()),
    chats: chatEvents
  };
}

module.exports = {
  joinPlayer,
  updatePlayer,
  addChat,
  getState
};
