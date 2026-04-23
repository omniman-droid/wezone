const players = new Map();
const props = new Map();
const chats = [];
const removedPlayers = [];
const removedProps = [];

const WORLD_TTL_MS = 45_000;
const CHAT_TTL_MS = 10_000;
let rev = 0;

function nextRev() {
  rev += 1;
  return rev;
}

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

function sanitizeType(type) {
  const allowed = new Set(['crate', 'ball', 'barrel', 'cone']);
  return allowed.has(type) ? type : 'crate';
}

function toNum(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function cleanup() {
  const t = now();
  for (const [id, player] of players) {
    if (t - player.lastSeen > WORLD_TTL_MS) {
      players.delete(id);
      removedPlayers.push({ id, rev: nextRev() });
    }
  }

  while (chats.length && t - chats[0].createdAt > CHAT_TTL_MS) chats.shift();
  while (removedPlayers.length && rev - removedPlayers[0].rev > 500) removedPlayers.shift();
  while (removedProps.length && rev - removedProps[0].rev > 500) removedProps.shift();
}

function joinPlayer(seed = {}) {
  cleanup();
  const id = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
  const player = {
    id,
    x: toNum(seed.x, (Math.random() - 0.5) * 50),
    y: 0,
    z: toNum(seed.z, (Math.random() - 0.5) * 50),
    rotY: 0,
    color: sanitizeColor(seed.color),
    nameTag: sanitizeName(seed.nameTag || `Pilot-${id.slice(0, 4)}`),
    lastSeen: now(),
    rev: nextRev()
  };

  players.set(id, player);

  return {
    selfId: id,
    rev,
    players: Array.from(players.values()),
    props: Array.from(props.values()),
    chats
  };
}

function updatePlayer(id, payload = {}) {
  cleanup();
  const player = players.get(id);
  if (!player) return null;

  player.x = toNum(payload.x, player.x);
  player.y = toNum(payload.y, player.y);
  player.z = toNum(payload.z, player.z);
  player.rotY = toNum(payload.rotY, player.rotY);
  player.color = sanitizeColor(payload.color ?? player.color);
  player.nameTag = sanitizeName(payload.nameTag ?? player.nameTag);
  player.lastSeen = now();
  player.rev = nextRev();

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
    createdAt: now(),
    rev: nextRev()
  };
  chats.push(entry);
  player.lastSeen = now();
  return entry;
}

function spawnProp(id, payload = {}) {
  cleanup();
  if (!players.get(id)) return null;

  const prop = {
    id: `p-${Math.random().toString(36).slice(2, 10)}`,
    ownerId: id,
    type: sanitizeType(payload.type),
    x: toNum(payload.x),
    y: toNum(payload.y, 2),
    z: toNum(payload.z),
    sx: Math.max(0.3, toNum(payload.sx, 1)),
    sy: Math.max(0.3, toNum(payload.sy, 1)),
    sz: Math.max(0.3, toNum(payload.sz, 1)),
    color: sanitizeColor(payload.color || '#9dd7ff'),
    rev: nextRev()
  };
  props.set(prop.id, prop);
  return prop;
}

function resizeProp(id, payload = {}) {
  cleanup();
  const prop = props.get(payload.propId);
  if (!prop) return null;
  if (prop.ownerId !== id) return null;

  prop.sx = Math.max(0.3, toNum(payload.sx, prop.sx));
  prop.sy = Math.max(0.3, toNum(payload.sy, prop.sy));
  prop.sz = Math.max(0.3, toNum(payload.sz, prop.sz));
  prop.rev = nextRev();
  return prop;
}

function getState(since = 0) {
  cleanup();
  const cursor = Number.isFinite(Number(since)) ? Number(since) : 0;
  if (!cursor) {
    return {
      rev,
      players: Array.from(players.values()),
      props: Array.from(props.values()),
      chats,
      removedPlayers: [],
      removedProps: []
    };
  }

  return {
    rev,
    players: Array.from(players.values()).filter((p) => p.rev > cursor),
    props: Array.from(props.values()).filter((p) => p.rev > cursor),
    chats: chats.filter((c) => c.rev > cursor),
    removedPlayers: removedPlayers.filter((r) => r.rev > cursor),
    removedProps: removedProps.filter((r) => r.rev > cursor)
  };
}

module.exports = {
  joinPlayer,
  updatePlayer,
  addChat,
  spawnProp,
  resizeProp,
  getState
};
