// Neon Bay — main game: open-world crime game built on three.js.
// Player on foot and by car, traffic, pedestrians, police, wanted level,
// three story missions, combat, HUD + minimap, save/load, synthesized audio.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { SoundBank } from './audio.js';
import { buildCity, CITY, nearestRoadPoint } from './city.js';
import { makeCarMesh, Car, driveCar, Traffic, Police } from './vehicles.js';
import { makePersonMesh, Crowd } from './people.js';
import { MISSIONS, ObjectiveMarker, MissionManager } from './missions.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { applyShotMode, currentShot } from './shots.js';

const SAVE_KEY = 'neon-bay-save-v1';

class NeonBayGame {
  constructor() {
    const { shot, seed } = currentShot();
    this.shotMode = shot;
    this.rng = mulberry32(seed || 7);
    this.sound = new SoundBank();
    this.input = new Input(document.getElementById('scene'));
    this.hud = new HUD();
    this.state = 'title'; // title | playing | paused
    this.orbitCam = false;
    this.cameraMode = 'follow';
    this.time = 0;
    this.clockMinutes = 19 * 60 + 42;
    this.cash = 250;
    this.health = 100;
    this.ammo = 24;
    this.wanted = 0;
    this.crimeTimer = 0;
    this.decayTimer = 0;
    this.inCar = false;
    this.playerCar = null;
    this.carName = '';
    this.carNames = ['Comet GT', 'Sunset Cruiser', 'Bay Runner', 'Neon Coupe', 'Harbor Van'];
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.damageCooldown = 0;
    this.raycaster = new THREE.Raycaster();
    this.tracer = null;
    this.tracerLife = 0;

    this.setupRenderer();
    this.setupWorld();
    this.setupPlayer();
    this.setupMissions();
    this.wireButtons();
    this.loadSaveIfShot();

    // Deterministic screenshot mode wins over the title screen.
    if (this.shotMode) {
      applyShotMode(this, this.shotMode);
    } else {
      this.showTitle();
    }
    this.loop(0);
  }

  setupRenderer() {
    const canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b2a52);
    this.scene.fog = new THREE.Fog(0x1b2a52, 120, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 40, 90);
    // Sunset lighting: warm sun low in the west, cool sky fill.
    const hemi = new THREE.HemisphereLight(0x8fb8ff, 0x2a1a2e, 1.05);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xff9a3d, 2.0);
    sun.position.set(-120, 70, -40);
    this.scene.add(sun);
    const amb = new THREE.AmbientLight(0x445577, 0.85);
    this.scene.add(amb);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupWorld() {
    const city = buildCity(this.scene, this.rng);
    this.city = city;
    this.traffic = new Traffic(this.scene, this.rng, 16);
    this.crowd = new Crowd(this.scene, this.rng, 34);
    this.police = new Police(this.scene);
    // Parked stealable cars near the spawn.
    this.parked = [];
    const spots = [[12, 22], [-14, 30], [22, -20], [-24, -44], [34, 44]];
    for (let i = 0; i < spots.length; i++) {
      const mesh = makeCarMesh([0xff4757, 0x2ed573, 0x1e90ff, 0xffa502, 0xeccc68][i], false);
      this.scene.add(mesh);
      const car = new Car(mesh, spots[i][0], spots[i][1], (i % 2 ? Math.PI / 2 : 0));
      car.speed = 0;
      car.name = this.carNames[i];
      car.sync();
      this.parked.push(car);
    }
  }

  setupPlayer() {
    this.player = {
      x: 0, z: 34, heading: Math.PI, speed: 0,
      mesh: makePersonMesh(0x2ee6ff, 0xf1c27d, false),
      walkPhase: 0,
    };
    this.scene.add(this.player.mesh);
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.player.mesh.position.set(0, 0, 34);
  }

  setupMissions() {
    this.marker = new ObjectiveMarker(this.scene);
    this.missions = new MissionManager(this.marker);
    this.missions.onEvent = (ev, data) => {
      if (ev === 'dialogue') this.hud.showDialogue(data, 8000);
      else if (ev === 'objective') this.hud.showMessage(data);
      else if (ev === 'reward') {
        this.cash += data;
        this.sound.cash();
        this.hud.showMessage(`+$${data} — job paid`, 3000);
      } else if (ev === 'start') {
        if (data.onStart === 'gang') {
          this.crowd.addGang(data.target.x, data.target.z, 4);
          this.hud.showMessage('Red Vipers spotted near the package!');
        }
        if (data.onStart === 'wanted3') {
          this.setWanted(3);
          this.spawnPoliceNear(3);
        }
      } else if (ev === 'finished') {
        this.hud.showDialogue('<b>MARA:</b> "That\'s the night, Rico. Neon Bay is yours now — go enjoy it."', 10000);
        this.hud.showMessage('ALL MISSIONS COMPLETE — FREE ROAM!', 5000);
      }
    };
  }

  wireButtons() {
    document.getElementById('startbtn').addEventListener('click', () => this.startGame());
    document.getElementById('resumebtn').addEventListener('click', () => this.togglePause(false));
    document.getElementById('savebtn').addEventListener('click', () => { this.saveGame(); this.hud.showMessage('Game saved.'); });
    document.getElementById('loadbtn').addEventListener('click', () => { this.loadGame(); this.hud.showMessage('Game loaded.'); });
  }

  showTitle() {
    document.getElementById('start').style.display = 'flex';
    this.hud.hide();
  }

  startGame() {
    this.sound.ensure();
    this.sound.startMusic();
    this.sound.engineStart();
    document.getElementById('start').style.display = 'none';
    document.getElementById('pause').style.display = 'none';
    this.hud.show();
    this.state = 'playing';
    if (!this.missionsStarted) {
      this.missionsStarted = true;
      this.missions.start();
    }
  }

  togglePause(force) {
    const toPause = force !== undefined ? force : this.state === 'playing';
    if (toPause && this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pause').style.display = 'flex';
    } else if (!toPause && this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pause').style.display = 'none';
    }
  }

  // --- Wanted level ---
  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.crimeTimer = 0;
    this.decayTimer = 0;
    if (this.wanted > 0) this.sound.sirenStart();
    else { this.sound.sirenStop(); this.police.clear(); }
  }
  addWanted(n) {
    this.setWanted(this.wanted + n);
    this.spawnPoliceNear(this.wanted);
    this.crimeTimer = 0;
  }
  spawnPoliceNear(n) {
    while (this.police.count() < n) {
      const a = this.rng() * Math.PI * 2;
      const d = 45 + this.rng() * 25;
      this.police.spawn(this.playerX() + Math.sin(a) * d, this.playerZ() + Math.cos(a) * d);
    }
  }

  playerX() { return this.inCar ? this.playerCar.x : this.player.x; }
  playerZ() { return this.inCar ? this.playerCar.z : this.player.z; }

  // --- Cars ---
  nearestCar(maxD) {
    let best = null, bestD = maxD;
    const px = this.player.x, pz = this.player.z;
    for (const c of [...this.traffic.cars, ...this.parked]) {
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }
  enterNearestCar(free) {
    const car = this.nearestCar(8);
    if (!car) { this.hud.showMessage('No car close enough — walk up to one and press E.'); return; }
    this.inCar = true;
    this.playerCar = car;
    this.carName = car.name || this.carNames[Math.floor(this.rng() * this.carNames.length)];
    this.player.mesh.visible = false;
    this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
    this.parked = this.parked.filter((c) => c !== car);
    if (!free) {
      this.addWanted(1);
      this.hud.showMessage(`Stole a ${this.carName}! The cops noticed.`);
      this.sound.crash();
    }
    this.sound.engineStart();
  }
  exitCar() {
    if (!this.playerCar) return;
    const car = this.playerCar;
    this.player.x = car.x - Math.sin(car.heading + Math.PI / 2) * 3;
    this.player.z = car.z - Math.cos(car.heading + Math.PI / 2) * 3;
    this.player.heading = car.heading;
    this.player.mesh.visible = true;
    car.speed = 0;
    this.traffic.cars.push(car);
    this.inCar = false;
    this.playerCar = null;
  }

  // --- Combat ---
  shoot() {
    if (this.ammo <= 0) { this.hud.showMessage('Out of ammo — press R to reload.'); return; }
    this.ammo--;
    this.sound.gunshot();
    this.shootCooldown = 0.28;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(this.camera.position, dir);
    this.raycaster.far = 90;
    const targets = this.crowd.peds.filter((p) => p.alive).map((p) => p.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    let end = this.camera.position.clone().add(dir.clone().multiplyScalar(90));
    if (hits.length) {
      end = hits[0].point;
      const hitPed = this.crowd.peds.find((p) => {
        let o = hits[0].object;
        while (o) { if (o === p.mesh) return true; o = o.parent; }
        return false;
      });
      if (hitPed) this.damagePed(hitPed, 34);
    }
    this.showTracer(this.camera.position.clone().add(dir.clone().multiplyScalar(1.5)), end);
    if (!this.shotCrimeDone) { this.addWanted(1); this.shotCrimeDone = true; setTimeout(() => { this.shotCrimeDone = false; }, 4000); }
  }
  showTracer(a, b) {
    if (this.tracer) this.scene.remove(this.tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066 }));
    this.scene.add(this.tracer);
    this.tracerLife = 0.08;
  }
  punch() {
    if (this.punchCooldown > 0) return;
    this.punchCooldown = 0.45;
    this.sound.punch();
    const px = this.player.x, pz = this.player.z;
    let best = null, bestD = 2.6;
    for (const p of this.crowd.peds) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best) {
      this.damagePed(best, 25);
      best.x += Math.sin(this.player.heading) * 1.5;
      best.z += Math.cos(this.player.heading) * 1.5;
    }
  }
  damagePed(ped, dmg) {
    ped.health -= dmg;
    if (ped.health <= 0) {
      ped.alive = false;
      if (!ped.gang) this.addWanted(1);
      else { this.cash += 50; this.hud.showMessage('Viper down — +$50'); }
      this.crowd.removeDead();
    }
  }

  // --- Save / load ---
  saveGame() {
    const data = {
      cash: this.cash, health: this.health, ammo: this.ammo,
      missionIndex: this.missions.index, finished: this.missions.finished,
      x: this.playerX(), z: this.playerZ(), wanted: this.wanted,
      clockMinutes: this.clockMinutes,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { this.hud.showMessage('No save found yet.'); return; }
      const d = JSON.parse(raw);
      this.cash = d.cash; this.health = d.health; this.ammo = d.ammo;
      this.clockMinutes = d.clockMinutes || 1182;
      this.missions.index = d.missionIndex || 0;
      this.missions.finished = !!d.finished;
      this.player.x = d.x || 0; this.player.z = d.z || 34;
      if (this.inCar) this.exitCar();
      this.setWanted(d.wanted || 0);
      this.missions.start();
    } catch (e) {}
  }
  loadSaveIfShot() {
    // Screenshot modes ignore saves for determinism.
  }

  // --- Collisions ---
  collideBuildings(x, z, r) {
    let nx = x, nz = z;
    for (const b of this.city.buildings) {
      const hw = b.w / 2 + r, hd = b.d / 2 + r;
      if (Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hd) {
        const dx = x - b.x, dz = z - b.z;
        const px = hw - Math.abs(dx), pz = hd - Math.abs(dz);
        if (px < pz) nx = b.x + Math.sign(dx || 1) * hw;
        else nz = b.z + Math.sign(dz || 1) * hd;
      }
    }
    return { x: nx, z: nz };
  }

  update(dt) {
    this.time += dt;
    this.clockMinutes += dt * 0.6;
    this.marker.update(dt);
    this.traffic.update(dt);
    this.crowd.update(dt, this.playerX(), this.playerZ());

    // Mouse look.
    const { dx, dy } = this.input.consumeMouse();
    this.camYaw -= dx * 0.0032;
    this.camPitch = Math.max(0.05, Math.min(0.9, this.camPitch + dy * 0.002));

    if (this.input.take('escape') || this.input.take('p')) this.togglePause();
    if (this.input.take('m')) {
      const on = this.sound.toggleMusic();
      this.hud.showMessage(on ? 'Music on' : 'Music off');
    }
    if (this.input.take('c')) this.cameraMode = this.cameraMode === 'follow' ? 'far' : 'follow';
    if (this.input.take('r')) { this.ammo = 24; this.hud.showMessage('Reloaded.'); }

    if (this.state !== 'playing') return;

    // Enter / exit car.
    if (this.input.take('e')) {
      if (this.inCar) this.exitCar();
      else this.enterNearestCar(false);
    }
    if (this.input.take('f') && !this.inCar) this.punch();
    if (this.input.consumeClick() && !this.inCar) this.shoot();

    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);

    // --- Movement ---
    // In deterministic driving screenshot modes the car keeps driving on its own.
    if ((this.shotMode === 'drive' || this.shotMode === 'chase') && this.inCar) this.input.forward = true;
    if (this.inCar && this.playerCar) {
      driveCar(this.playerCar, this.input, dt);
      const fixed = this.collideBuildings(this.playerCar.x, this.playerCar.z, 2.2);
      if (fixed.x !== this.playerCar.x || fixed.z !== this.playerCar.z) {
        this.playerCar.speed *= 0.3;
        this.sound.crash();
      }
      this.playerCar.x = fixed.x; this.playerCar.z = fixed.z;
      this.playerCar.sync();
      this.sound.engineSet(Math.abs(this.playerCar.speed) / 34, true);
      // Hitting a pedestrian while driving.
      for (const p of this.crowd.peds) {
        if (!p.alive || p.gang) continue;
        if (Math.hypot(p.x - this.playerCar.x, p.z - this.playerCar.z) < 2.4 && Math.abs(this.playerCar.speed) > 4) {
          this.damagePed(p, 200);
          this.hud.showMessage('You hit a pedestrian! Wanted up.');
          this.sound.crash();
        }
      }
      // Police ram the player car.
      for (const pc of this.police.cars) {
        if (Math.hypot(pc.x - this.playerCar.x, pc.z - this.playerCar.z) < 3.4) {
          this.playerCar.speed *= 0.96;
          if (this.damageCooldown <= 0) { this.health -= 3; this.damageCooldown = 0.8; }
        }
      }
    } else {
      const speed = this.input.run ? 9 : 5;
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      let mx = 0, mz = 0;
      if (this.input.forward) { mx -= sin; mz -= cos; }
      if (this.input.back) { mx += sin; mz += cos; }
      if (this.input.left) { mx -= cos; mz += sin; }
      if (this.input.right) { mx += cos; mz -= sin; }
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        mx /= len; mz /= len;
        this.player.x += mx * speed * dt;
        this.player.z += mz * speed * dt;
        this.player.heading = Math.atan2(mx, mz);
        this.player.walkPhase += dt * 10;
      }
      const fixed = this.collideBuildings(this.player.x, this.player.z, 0.7);
      this.player.x = fixed.x; this.player.z = fixed.z;
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      this.player.mesh.rotation.y = this.player.heading;
      const s = Math.sin(this.player.walkPhase) * (len > 0 ? 0.5 : 0);
      this.player.mesh.userData.legL.rotation.x = s;
      this.player.mesh.userData.legR.rotation.x = -s;
      this.sound.engineSet(0, false);
      // Gang members attack on foot.
      for (const p of this.crowd.peds) {
        if (!p.alive || !p.gang) continue;
        if (Math.hypot(p.x - this.player.x, p.z - this.player.z) < 2 && this.damageCooldown <= 0) {
          this.health -= 8;
          this.damageCooldown = 0.9;
          this.hud.showMessage('A Viper is beating you down!');
        }
      }
      // Police on foot contact.
      for (const pc of this.police.cars) {
        if (Math.hypot(pc.x - this.player.x, pc.z - this.player.z) < 3 && this.damageCooldown <= 0) {
          this.health -= 6;
          this.damageCooldown = 0.8;
        }
      }
    }

    // --- Wanted decay: lay low and the heat cools off. ---
    if (this.wanted > 0) {
      this.crimeTimer += dt;
      if (this.crimeTimer > 18) {
        this.decayTimer += dt;
        if (this.decayTimer > 8) {
          this.decayTimer = 0;
          this.setWanted(this.wanted - 1);
          if (this.wanted > 0) this.hud.showMessage(`Heat cooling… wanted level ${this.wanted}`);
          else this.hud.showMessage('You lost the cops. Heat is off.');
        }
      }
    }
    this.police.update(dt, this.playerX(), this.playerZ(), this.wanted);

    // --- Missions ---
    this.missions.update(this.playerX(), this.playerZ(), this.wanted);

    // --- Death / respawn ---
    if (this.health <= 0) {
      this.health = 100;
      this.cash = Math.max(0, this.cash - 100);
      this.setWanted(0);
      if (this.inCar) this.exitCar();
      this.player.x = 0; this.player.z = 34;
      this.hud.showMessage('You woke up at St. Marina Hospital — $100 bill.', 5000);
      this.hud.showDialogue('<b>DOCTOR:</b> "Take it easy, Rico. The Bay isn\'t done with you yet."', 6000);
    }

    // --- HUD ---
    const px = this.playerX(), pz = this.playerZ();
    this.hud.update({
      cash: this.cash, health: this.health, wanted: this.wanted, ammo: this.ammo,
      clockMinutes: this.clockMinutes,
      missionLabel: this.missions.label(), missionObjective: this.missions.objectiveText(),
      speedMph: (this.inCar ? Math.abs(this.playerCar.speed) : 0) * 2.24,
      inCar: this.inCar, carName: this.carName,
      px, pz, heading: this.inCar ? this.playerCar.heading : this.player.heading,
      trafficCars: this.traffic.cars, policeCars: this.police.cars,
      missionTarget: this.missions.targetPos(), time: this.time,
    });
    this.hud.drawMinimap({
      px, pz, heading: this.inCar ? this.playerCar.heading : this.player.heading,
      trafficCars: this.traffic.cars, policeCars: this.police.cars,
      missionTarget: this.missions.targetPos(), time: this.time,
    });
    if (this.tracerLife > 0) {
      this.tracerLife -= dt;
      if (this.tracerLife <= 0 && this.tracer) { this.scene.remove(this.tracer); this.tracer = null; }
    }
  }

  updateCamera(dt) {
    if (this.orbitCam || this.state === 'title') {
      const a = this.time * 0.07;
      this.camera.position.set(Math.sin(a) * 110, 46, Math.cos(a) * 110);
      this.camera.lookAt(0, 6, 0);
      return;
    }
    const dist = this.cameraMode === 'far' ? 17 : 10;
    const height = this.cameraMode === 'far' ? 8 : 4.5;
    let tx, tz, yaw, behind;
    if (this.inCar && this.playerCar) {
      yaw = this.playerCar.heading;
      tx = this.playerCar.x; tz = this.playerCar.z;
      behind = -1; // car forward is (sin h, cos h); camera sits behind it
    } else {
      yaw = this.camYaw;
      tx = this.player.x; tz = this.player.z;
      behind = 1; // on foot, forward is (-sin yaw, -cos yaw); camera sits behind
    }
    const cx = tx + behind * Math.sin(yaw) * dist;
    const cz = tz + behind * Math.cos(yaw) * dist;
    const k = this.shotMode ? 1 : 1 - Math.pow(0.0001, dt);
    this.camera.position.x += (cx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (cz - this.camera.position.z) * k;
    this.camera.lookAt(tx, 2.2, tz);
  }

  loop(t) {
    requestAnimationFrame((nt) => this.loop(nt));
    const now = t / 1000;
    let dt = Math.min(0.05, now - (this.lastT || now));
    this.lastT = now;
    if (!(dt > 0)) dt = 0.016;
    this.update(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

new NeonBayGame();
