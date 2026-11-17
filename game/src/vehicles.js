// Vehicles: stealable parked cars, AI traffic on the road grid, and police
// cruisers that chase and ram the player when wanted.
import * as THREE from 'three';
import { GRID, CITY_EDGE } from './city.js';

const CAR_COLORS = [0xd64545, 0x3f7fd6, 0xe8c33a, 0x8e44ad, 0x2ecc71, 0xe67e22, 0xecf0f1, 0x1abc9c];

function buildCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.15, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 4.4), paint);
  body.position.y = 0.65; body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), glass);
  cabin.position.set(0, 1.25, -0.2); cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w); wheels.push(w);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.1), headMat);
    h.position.set(x, 0.7, 2.22); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.1), tailMat);
    t.position.set(x, 0.7, -2.22); g.add(t);
  }
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    red.position.x = -0.4;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.4;
    lightBar.add(red); lightBar.add(blue);
    lightBar.position.set(0, 1.7, -0.2);
    lightBar.userData = { red, blue };
    g.add(lightBar);
  }
  g.userData.wheels = wheels;
  g.userData.lightBar = lightBar;
  return g;
}

export class VehicleSystem {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.traffic = [];
    this.parked = [];
    this.police = [];
    this.playerCar = null; // the car the player is driving, or null
    this.flashT = 0;
  }

  _spawnCar(kind, x, z, heading, isPolice) {
    const color = isPolice ? 0x1a1a1a : this.rng.pick(CAR_COLORS);
    const mesh = buildCarMesh(color, isPolice);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = {
      kind, mesh, color, isPolice,
      x, z, heading,
      speed: 0, maxSpeed: kind === 'police' ? 26 : 12,
      // traffic: which grid road + direction it follows
      road: null, dir: 1, axis: 'x',
      targetSpeed: 10,
      siren: isPolice,
    };
    if (kind === 'traffic') {
      car.axis = this.rng.chance(0.5) ? 'x' : 'z';
      car.road = this.rng.pick(GRID);
      car.dir = this.rng.chance(0.5) ? 1 : -1;
      if (car.axis === 'x') { car.z = car.road + 2.2; car.x = this.rng.range(-100, 100); }
      else { car.x = car.road + 2.2; car.z = this.rng.range(-100, 100); }
      car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.speed = this.rng.range(7, 11);
    }
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.heading;
    return car;
  }

  spawnTraffic(n) {
    for (let i = 0; i < n; i++) this.traffic.push(this._spawnCar('traffic', 0, 0, 0, false));
    return this.traffic;
  }

  spawnParked(n) {
    const spots = [];
    for (let i = 0; i < n; i++) {
      const road = this.rng.pick(GRID);
      const along = this.rng.range(-95, 95);
      const side = this.rng.pick([-1, 1]);
      let x, z, heading;
      if (this.rng.chance(0.5)) { x = road + side * 5.2; z = along; heading = side > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { x = along; z = road + side * 5.2; heading = side > 0 ? 0 : Math.PI; }
      const car = this._spawnCar('parked', x, z, heading, false);
      car.speed = 0;
      this.parked.push(car);
      spots.push(car);
    }
    return spots;
  }

  // Nearest parked (stealable) car within range of a point.
  nearestParked(x, z, maxDist = 4) {
    let best = null, bestD = maxDist;
    for (const c of this.parked) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  spawnPolice(n, nearX, nearZ) {
    const made = [];
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(28, 42);
      const x = THREE.MathUtils.clamp(nearX + Math.cos(a) * d, -100, 100);
      const z = THREE.MathUtils.clamp(nearZ + Math.sin(a) * d, -100, 100);
      const car = this._spawnCar('police', x, z, 0, true);
      car.speed = 14;
      this.police.push(car);
      made.push(car);
    }
    return made;
  }

  removePoliceExtra(keep) {
    while (this.police.length > keep) {
      const c = this.police.pop();
      this.scene.remove(c.mesh);
    }
  }

  // Drive the player car from input: throttle -1..1, steer -1..1.
  drivePlayerCar(car, throttle, steer, dt) {
    const accel = 16, brake = 26, drag = 0.6;
    if (throttle > 0) car.speed += accel * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= brake * dt;
      else car.speed += accel * 0.45 * throttle * dt; // reverse
    } else {
      car.speed -= Math.sign(car.speed) * drag * 4 * dt;
      if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }
    car.speed = THREE.MathUtils.clamp(car.speed, -9, car.maxSpeed + 8);
    const turnRate = 1.9 * Math.min(1, Math.abs(car.speed) / 8);
    car.heading += steer * turnRate * Math.sign(car.speed) * dt;
    this._moveCar(car, dt);
    const wheels = car.mesh.userData.wheels;
    if (wheels) for (const w of wheels) w.rotation.x += car.speed * dt * 2.2;
    return Math.abs(car.speed) * 3.6; // km/h
  }

  _moveCar(car, dt) {
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (this.city.isBlocked(nx, nz, 1.6)) {
      car.speed *= -0.25; // bounce off a building
      return;
    }
    car.x = THREE.MathUtils.clamp(nx, -CITY_EDGE - 4, CITY_EDGE + 8);
    car.z = THREE.MathUtils.clamp(nz, -CITY_EDGE - 4, 130);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }

  update(dt, playerPos, wanted, time) {
    // --- traffic: follow the grid, slow for the car ahead, turn at edges ---
    for (const c of this.traffic) {
      let ahead = Infinity;
      for (const o of this.traffic) {
        if (o === c) continue;
        if (o.axis !== c.axis || o.road !== c.road || o.dir !== c.dir) continue;
        const along = c.axis === 'x' ? o.x - c.x : o.z - c.z;
        const gap = along * c.dir;
        if (gap > 0 && gap < ahead) ahead = gap;
      }
      const want = ahead < 9 ? Math.max(0, (ahead - 5) * 0.8) : c.targetSpeed;
      c.speed += THREE.MathUtils.clamp(want - c.speed, -8 * dt, 4 * dt);
      const step = c.speed * c.dir * dt;
      if (c.axis === 'x') {
        c.x += step;
        if (c.x > 104 || c.x < -104) {
          // U-turn onto the parallel road one block over.
          c.dir *= -1;
          c.road = THREE.MathUtils.clamp(c.road + (this.rng.chance(0.5) ? 30 : -30), -90, 90);
          c.z = c.road + 2.2;
          c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          c.x = THREE.MathUtils.clamp(c.x, -100, 100);
        }
      } else {
        c.z += step;
        if (c.z > 104 || c.z < -104) {
          c.dir *= -1;
          c.road = THREE.MathUtils.clamp(c.road + (this.rng.chance(0.5) ? 30 : -30), -90, 90);
          c.x = c.road + 2.2;
          c.heading = c.dir > 0 ? 0 : Math.PI;
          c.z = THREE.MathUtils.clamp(c.z, -100, 100);
        }
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }

    // --- police: chase the player, ram, flash light bars ---
    this.flashT += dt;
    const flashOn = Math.floor(this.flashT * 6) % 2 === 0;
    for (const p of this.police) {
      const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += THREE.MathUtils.clamp(dh, -2.4 * dt, 2.4 * dt);
      const wantSpeed = dist > 4 ? p.maxSpeed : 6;
      p.speed += THREE.MathUtils.clamp(wantSpeed - p.speed, -10 * dt, 8 * dt);
      this._moveCar(p, dt);
      const bar = p.mesh.userData.lightBar;
      if (bar) {
        bar.userData.red.material.color.setHex(flashOn ? 0xff0000 : 0x330000);
        bar.userData.blue.material.color.setHex(flashOn ? 0x001133 : 0x2266ff);
      }
    }
    if (this.playerCar) {
      const wheels = this.playerCar.mesh.userData.wheels;
      if (wheels) for (const w of wheels) w.rotation.x += this.playerCar.speed * dt * 2.2;
    }
  }
}
