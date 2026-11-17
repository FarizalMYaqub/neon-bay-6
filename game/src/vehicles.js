// Vehicles: player-drivable cars, AI traffic and police cruisers.
import * as THREE from 'three';
import { range, pick } from './rng.js';
import { CITY, nearestRoadPoint } from './city.js';

const CAR_COLORS = [0xff4757, 0x2ed573, 0x1e90ff, 0xffa502, 0xeccc68, 0x70a1ff, 0x5352ed, 0xffffff, 0x2f3542];

// Build one low-poly car mesh. `police` adds a light bar.
export function makeCarMesh(color, police) {
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x0e2233 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.12, -0.25);
  car.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    car.add(w);
    wheels.push(w);
  }
  // Headlights.
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const s of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), hlMat);
    hl.position.set(s, 0.6, 2.22);
    car.add(hl);
  }
  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    r.position.x = -0.45;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    b.position.x = 0.45;
    lightBar.add(r); lightBar.add(b);
    lightBar.position.y = 1.55;
    car.add(lightBar);
    car.userData.barR = r; car.userData.barB = b;
  }
  car.userData.wheels = wheels;
  car.userData.lightBar = lightBar;
  return car;
}

export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.heading = heading || 0;
    this.speed = 0;
    this.steer = 0;
  }
  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016 / 0.36;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }
}

// Arcade driving: accel, brake/reverse, steering that scales with speed.
export function driveCar(car, input, dt) {
  const maxSpeed = 34;
  const accel = input.forward ? 16 : 0;
  const brake = input.back ? 22 : 0;
  car.speed += (accel - brake) * dt;
  car.speed -= car.speed * 0.55 * dt; // drag
  if (!input.forward && !input.back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = Math.max(-10, Math.min(maxSpeed, car.speed));
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const dir = car.speed >= 0 ? 1 : -1;
  car.heading += car.steer * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 8) * dir;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // Keep inside the city.
  const lim = CITY.half + 20;
  car.x = Math.max(-lim, Math.min(lim, car.x));
  car.z = Math.max(-lim - 40, Math.min(lim, car.z));
  car.sync();
}

// --- Traffic ---
export class Traffic {
  constructor(scene, rng, count) {
    this.cars = [];
    this.rng = rng;
    for (let i = 0; i < count; i++) {
      const p = nearestRoadPoint(range(rng, -CITY.half, CITY.half), range(rng, -CITY.half, CITY.half));
      const mesh = makeCarMesh(pick(rng, CAR_COLORS), false);
      scene.add(mesh);
      const car = new Car(mesh, p.x, p.z, rng() < 0.5 ? 0 : Math.PI / 2);
      car.speed = range(rng, 7, 12);
      car.axis = rng() < 0.5 ? 'x' : 'z';
      car.dir = rng() < 0.5 ? 1 : -1;
      car.sync();
      this.cars.push(car);
    }
  }
  update(dt) {
    for (const car of this.cars) {
      if (car.axis === 'x') car.x += car.dir * car.speed * dt;
      else car.z += car.dir * car.speed * dt;
      const lim = CITY.half + 10;
      if (car.x > lim) car.x = -lim;
      if (car.x < -lim) car.x = lim;
      if (car.z > lim) car.z = -lim;
      if (car.z < -lim) car.z = lim;
      car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.sync();
    }
  }
}

// --- Police ---
export class Police {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.flash = 0;
  }
  // Spawn a cruiser near the player.
  spawn(x, z) {
    const mesh = makeCarMesh(0x1a1a2e, true);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.12, 4.42),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    stripe.position.y = 0.62;
    mesh.add(stripe);
    this.scene.add(mesh);
    const car = new Car(mesh, x, z, 0);
    car.speed = 0;
    this.cars.push(car);
    return car;
  }
  // Chase the player: steer toward them, ram speed.
  update(dt, px, pz, wanted) {
    this.flash += dt * 8;
    const on = Math.sin(this.flash) > 0;
    for (const car of this.cars) {
      const dx = px - car.x, dz = pz - car.z;
      const dist = Math.hypot(dx, dz) || 1;
      const target = Math.atan2(dx, dz);
      let dh = target - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      const want = wanted > 0 ? 26 + wanted * 1.5 : 0;
      car.speed += ((dist > 6 ? want : want * 0.4) - car.speed) * Math.min(1, dt * 1.2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.sync();
      if (car.mesh.userData.barR) {
        car.mesh.userData.barR.material.color.setHex(on ? 0xff2233 : 0x551122);
        car.mesh.userData.barB.material.color.setHex(on ? 0x113366 : 0x2266ff);
      }
    }
  }
  count() { return this.cars.length; }
  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
  }
}
