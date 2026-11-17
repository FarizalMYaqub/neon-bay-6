// People: sidewalk pedestrians who scatter when threatened, and armed gang
// members who appear during mission 2. Simple stylized figures, health bars
// on enemies.
import * as THREE from 'three';
import { GRID } from './city.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xe67e22];

export function buildPersonMesh(shirtColor, skinColor = 0xd9a066) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.36), shirt);
  body.position.y = 1.05; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  head.position.y = 1.72; head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 }));
  hair.position.y = 1.76;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), pants);
  legL.position.set(-0.16, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), shirt);
  armL.position.set(-0.42, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class PeopleSystem {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.pedestrians = [];
    this.gang = [];
  }

  spawnPedestrians(n) {
    for (let i = 0; i < n; i++) {
      const mesh = buildPersonMesh(this.rng.pick(SHIRT_COLORS));
      const p = {
        mesh,
        x: this.rng.range(-100, 100),
        z: this.rng.range(-100, 105),
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.2, 2.4),
        state: 'walk', // walk | flee
        fleeT: 0,
        walkPhase: this.rng.range(0, 10),
      };
      // Keep pedestrians on sidewalks: snap near a road edge.
      const road = this.rng.pick(GRID);
      if (this.rng.chance(0.5)) { p.z = road + this.rng.pick([-12.5, 12.5]); }
      else { p.x = road + this.rng.pick([-12.5, 12.5]); }
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = p.heading;
      this.scene.add(mesh);
      this.pedestrians.push(p);
    }
    return this.pedestrians;
  }

  spawnGang(n, x, z) {
    const made = [];
    for (let i = 0; i < n; i++) {
      const mesh = buildPersonMesh(0x8b0000);
      const g = {
        mesh,
        x: x + this.rng.range(-6, 6),
        z: z + this.rng.range(-6, 6),
        heading: this.rng.range(0, Math.PI * 2),
        speed: 2.6,
        health: 100,
        state: 'attack',
        shootT: this.rng.range(0.5, 1.5),
        bar: null,
      };
      // Health bar sprite above the head.
      const barGeo = new THREE.PlaneGeometry(1.1, 0.12);
      const barMat = new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(0, 2.25, 0);
      mesh.add(bar);
      g.bar = bar;
      mesh.position.set(g.x, 0, g.z);
      this.scene.add(mesh);
      this.gang.push(g);
      made.push(g);
    }
    return made;
  }

  removeGangMember(g) {
    this.scene.remove(g.mesh);
    this.gang.splice(this.gang.indexOf(g), 1);
  }

  // A scare (gunshot, fast car, punch) makes nearby pedestrians flee.
  scare(x, z, radius = 14) {
    for (const p of this.pedestrians) {
      if (Math.hypot(p.x - x, p.z - z) < radius) {
        p.state = 'flee';
        p.fleeT = 4;
        p.heading = Math.atan2(p.x - x, p.z - z);
      }
    }
  }

  update(dt, playerPos, playerSpeed, time) {
    for (const p of this.pedestrians) {
      p.walkPhase += dt * (p.state === 'flee' ? 9 : 5);
      const speed = p.state === 'flee' ? 5.2 : p.speed;
      if (p.state === 'flee') {
        p.fleeT -= dt;
        if (p.fleeT <= 0) p.state = 'walk';
      }
      let nx = p.x + Math.sin(p.heading) * speed * dt;
      let nz = p.z + Math.cos(p.heading) * speed * dt;
      if (this.city.isBlocked(nx, nz, 0.5) || Math.abs(nx) > 106 || Math.abs(nz) > 112) {
        p.heading += Math.PI / 2 + this.rng.range(-0.5, 0.5);
        nx = p.x; nz = p.z;
      }
      // Occasionally turn at random while walking.
      if (p.state === 'walk' && this.rng.chance(dt * 0.12)) p.heading += this.rng.range(-1.2, 1.2);
      p.x = nx; p.z = nz;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.walkPhase) * 0.45;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
      p.mesh.userData.armL.rotation.x = -swing * 0.7;
      p.mesh.userData.armR.rotation.x = swing * 0.7;
    }
    // Gang members walk toward the player and shoot when close.
    for (const g of this.gang) {
      const dx = playerPos.x - g.x, dz = playerPos.z - g.z;
      const dist = Math.hypot(dx, dz);
      g.heading = Math.atan2(dx, dz);
      if (dist > 14) {
        g.x += Math.sin(g.heading) * g.speed * dt;
        g.z += Math.cos(g.heading) * g.speed * dt;
      }
      g.shootT -= dt;
      g.mesh.position.set(g.x, 0, g.z);
      g.mesh.rotation.y = g.heading;
      if (g.bar) {
        g.bar.scale.x = Math.max(0.02, g.health / 100);
      }
    }
  }
}
