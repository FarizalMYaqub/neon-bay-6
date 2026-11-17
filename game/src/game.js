// Neon Bay — main game: player controller, camera, wanted logic, combat,
// save/load, and the frame loop that wires city, vehicles, people, missions,
// HUD and audio together.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { Input } from './input.js';
import { buildCity } from './city.js';
import { VehicleSystem } from './vehicles.js';
import { PeopleSystem, buildPersonMesh } from './people.js';
import { MissionSystem } from './missions.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { applyShot } from './shots.js';

const SAVE_KEY = 'neon-bay-save-v1';
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 7);

const rng = makeRng(SEED);
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const input = new Input(canvas);
const audio = new AudioSys();
const hud = new HUD();
const city = buildCity(scene, rng);
const vehicles = new VehicleSystem(scene, rng, city);
const people = new PeopleSystem(scene, rng, city);
const missions = new MissionSystem(scene, rng, city);

// --- player ---
const playerMesh = buildPersonMesh(0xff2d78);
scene.add(playerMesh);
const player = {
  x: 0, z: -8, heading: Math.PI, health: 100, cash: 250,
  ammo: 24, reserveAmmo: 96, speed: 0,
  walkPhase: 0, punchT: 0, shootT: 0, reloadT: 0,
};
let driving = false;
let playerCar = null;
let speedKmh = 0;

// --- camera orbit ---
let camYaw = Math.PI; // behind the player, looking north
let camPitch = 0.32;
let camDist = 8;

// --- wanted / police ---
let wanted = 0;
let wantedFlash = 0;
let layLowT = 0;
let lastCrimeT = -100;
let timeSec = 0;
let clockMinutes = 18 * 60 + 30; // sunset, 18:30
let elapsed = 0;

// --- flow ---
let started = false;
let paused = false;
let allDone = false;
let saveT = 0;
const tracers = [];
const raycaster = new THREE.Raycaster();

// --- world population ---
vehicles.spawnTraffic(16);
vehicles.spawnParked(5);
people.spawnPedestrians(30);

missions.onGangSpawn = (x, z) => {
  people.spawnGang(4, x - 12, z - 12);
  audio.denied();
};
missions.onWantedSet = (stars) => raiseWanted(stars, true);
missions.onReward = (cash) => { player.cash += cash; audio.cash(); };
missions.onAllDone = () => {
  allDone = true;
  document.getElementById('complete').style.display = 'flex';
  saveGame();
};

function raiseWanted(stars, force = false) {
  if (stars > wanted || force) {
    wanted = Math.min(5, Math.max(wanted, stars));
    wantedFlash = timeSec;
    lastCrimeT = timeSec;
    layLowT = 0;
  }
}

function syncPolice() {
  const want = wanted; // one cruiser per star
  if (vehicles.police.length < want) {
    vehicles.spawnPolice(want - vehicles.police.length, player.x, player.z);
  } else if (vehicles.police.length > want) {
    vehicles.removePoliceExtra(want);
  }
  audio.siren(wanted > 0 && started && !paused);
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: player.cash, health: player.health,
      x: player.x, z: player.z,
      mission: missions.saveState(),
    }));
  } catch { /* storage unavailable */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    player.cash = s.cash ?? player.cash;
    player.health = s.health ?? 100;
    player.x = s.x ?? player.x;
    player.z = s.z ?? player.z;
    if (s.mission) missions.loadState(s.mission);
    return true;
  } catch { return false; }
}

function respawn() {
  player.health = 100;
  player.cash = Math.max(0, player.cash - 200);
  player.x = 30; player.z = 24; // plaza hospital corner
  player.heading = Math.PI;
  wanted = 0;
  syncPolice();
  if (driving) exitCar();
  document.getElementById('death').style.display = 'none';
  saveGame();
}

function enterCar(car) {
  driving = true;
  playerCar = car;
  vehicles.playerCar = car;
  vehicles.parked.splice(vehicles.parked.indexOf(car), 1);
  playerMesh.visible = false;
  raiseWanted(Math.max(wanted, 1)); // stealing a car is a crime
  audio.pickup();
  camDist = 11;
}

function exitCar() {
  if (!playerCar) return;
  driving = false;
  const car = playerCar;
  player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
  player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
  player.heading = car.heading;
  car.speed = 0;
  vehicles.parked.push(car);
  vehicles.playerCar = null;
  playerCar = null;
  playerMesh.visible = true;
  camDist = 8;
}

function shoot() {
  if (player.reloadT > 0 || player.ammo <= 0) { if (player.ammo <= 0) audio.denied(); return; }
  player.ammo--;
  player.shootT = 0.12;
  audio.gunshot();
  people.scare(player.x, player.z, 16);
  raiseWanted(Math.max(wanted, 1));
  // Raycast from the camera through the screen center.
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const targets = [];
  for (const g of people.gang) targets.push(g.mesh);
  for (const p of people.pedestrians) targets.push(p.mesh);
  const hits = raycaster.intersectObjects(targets, true);
  const from = camera.position.clone();
  let to = from.clone().add(raycaster.ray.direction.clone().multiplyScalar(60));
  if (hits.length > 0) {
    to = hits[0].point.clone();
    let top = hits[0].object;
    while (top.parent && top.parent !== scene) top = top.parent;
    const gang = people.gang.find((g) => g.mesh === top);
    const ped = people.pedestrians.find((p) => p.mesh === top);
    if (gang) {
      gang.health -= 34;
      if (gang.health <= 0) { people.removeGangMember(gang); player.cash += 50; }
    } else if (ped) {
      // Hitting a pedestrian is a crime; they fall and the crowd scatters.
      scene.remove(ped.mesh);
      people.pedestrians.splice(people.pedestrians.indexOf(ped), 1);
      raiseWanted(Math.min(5, wanted + 1));
    }
  }
  // Tracer line from the player's gun to the hit point.
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(player.x, 1.4, player.z), to,
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }));
  scene.add(line);
  tracers.push({ line, t: 0.09 });
  const flash = new THREE.PointLight(0xffcc66, 30, 8, 2);
  flash.position.set(player.x, 1.5, player.z);
  scene.add(flash);
  tracers.push({ line: flash, t: 0.06, isLight: true });
}

function punch() {
  player.punchT = 0.3;
  audio.punch();
  for (const g of [...people.gang]) {
    if (Math.hypot(g.x - player.x, g.z - player.z) < 2.2) {
      g.health -= 25;
      g.x += Math.sin(player.heading) * 1.2;
      g.z += Math.cos(player.heading) * 1.2;
      if (g.health <= 0) { people.removeGangMember(g); player.cash += 50; }
    }
  }
  for (const p of [...people.pedestrians]) {
    if (Math.hypot(p.x - player.x, p.z - player.z) < 2) {
      people.scare(player.x, player.z, 10);
      raiseWanted(Math.min(5, wanted + 1));
    }
  }
}

function updatePlayer(dt) {
  const mv = input.moveVector();
  const mouse = input.consumeMouse();
  camYaw -= mouse.dx * 0.0032;
  camPitch = THREE.MathUtils.clamp(camPitch + mouse.dy * 0.0022, 0.05, 1.1);

  if (driving && playerCar) {
    const autoDrive = SHOT === 'drive' || SHOT === 'chase'; // headless shots: hold the throttle
    const throttle = autoDrive ? 1 : (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) + (input.down('KeyS') || input.down('ArrowDown') ? -1 : 0);
    const steer = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0) + (input.down('KeyD') || input.down('ArrowRight') ? -1 : 0);
    speedKmh = vehicles.drivePlayerCar(playerCar, throttle, steer, dt);
    player.x = playerCar.x; player.z = playerCar.z;
    player.heading = playerCar.heading;
    audio.engine(Math.abs(throttle) > 0 ? 0.5 + Math.min(0.5, Math.abs(playerCar.speed) / 25) : 0.08);
    // Speeding past police raises wanted.
    if (speedKmh > 90) {
      for (const p of vehicles.police) {
        if (Math.hypot(p.x - player.x, p.z - player.z) < 18) raiseWanted(Math.max(wanted, 1));
      }
    }
    // Running over pedestrians.
    for (const p of [...people.pedestrians]) {
      if (Math.hypot(p.x - playerCar.x, p.z - playerCar.z) < 2.1 && Math.abs(playerCar.speed) > 2) {
        scene.remove(p.mesh);
        people.pedestrians.splice(people.pedestrians.indexOf(p), 1);
        people.scare(player.x, player.z, 16);
        raiseWanted(Math.min(5, wanted + 1));
        audio.crash();
      }
    }
    // Police ramming the player car hurts.
    for (const p of vehicles.police) {
      if (Math.hypot(p.x - playerCar.x, p.z - playerCar.z) < 3.2) {
        player.health -= 6 * dt;
        audio.crash();
      }
    }
    if (input.down('KeyE') && !updatePlayer._eLock) { updatePlayer._eLock = true; exitCar(); }
    if (!input.down('KeyE')) updatePlayer._eLock = false;
  } else {
    audio.engine(0);
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? 9 : 5;
    // Movement is relative to the camera yaw.
    const fwdX = Math.sin(camYaw), fwdZ = Math.cos(camYaw);
    const rightX = Math.cos(camYaw), rightZ = -Math.sin(camYaw);
    const mx = fwdX * mv.z + rightX * mv.x;
    const mz = fwdZ * mv.z + rightZ * mv.x;
    const moving = Math.hypot(mx, mz) > 0.01;
    if (moving) {
      const nx = player.x + mx * speed * dt;
      const nz = player.z + mz * speed * dt;
      if (!city.isBlocked(nx, nz, 0.6)) { player.x = nx; player.z = nz; }
      player.heading = Math.atan2(mx, mz);
      player.walkPhase += dt * (run ? 11 : 7);
      player.speed = speed;
    } else player.speed = 0;
    // Jump.
    if (input.down('Space') && playerMesh.position.y <= 0.01) {
      playerMesh.position.y = 0.01;
      player._vy = 7;
    }
    if (player._vy !== undefined) {
      playerMesh.position.y += player._vy * dt;
      player._vy -= 22 * dt;
      if (playerMesh.position.y <= 0) { playerMesh.position.y = 0; player._vy = undefined; }
    }
    // Enter a nearby parked car.
    const near = vehicles.nearestParked(player.x, player.z, 4);
    if (near && input.down('KeyE') && !updatePlayer._eLock) {
      updatePlayer._eLock = true;
      enterCar(near);
    }
    if (!input.down('KeyE')) updatePlayer._eLock = false;
    // Combat on foot.
    if (input.consumeClick() && player.shootT <= 0) shoot();
    if (input.down('KeyF') && player.punchT <= 0) punch();
    if (input.down('KeyR') && player.reloadT <= 0 && player.reserveAmmo > 0 && player.ammo < 24) {
      player.reloadT = 0.9;
      const need = 24 - player.ammo;
      const take = Math.min(need, player.reserveAmmo);
      player.ammo += take; player.reserveAmmo -= take;
      audio.pickup();
    }
    if (player.shootT > 0) player.shootT -= dt;
    if (player.punchT > 0) player.punchT -= dt;
    if (player.reloadT > 0) player.reloadT -= dt;
  }

  playerMesh.position.x = player.x;
  playerMesh.position.z = player.z;
  playerMesh.rotation.y = player.heading;
  const swing = Math.sin(player.walkPhase) * 0.5 * (player.speed > 0 ? 1 : 0);
  playerMesh.userData.legL.rotation.x = swing;
  playerMesh.userData.legR.rotation.x = -swing;
  playerMesh.userData.armL.rotation.x = -swing * 0.7;
  playerMesh.userData.armR.rotation.x = swing * 0.7;
  if (player.punchT > 0.15) playerMesh.userData.armR.rotation.x = -1.6;

  // Gang members shoot the player when close.
  for (const g of people.gang) {
    if (g.shootT <= 0) {
      g.shootT = 1.6;
      const d = Math.hypot(g.x - player.x, g.z - player.z);
      if (d < 26 && rng.next() < 0.55) {
        player.health -= 8;
        audio.gunshot();
        wantedFlash = timeSec;
      }
    }
  }

  if (player.health <= 0) {
    document.getElementById('death').style.display = 'flex';
    paused = true;
  }
}

function updateCamera(dt) {
  const target = new THREE.Vector3(player.x, 1.6, player.z);
  let yaw = driving && playerCar ? playerCar.heading + Math.PI : camYaw;
  // Chase shot: camera ahead of the car, looking back at it and the cruisers behind.
  if (SHOT === 'chase' && driving && playerCar) yaw = playerCar.heading + 0.35;
  const cx = target.x + Math.sin(yaw) * camDist * Math.cos(camPitch);
  const cz = target.z + Math.cos(yaw) * camDist * Math.cos(camPitch);
  const cy = target.y + Math.sin(camPitch) * camDist + 1.2;
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), 1 - Math.pow(0.0001, dt));
  camera.lookAt(target);
}

function updateWanted(dt) {
  syncPolice();
  if (wanted > 0) {
    const nearestPolice = vehicles.police.reduce((m, p) => Math.min(m, Math.hypot(p.x - player.x, p.z - player.z)), Infinity);
    if (nearestPolice > 45 && timeSec - lastCrimeT > 6) {
      layLowT += dt;
      if (layLowT > 15) { wanted--; layLowT = 0; lastCrimeT = timeSec; }
    } else layLowT = 0;
  }
}

const clock = new THREE.Clock();
let frames = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  timeSec += dt;
  frames++;
  if (frames === 5) window.__shotReady = true;

  if (started && !paused) {
    elapsed += dt;
    clockMinutes += dt * 0.5; // 1 game minute per 2 real seconds
    updatePlayer(dt);
    vehicles.update(dt, player, wanted, timeSec);
    people.update(dt, player, player.speed, timeSec);
    missions.update(dt, player, wanted);
    updateWanted(dt);
    // Tracers fade.
    for (const t of [...tracers]) {
      t.t -= dt;
      if (t.t <= 0) {
        scene.remove(t.line);
        if (t.isLight) t.line.dispose?.();
        tracers.splice(tracers.indexOf(t), 1);
      } else if (!t.isLight) t.line.material.opacity = t.t / 0.09 * 0.9;
    }
    // Periodic autosave.
    saveT += dt;
    if (saveT > 30) { saveT = 0; saveGame(); }
    // HUD.
    const near = driving ? null : vehicles.nearestParked(player.x, player.z, 4);
    hud.update({
      health: player.health, cash: player.cash, wanted,
      clockMinutes, objective: missions.objective,
      driving, speedKmh, nearCar: !!near,
      ammo: player.ammo, reserveAmmo: player.reserveAmmo,
      dialogue: missions.dialogueT > 0 ? missions.dialogue : '',
      hint: driving ? 'W/S drive • A/D steer • E exit • Esc pause' : 'WASD move • Shift run • Space jump • E enter car • Click shoot • F punch',
      wantedFlash,
      playerX: player.x, playerZ: player.z, playerHeading: player.heading,
      missionTarget: missions.target,
      traffic: vehicles.traffic, police: vehicles.police,
    });
  }
  if (SHOT === 'start' && !started) camYaw += dt * 0.06; // slow orbit behind the title screen
  updateCamera(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- start / pause / death / complete overlays ---
const startOverlay = document.getElementById('start');
document.getElementById('start-btn').addEventListener('click', () => {
  audio.ensure(); audio.startMusic();
  input.requestLock();
  startOverlay.style.display = 'none';
  started = true;
  loadGame();
  saveGame();
});
document.getElementById('continue-btn').addEventListener('click', () => {
  audio.ensure(); audio.startMusic();
  input.requestLock();
  startOverlay.style.display = 'none';
  started = true;
  loadGame();
  saveGame();
});
document.getElementById('resume-btn').addEventListener('click', () => {
  paused = false;
  document.getElementById('pause').style.display = 'none';
  input.requestLock();
});
document.getElementById('respawn-btn').addEventListener('click', () => { respawn(); paused = false; });
document.getElementById('again-btn').addEventListener('click', () => {
  document.getElementById('complete').style.display = 'none';
  allDone = false;
  missions.loadState({ index: 0, completed: [false, false, false] });
  player.cash = 250;
  saveGame();
});
window.addEventListener('keydown', (e) => {
  if ((e.code === 'Escape' || e.code === 'KeyP') && started && !allDone) {
    paused = !paused;
    document.getElementById('pause').style.display = paused ? 'flex' : 'none';
    if (paused) saveGame();
  }
  if (e.code === 'KeyM') { audio.muted = !audio.muted; }
});

// --- deterministic shot setups ---
const shotApi = {
  startGame() {
    audio.ensure();
    startOverlay.style.display = 'none';
    started = true;
  },
  teleport(x, z, heading) { player.x = x; player.z = z; player.heading = heading ?? player.heading; },
  enterNearestCar() {
    const car = vehicles.nearestParked(player.x, player.z, 60) || vehicles.parked[0];
    if (car) { player.x = car.x; player.z = car.z; enterCar(car); }
  },
  setWanted(n) { raiseWanted(n, true); syncPolice(); },
  setMission(i) { missions.loadState({ index: i, completed: [false, false, false].map((_, j) => j < i) }); },
  setCash(n) { player.cash = n; },
  setClock(m) { clockMinutes = m; },
  setCam(yaw, pitch, dist) { camYaw = yaw; camPitch = pitch; camDist = dist; },
  spawnPoliceAt(n) { vehicles.spawnPolice(n, player.x, player.z); },
};
if (SHOT) applyShot(SHOT, shotApi, { city, vehicles, people, missions, player });

loop();
window.__neonBay = { player, missions, vehicles, city, get wanted() { return wanted; }, get frames() { return frames; }, get timeSec() { return timeSec; }, get started() { return started; }, get paused() { return paused; } };
