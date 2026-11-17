// Pedestrians: simple walking figures on sidewalks + rival gang members.
import * as THREE from 'three';
import { range, pick } from './rng.js';
import { CITY } from './city.js';

const SHIRTS = [0xff6b81, 0x2ed573, 0x70a1ff, 0xffa502, 0xeccc68, 0xc56cf0, 0xffffff];
const SKINS = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac];

// One low-poly person: body, head, legs that swing while walking.
export function makePersonMesh(shirt, skin, gang) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.85, 0.36),
    new THREE.MeshLambertMaterial({ color: gang ? 0x8a1f2d : shirt })
  );
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 10),
    new THREE.MeshLambertMaterial({ color: skin })
  );
  head.position.y = 1.72;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2f3542 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), legMat);
  legL.position.set(-0.16, 0.31, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), legMat);
  legR.position.set(0.16, 0.31, 0);
  g.add(legL); g.add(legR);
  if (gang) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.12, 0.54),
      new THREE.MeshBasicMaterial({ color: 0xff2233 })
    );
    band.position.y = 1.86;
    g.add(band);
  }
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

export class Pedestrian {
  constructor(mesh, x, z, heading, speed) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = speed;
    this.phase = Math.random() * 6;
    this.health = 100;
    this.alive = true;
  }
  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const s = Math.sin(this.phase) * 0.5;
    this.mesh.userData.legL.rotation.x = s;
    this.mesh.userData.legR.rotation.x = -s;
  }
}

export class Crowd {
  constructor(scene, rng, count) {
    this.peds = [];
    this.scene = scene;
    this.rng = rng;
    for (let i = 0; i < count; i++) {
      const p = this.spawnPed(
        range(rng, -CITY.half, CITY.half),
        range(rng, -CITY.half, CITY.half),
        false
      );
      if (p) this.peds.push(p);
    }
  }
  spawnPed(x, z, gang) {
    const mesh = makePersonMesh(pick(this.rng, SHIRTS), pick(this.rng, SKINS), gang);
    this.scene.add(mesh);
    const ped = new Pedestrian(mesh, x, z, this.rng() * Math.PI * 2, gang ? 0 : range(this.rng, 1.2, 2.4));
    ped.gang = !!gang;
    if (gang) ped.health = 60;
    ped.sync();
    return ped;
  }
  addGang(x, z, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = this.spawnPed(x + range(this.rng, -6, 6), z + range(this.rng, -6, 6), true);
      this.peds.push(p);
      out.push(p);
    }
    return out;
  }
  update(dt, playerX, playerZ) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      if (p.gang) {
        // Gang members walk toward the player and swing when close.
        const dx = playerX - p.x, dz = playerZ - p.z;
        const d = Math.hypot(dx, dz) || 1;
        p.heading = Math.atan2(dx, dz);
        if (d > 2.2) {
          p.x += (dx / d) * 3.2 * dt;
          p.z += (dz / d) * 3.2 * dt;
        }
        p.phase += dt * 9;
      } else {
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
        p.phase += dt * 6;
        if (Math.abs(p.x) > CITY.half + 10 || Math.abs(p.z) > CITY.half + 10) {
          p.heading += Math.PI / 2 + this.rng();
        }
        if (this.rng() < dt * 0.08) p.heading += (this.rng() - 0.5) * 1.6;
      }
      p.sync();
    }
  }
  removeDead() {
    this.peds = this.peds.filter((p) => {
      if (!p.alive) { this.scene.remove(p.mesh); return false; }
      return true;
    });
  }
}
