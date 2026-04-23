import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const socket = io();

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
const skyMat = new THREE.MeshBasicMaterial({
  color: 0xa7d8f5,
  side: THREE.BackSide
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

const groundGeo = new THREE.PlaneGeometry(800, 800, 40, 40);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x67c26b,
  roughness: 0.85,
  metalness: 0.05
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const keys = new Set();
const players = new Map();
let selfId = null;

const colorInput = document.getElementById('metalColor');
const nameInput = document.getElementById('nameTag');

function makeNameSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(8, 25, 39, 0.8)';
  ctx.fillRect(0, 8, 256, 48);
  ctx.strokeStyle = 'rgba(170, 230, 255, 0.9)';
  ctx.strokeRect(0, 8, 256, 48);
  ctx.fillStyle = '#e8f9ff';
  ctx.font = '28px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText(text.slice(0, 20), 128, 42);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.2, 1.05, 1);
  sprite.position.set(0, 4.5, 0);
  return sprite;
}

function buildAvatar({ color = '#d7dde2', nameTag = 'Pilot' }) {
  const group = new THREE.Group();

  const metal = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.95,
    roughness: 0.18,
    envMapIntensity: 1.2
  });

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

  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.03, 10, 20, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x073047 })
  );
  mouth.position.set(0, 3.38, 0.78);
  mouth.rotation.set(Math.PI / 2, 0, Math.PI);
  group.add(mouth);

  const tag = makeNameSprite(nameTag);
  group.add(tag);

  group.userData = {
    metal,
    nameTag: tag
  };

  return group;
}

function upsertPlayer(data) {
  let player = players.get(data.id);
  if (!player) {
    player = buildAvatar(data);
    scene.add(player);
    players.set(data.id, player);
  }

  player.position.set(data.x, data.y, data.z);
  player.rotation.y = data.rotY;

  player.userData.metal.color.set(data.color);

  player.remove(player.userData.nameTag);
  player.userData.nameTag.material.map.dispose();
  player.userData.nameTag.material.dispose();
  player.userData.nameTag = makeNameSprite(data.nameTag);
  player.add(player.userData.nameTag);
}

function removePlayer(id) {
  const player = players.get(id);
  if (!player) return;
  scene.remove(player);
  players.delete(id);
}

socket.on('bootstrap', ({ selfId: id, players: initialPlayers }) => {
  selfId = id;
  initialPlayers.forEach(upsertPlayer);
});

socket.on('player:join', upsertPlayer);
socket.on('player:update', upsertPlayer);
socket.on('player:leave', removePlayer);

window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastSent = 0;
const speed = 11;

function tick() {
  requestAnimationFrame(tick);

  const me = players.get(selfId);
  if (me) {
    const dt = 1 / 60;
    const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
    const turn = Number(keys.has('a') || keys.has('arrowleft')) - Number(keys.has('d') || keys.has('arrowright'));

    me.rotation.y += turn * 2.1 * dt;
    const dir = new THREE.Vector3(Math.sin(me.rotation.y), 0, Math.cos(me.rotation.y));
    me.position.addScaledVector(dir, forward * speed * dt);

    const cameraOffset = new THREE.Vector3(0, 5, -10).applyAxisAngle(new THREE.Vector3(0, 1, 0), me.rotation.y);
    camera.position.lerp(me.position.clone().add(cameraOffset), 0.12);
    camera.lookAt(me.position.clone().add(new THREE.Vector3(0, 2.5, 0)));

    const now = performance.now();
    if (now - lastSent > 50) {
      lastSent = now;
      socket.emit('player:update', {
        x: me.position.x,
        y: me.position.y,
        z: me.position.z,
        rotY: me.rotation.y,
        color: colorInput.value,
        nameTag: nameInput.value.trim() || 'Pilot'
      });
    }
  }

  renderer.render(scene, camera);
}

tick();
