import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x91c7e8, 80, 250);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xdff8ff, 0x2b6654, 1.2);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(20, 35, 12);
scene.add(sun);

const skyGeo = new THREE.SphereGeometry(500, 32, 32);
const skyMat = new THREE.MeshBasicMaterial({ color: 0xa7d8f5, side: THREE.BackSide });
scene.add(new THREE.Mesh(skyGeo, skyMat));

const groundGeo = new THREE.PlaneGeometry(800, 800, 50, 50);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x67c26b, roughness: 0.86, metalness: 0.05 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const boostPads = [];
for (let i = 0; i < 18; i += 1) {
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 0.28, 22),
    new THREE.MeshStandardMaterial({ color: 0x50e6ff, emissive: 0x0d82a3, emissiveIntensity: 0.75 })
  );
  pad.position.set((Math.random() - 0.5) * 180, 0.14, (Math.random() - 0.5) * 180);
  scene.add(pad);
  boostPads.push(pad);
}

const keys = new Set();
const players = new Map();
const chatSeen = new Set();
let selfId = null;

const colorInput = document.getElementById('metalColor');
const nameInput = document.getElementById('nameTag');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

function terrainHeight(x, z) {
  return Math.sin(x * 0.06) * 0.55 + Math.cos(z * 0.08) * 0.45 + Math.sin((x + z) * 0.035) * 0.6;
}

function terrainNormal(x, z) {
  const e = 0.3;
  const hL = terrainHeight(x - e, z);
  const hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e);
  const hU = terrainHeight(x, z + e);
  return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
}

function makeTextSprite(text, y, bg = 'rgba(8,25,39,0.85)') {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 320, 80);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 10, 320, 56);
  ctx.strokeStyle = 'rgba(170, 230, 255, 0.9)';
  ctx.strokeRect(0, 10, 320, 56);
  ctx.fillStyle = '#e8f9ff';
  ctx.font = '28px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText(text, 160, 47);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(5, 1.2, 1);
  sprite.position.set(0, y, 0);
  return sprite;
}

function setNameTag(player, nameTag) {
  if (player.userData.nameTag) {
    player.remove(player.userData.nameTag);
    player.userData.nameTag.material.map.dispose();
    player.userData.nameTag.material.dispose();
  }
  player.userData.nameTag = makeTextSprite(nameTag, 4.5);
  player.add(player.userData.nameTag);
}

function setChatBubble(player, text) {
  if (player.userData.chatBubble) {
    clearTimeout(player.userData.chatTimeout);
    player.remove(player.userData.chatBubble);
    player.userData.chatBubble.material.map.dispose();
    player.userData.chatBubble.material.dispose();
  }

  const bubble = makeTextSprite(text, 5.9, 'rgba(247,252,255,0.95)');
  bubble.material.color.set(0xffffff);
  player.userData.chatBubble = bubble;
  player.add(bubble);

  player.userData.chatTimeout = setTimeout(() => {
    if (!player.userData.chatBubble) return;
    player.remove(player.userData.chatBubble);
    player.userData.chatBubble.material.map.dispose();
    player.userData.chatBubble.material.dispose();
    player.userData.chatBubble = null;
  }, 10000);
}

function buildAvatar({ color = '#d7dde2', nameTag = 'Pilot' }) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color, metalness: 0.95, roughness: 0.18, envMapIntensity: 1.2 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 2.2, 24), metal);
  torso.position.y = 2;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 24), metal);
  head.position.y = 3.5;
  group.add(head);

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.5, 16), metal);
  armL.position.set(-1.1, 2.1, 0);
  armL.rotation.z = Math.PI * 0.12;
  group.add(armL);

  const armR = armL.clone();
  armR.position.x = 1.1;
  armR.rotation.z = -Math.PI * 0.12;
  group.add(armR);

  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.3, 16), metal);
  legL.position.set(-0.4, 0.7, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.4;
  group.add(legR);

  const eyeGeo = new THREE.SphereGeometry(0.07, 16, 16);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x073047 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.2, 3.6, 0.77);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.2;
  group.add(eyeL, eyeR);

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 10, 20, Math.PI), new THREE.MeshBasicMaterial({ color: 0x073047 }));
  mouth.position.set(0, 3.38, 0.78);
  mouth.rotation.set(Math.PI / 2, 0, Math.PI);
  group.add(mouth);

  group.userData = {
    metal,
    velocity: new THREE.Vector3(),
    onGround: false,
    nameTag: null,
    chatBubble: null,
    chatTimeout: null
  };

  setNameTag(group, nameTag);
  return group;
}

function upsertPlayer(data) {
  let player = players.get(data.id);
  if (!player) {
    player = buildAvatar(data);
    scene.add(player);
    players.set(data.id, player);
  }

  if (data.id !== selfId) {
    player.position.set(data.x, data.y, data.z);
    player.rotation.y = data.rotY;
  }

  player.userData.metal.color.set(data.color);
  setNameTag(player, data.nameTag);
}

async function postJSON(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function joinWorld() {
  const boot = await postJSON('/api/join', {
    x: (Math.random() - 0.5) * 20,
    z: (Math.random() - 0.5) * 20,
    color: colorInput.value,
    nameTag: nameInput.value.trim() || 'Pilot'
  });

  selfId = boot.selfId;
  boot.players.forEach(upsertPlayer);

  const me = players.get(selfId);
  if (me) {
    me.position.y = terrainHeight(me.position.x, me.position.z);
  }
}

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text || !selfId) return;
  chatInput.value = '';
  await postJSON('/api/chat', { id: selfId, text });
}

chatSend.addEventListener('click', () => sendChat().catch(() => {}));
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat().catch(() => {});
});

window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastUpdateSent = 0;
let lastPoll = 0;
let lastTime = performance.now();

function updateSelfPhysics(dt) {
  const me = players.get(selfId);
  if (!me) return;

  const turning = Number(keys.has('a') || keys.has('arrowleft')) - Number(keys.has('d') || keys.has('arrowright'));
  me.rotation.y += turning * 2.7 * dt;

  const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
  const forwardDir = new THREE.Vector3(Math.sin(me.rotation.y), 0, Math.cos(me.rotation.y));

  const accel = me.userData.onGround ? 32 : 12;
  me.userData.velocity.x += forwardDir.x * forward * accel * dt;
  me.userData.velocity.z += forwardDir.z * forward * accel * dt;

  const drag = me.userData.onGround ? 7.5 : 1.6;
  me.userData.velocity.x *= Math.max(0, 1 - drag * dt);
  me.userData.velocity.z *= Math.max(0, 1 - drag * dt);

  if ((keys.has(' ') || keys.has('space')) && me.userData.onGround) {
    me.userData.velocity.y = 8.8;
    me.userData.onGround = false;
  }

  me.userData.velocity.y -= 20 * dt;

  me.position.x += me.userData.velocity.x * dt;
  me.position.y += me.userData.velocity.y * dt;
  me.position.z += me.userData.velocity.z * dt;

  const groundY = terrainHeight(me.position.x, me.position.z);
  if (me.position.y <= groundY) {
    me.position.y = groundY;
    if (me.userData.velocity.y < -9) {
      me.userData.velocity.y = Math.abs(me.userData.velocity.y) * 0.22;
    } else {
      me.userData.velocity.y = 0;
    }
    me.userData.onGround = true;
  }

  const n = terrainNormal(me.position.x, me.position.z);
  me.rotation.x = THREE.MathUtils.lerp(me.rotation.x, n.z * 0.12, 0.08);
  me.rotation.z = THREE.MathUtils.lerp(me.rotation.z, -n.x * 0.12 - forward * 0.04, 0.08);

  for (const pad of boostPads) {
    const d = me.position.distanceTo(pad.position);
    if (d < 1.9 && me.position.y < pad.position.y + 1.4) {
      me.userData.velocity.y = Math.max(me.userData.velocity.y, 12);
      me.userData.velocity.x += forwardDir.x * 4;
      me.userData.velocity.z += forwardDir.z * 4;
    }
  }

  const cameraOffset = new THREE.Vector3(0, 5.2, -10.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), me.rotation.y);
  camera.position.lerp(me.position.clone().add(cameraOffset), 0.12);
  camera.lookAt(me.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
}

async function pollWorld() {
  const state = await fetch('/api/state', { cache: 'no-store' }).then((r) => r.json());

  const ids = new Set();
  state.players.forEach((p) => {
    ids.add(p.id);
    upsertPlayer(p);
  });

  for (const id of players.keys()) {
    if (!ids.has(id)) {
      scene.remove(players.get(id));
      players.delete(id);
    }
  }

  state.chats.forEach((c) => {
    if (chatSeen.has(c.id)) return;
    chatSeen.add(c.id);
    const player = players.get(c.playerId);
    if (player) setChatBubble(player, c.text);
  });
}

async function syncSelf() {
  const me = players.get(selfId);
  if (!me) return;

  await postJSON('/api/update', {
    id: selfId,
    x: me.position.x,
    y: me.position.y,
    z: me.position.z,
    rotY: me.rotation.y,
    color: colorInput.value,
    nameTag: nameInput.value.trim() || 'Pilot'
  });
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  updateSelfPhysics(dt);

  if (now - lastUpdateSent > 80 && selfId) {
    lastUpdateSent = now;
    syncSelf().catch(() => {});
  }

  if (now - lastPoll > 120) {
    lastPoll = now;
    pollWorld().catch(() => {});
  }

  renderer.render(scene, camera);
}

joinWorld().then(() => animate(performance.now())).catch(console.error);
