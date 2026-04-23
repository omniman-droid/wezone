import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9ad1ef, 120, 400);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xd8f1ff, 0.8));
const hemi = new THREE.HemisphereLight(0xe6f8ff, 0x3f6e48, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(70, 90, 30);
scene.add(sun);

const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 40, 40), new THREE.MeshBasicMaterial({ color: 0xaedff8, side: THREE.BackSide }));
scene.add(sky);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000, 60, 60),
  new THREE.MeshStandardMaterial({ color: 0x6fd271, roughness: 0.9, metalness: 0.02 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const dom = {
  menuScreen: document.getElementById('menuScreen'),
  playBtn: document.getElementById('playBtn'),
  menuName: document.getElementById('menuName'),
  menuColor: document.getElementById('menuColor'),
  metalColor: document.getElementById('metalColor'),
  nameTag: document.getElementById('nameTag'),
  chatInput: document.getElementById('chatInput'),
  chatSend: document.getElementById('chatSend'),
  spawnMenu: document.getElementById('spawnMenu'),
  propType: document.getElementById('propType'),
  propColor: document.getElementById('propColor'),
  spawnOne: document.getElementById('spawnOne'),
  massCount: document.getElementById('massCount'),
  massSpawn: document.getElementById('massSpawn'),
  resizeValue: document.getElementById('resizeValue'),
  applyResize: document.getElementById('applyResize')
};

const keys = new Set();
const players = new Map();
const props = new Map();
const chatsSeen = new Set();

let selfId = null;
let worldRev = 0;
let selectedPropId = null;
let playing = false;

function terrainHeight(x, z) {
  return Math.sin(x * 0.05) * 0.7 + Math.cos(z * 0.06) * 0.6 + Math.sin((x + z) * 0.04) * 0.45;
}

function makeTextSprite(text, y, style = { bg: 'rgba(10,26,40,0.85)', fg: '#effbff' }) {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 300, 72);
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 8, 300, 52);
  ctx.strokeStyle = 'rgba(172,232,255,0.9)';
  ctx.strokeRect(0, 8, 300, 52);
  ctx.fillStyle = style.fg;
  ctx.textAlign = 'center';
  ctx.font = '26px Inter';
  ctx.fillText(text.slice(0, 24), 150, 41);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(4.4, 1.05, 1);
  sprite.position.y = y;
  return sprite;
}

function disposeSprite(sprite) {
  if (!sprite) return;
  sprite.material.map.dispose();
  sprite.material.dispose();
}

function buildAvatar(data) {
  const group = new THREE.Group();
  const bodyRadius = 0.62;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(bodyRadius, 1.45, 10, 20),
    new THREE.MeshStandardMaterial({ color: data.color, metalness: 0.93, roughness: 0.2 })
  );
  body.position.y = 2;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(bodyRadius, 24, 24),
    new THREE.MeshStandardMaterial({ color: data.color, metalness: 0.93, roughness: 0.2 })
  );
  head.position.y = 3.35;
  group.add(head);

  const legGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.4, 16);
  const legL = new THREE.Mesh(legGeo, body.material);
  legL.position.set(-0.33, 0.8, 0);
  const legR = legL.clone();
  legR.position.x = 0.33;
  group.add(legL, legR);

  group.userData = {
    bodyMat: body.material,
    headMat: head.material,
    velocity: new THREE.Vector3(),
    grounded: false,
    tagText: '',
    tag: null,
    chat: null,
    chatTimeout: null
  };

  updateNameTag(group, data.nameTag);
  return group;
}

function updateNameTag(player, text) {
  if (player.userData.tagText === text) return;
  player.userData.tagText = text;
  if (player.userData.tag) {
    player.remove(player.userData.tag);
    disposeSprite(player.userData.tag);
  }
  player.userData.tag = makeTextSprite(text, 4.55);
  player.add(player.userData.tag);
}

function setChatBubble(player, text) {
  if (player.userData.chat) {
    clearTimeout(player.userData.chatTimeout);
    player.remove(player.userData.chat);
    disposeSprite(player.userData.chat);
  }
  const bubble = makeTextSprite(text, 5.7, { bg: 'rgba(247,252,255,0.95)', fg: '#12374d' });
  player.userData.chat = bubble;
  player.add(bubble);
  player.userData.chatTimeout = setTimeout(() => {
    if (!player.userData.chat) return;
    player.remove(player.userData.chat);
    disposeSprite(player.userData.chat);
    player.userData.chat = null;
  }, 10000);
}

function upsertPlayer(data) {
  let p = players.get(data.id);
  if (!p) {
    p = buildAvatar(data);
    scene.add(p);
    players.set(data.id, p);
  }
  if (data.id !== selfId) {
    p.position.set(data.x, data.y, data.z);
    p.rotation.y = data.rotY;
  }
  p.userData.bodyMat.color.set(data.color);
  p.userData.headMat.color.set(data.color);
  updateNameTag(p, data.nameTag);
}

function removePlayer(id) {
  const p = players.get(id);
  if (!p) return;
  if (p.userData.chatTimeout) clearTimeout(p.userData.chatTimeout);
  scene.remove(p);
  players.delete(id);
}

function geometryForType(type) {
  switch (type) {
    case 'ball': return new THREE.SphereGeometry(0.55, 18, 18);
    case 'barrel': return new THREE.CylinderGeometry(0.45, 0.55, 1, 16);
    case 'cone': return new THREE.ConeGeometry(0.55, 1.1, 18);
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

function upsertProp(data) {
  let obj = props.get(data.id);
  if (!obj) {
    obj = new THREE.Mesh(
      geometryForType(data.type),
      new THREE.MeshStandardMaterial({ color: data.color, metalness: 0.25, roughness: 0.45 })
    );
    obj.userData = {
      id: data.id,
      type: data.type,
      velocity: new THREE.Vector3(),
      box: new THREE.Box3(),
      ownerId: data.ownerId
    };
    scene.add(obj);
    props.set(data.id, obj);
  }

  if (obj.userData.type !== data.type) {
    obj.geometry.dispose();
    obj.geometry = geometryForType(data.type);
    obj.userData.type = data.type;
  }

  obj.material.color.set(data.color);
  obj.position.set(data.x, data.y, data.z);
  obj.scale.set(data.sx, data.sy, data.sz);
  obj.userData.ownerId = data.ownerId;
}

function postJSON(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }).then((res) => {
    if (!res.ok) throw new Error('request_failed');
    return res.json();
  });
}

function applyState(state) {
  worldRev = Math.max(worldRev, state.rev || 0);

  state.players?.forEach(upsertPlayer);
  state.props?.forEach(upsertProp);
  state.chats?.forEach((c) => {
    if (chatsSeen.has(c.id)) return;
    chatsSeen.add(c.id);
    const pl = players.get(c.playerId);
    if (pl) setChatBubble(pl, c.text);
  });

  state.removedPlayers?.forEach((p) => removePlayer(p.id));
  state.removedProps?.forEach((r) => {
    const prop = props.get(r.id);
    if (!prop) return;
    scene.remove(prop);
    props.delete(r.id);
  });
}

function updatePhysics(dt) {
  const me = players.get(selfId);
  if (!me) return;

  const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
  const turn = Number(keys.has('a') || keys.has('arrowleft')) - Number(keys.has('d') || keys.has('arrowright'));

  me.rotation.y += turn * 2.8 * dt;
  const dir = new THREE.Vector3(Math.sin(me.rotation.y), 0, Math.cos(me.rotation.y));

  const accel = me.userData.grounded ? 30 : 11;
  me.userData.velocity.x += dir.x * forward * accel * dt;
  me.userData.velocity.z += dir.z * forward * accel * dt;

  const drag = me.userData.grounded ? 8 : 1.5;
  me.userData.velocity.x *= Math.max(0, 1 - drag * dt);
  me.userData.velocity.z *= Math.max(0, 1 - drag * dt);

  if ((keys.has(' ') || keys.has('space')) && me.userData.grounded) {
    me.userData.velocity.y = 9.4;
    me.userData.grounded = false;
  }
  me.userData.velocity.y -= 21 * dt;

  me.position.addScaledVector(me.userData.velocity, dt);
  const floor = terrainHeight(me.position.x, me.position.z);
  if (me.position.y <= floor) {
    me.position.y = floor;
    me.userData.velocity.y = me.userData.velocity.y < -8 ? -me.userData.velocity.y * 0.2 : 0;
    me.userData.grounded = true;
  }

  const meBall = new THREE.Sphere(me.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 1.0);
  for (const prop of props.values()) {
    prop.userData.velocity.y -= 16 * dt;
    prop.position.addScaledVector(prop.userData.velocity, dt);
    const py = terrainHeight(prop.position.x, prop.position.z) + prop.scale.y * 0.5;
    if (prop.position.y < py) {
      prop.position.y = py;
      prop.userData.velocity.y *= -0.32;
      prop.userData.velocity.x *= 0.93;
      prop.userData.velocity.z *= 0.93;
    }

    prop.userData.box.setFromObject(prop);
    if (prop.userData.box.intersectsSphere(meBall)) {
      const away = prop.position.clone().sub(me.position).setY(0).normalize();
      prop.userData.velocity.addScaledVector(away, 9 * dt);
      me.userData.velocity.addScaledVector(away, -4 * dt);
      if (keys.has('shift')) prop.userData.velocity.y = 6.2;
    }

    if (selectedPropId === prop.userData.id) {
      prop.material.emissive?.set?.(0x224455);
    } else {
      prop.material.emissive?.set?.(0x000000);
    }
  }

  const camOffset = new THREE.Vector3(0, 6, -11).applyAxisAngle(new THREE.Vector3(0, 1, 0), me.rotation.y);
  camera.position.lerp(me.position.clone().add(camOffset), 0.12);
  camera.lookAt(me.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
}

function selectNearestProp() {
  const me = players.get(selfId);
  if (!me) return;
  let best = null;
  let bestDist = 999;
  for (const [id, prop] of props) {
    const d = prop.position.distanceTo(me.position);
    if (d < 5.5 && d < bestDist) {
      best = id;
      bestDist = d;
    }
  }
  selectedPropId = best;
}

async function spawnProp(type, color, count = 1) {
  const me = players.get(selfId);
  if (!me) return;

  for (let i = 0; i < count; i += 1) {
    const spread = new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3);
    const at = me.position.clone().add(spread);
    await postJSON('/api/props/spawn', {
      id: selfId,
      type,
      color,
      x: at.x,
      y: at.y,
      z: at.z,
      sx: 1,
      sy: 1,
      sz: 1
    });
  }
}

async function resizeSelected(scale) {
  if (!selectedPropId) return;
  await postJSON('/api/props/resize', {
    id: selfId,
    propId: selectedPropId,
    sx: scale,
    sy: scale,
    sz: scale
  });
}

async function joinGame() {
  if (playing) return;
  playing = true;
  dom.menuScreen.style.display = 'none';
  dom.nameTag.value = dom.menuName.value;
  dom.metalColor.value = dom.menuColor.value;

  const boot = await postJSON('/api/join', {
    nameTag: dom.menuName.value.trim() || 'Pilot',
    color: dom.menuColor.value
  });

  selfId = boot.selfId;
  applyState(boot);

  const me = players.get(selfId);
  if (me) me.position.y = terrainHeight(me.position.x, me.position.z);
}

let lastTime = performance.now();
let lastPoll = 0;
let lastPush = 0;

async function pollState() {
  const state = await fetch(`/api/state?since=${worldRev}`, { cache: 'no-store' }).then((r) => r.json());
  applyState(state);
}

async function pushSelf() {
  const me = players.get(selfId);
  if (!me) return;
  await postJSON('/api/update', {
    id: selfId,
    x: me.position.x,
    y: me.position.y,
    z: me.position.z,
    rotY: me.rotation.y,
    color: dom.metalColor.value,
    nameTag: dom.nameTag.value.trim() || 'Pilot'
  });
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (playing) {
    updatePhysics(dt);
    if (now - lastPush > 85 && selfId) {
      lastPush = now;
      pushSelf().catch(() => {});
    }
    if (now - lastPoll > 140) {
      lastPoll = now;
      pollState().catch(() => {});
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'b') {
    dom.spawnMenu.style.display = dom.spawnMenu.style.display === 'none' ? 'block' : 'none';
  }
  if (e.key.toLowerCase() === 'e') selectNearestProp();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

for (const btn of document.querySelectorAll('.tab-btn')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((x) => x.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
}

dom.playBtn.addEventListener('click', () => joinGame().catch(console.error));
dom.chatSend.addEventListener('click', () => {
  const text = dom.chatInput.value.trim();
  if (!text || !selfId) return;
  dom.chatInput.value = '';
  postJSON('/api/chat', { id: selfId, text }).catch(() => {});
});
dom.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.chatSend.click();
});

dom.spawnOne.addEventListener('click', () => {
  spawnProp(dom.propType.value, dom.propColor.value, 1).catch(() => {});
});

dom.massSpawn.addEventListener('click', () => {
  const count = Math.max(1, Math.min(40, Number(dom.massCount.value) || 1));
  spawnProp(dom.propType.value, dom.propColor.value, count).catch(() => {});
});

dom.applyResize.addEventListener('click', () => {
  const s = Math.max(0.3, Math.min(6, Number(dom.resizeValue.value) || 1));
  resizeSelected(s).catch(() => {});
});

loop(performance.now());
