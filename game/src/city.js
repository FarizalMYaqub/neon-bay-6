// Neon Bay city: street grid, lit buildings, beach + waterfront, palms, lamps, props.
import * as THREE from 'three';
import { range, pick } from './rng.js';

export const CITY = {
  half: 190,        // city extends +/-190 on x and z
  block: 44,        // block pitch
  road: 12,         // road width
  beachZ: -150,     // beach starts here (south edge)
};

// Canvas texture with glowing windows for building facades.
export function makeBuildingTexture(rng, base) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 6, rows = 14;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < 0.55;
      g.fillStyle = lit ? pick(rng, ['#ffd97a', '#9fe8ff', '#ff9a5c', '#fff3c4']) : '#10182e';
      g.fillRect(8 + x * 19, 10 + y * 17, 12, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  const { half, block, road } = CITY;

  // Ground: dark asphalt base.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 80, half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: 0x1a2030 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: lighter strips along the grid + centre lines.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2c3242 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const roads = [];
  for (let i = -4; i <= 4; i++) {
    const p = i * block;
    const h = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, road), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.02, p); group.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(road, half * 2), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(p, 0.02, 0); group.add(v);
    roads.push(p);
    for (let d = -half; d < half; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.5), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.03, p); group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.5), lineMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(p, 0.03, d); group.add(dash2);
    }
  }

  // Beach + sea along the south edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 80, 46),
    new THREE.MeshLambertMaterial({ color: 0xc2a878 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.beachZ - 30);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 80, 120),
    new THREE.MeshLambertMaterial({ color: 0x0e4d6e })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, CITY.beachZ - 110);
  group.add(sea);

  // Buildings: one per block quadrant with a lit-window texture.
  const palette = ['#3a4a6b', '#54406b', '#6b4030', '#2f5d5a', '#5a5a3a', '#41355e'];
  const buildings = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let ix = -4; ix < 4; ix++) {
    for (let iz = -3; iz < 4; iz++) {
      const cx = ix * block + block / 2;
      const cz = iz * block + block / 2;
      if (cz < CITY.beachZ + 8) continue; // keep the beach clear
      if (Math.abs(cx) < 14 && Math.abs(cz) < 14) continue; // central plaza
      const w = range(rng, 16, 26), d = range(rng, 16, 26), h = range(rng, 14, 62);
      const tex = makeBuildingTexture(rng, pick(rng, palette));
      const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, d);
      b.position.set(cx, h / 2, cz);
      group.add(b);
      buildings.push({ x: cx, z: cz, w, d, h });
      // Rooftop beacon on tall towers.
      if (h > 42) {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(1.1, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff3355 })
        );
        beacon.position.set(cx, h + 1.2, cz);
        group.add(beacon);
      }
    }
  }

  // Central plaza: fountain + neon arch (the city landmark).
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 11, 1.2, 24),
    new THREE.MeshLambertMaterial({ color: 0x2ee6ff })
  );
  plaza.position.set(0, 0.6, 0);
  group.add(plaza);
  const archMat = new THREE.MeshBasicMaterial({ color: 0xff2e88 });
  const archL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 16, 1.4), archMat);
  archL.position.set(-10, 8, -14); group.add(archL);
  const archR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 16, 1.4), archMat);
  archR.position.set(10, 8, -14); group.add(archR);
  const archT = new THREE.Mesh(new THREE.BoxGeometry(21.4, 1.6, 1.4), archMat);
  archT.position.set(0, 16, -14); group.add(archT);

  // Palm trees along the beach and plaza.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x1f8a4c });
  const palms = [];
  for (let i = 0; i < 46; i++) {
    const x = range(rng, -half, half);
    const z = rng() < 0.6 ? range(rng, CITY.beachZ - 12, CITY.beachZ + 4) : range(rng, -half, half);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 7), leafMat);
    leaves.position.set(x, 8.2, z);
    group.add(leaves);
    palms.push({ x, z });
  }

  // Streetlights along every road.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222831 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lamps = [];
  for (const p of roads) {
    for (let d = -half + 10; d < half; d += 44) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
      pole.position.set(p + road / 2 + 1, 3.5, d);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), lampMat);
      lamp.position.set(p + road / 2 + 1, 7.2, d);
      group.add(lamp);
      const light = new THREE.PointLight(0xffd97a, 12, 26, 1.8);
      light.position.set(p + road / 2 + 1, 7, d);
      group.add(light);
      lamps.push({ x: p + road / 2 + 1, z: d });
    }
  }

  // Crates / props scattered on sidewalks.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6b3a });
  for (let i = 0; i < 40; i++) {
    const s = range(rng, 1, 2.2);
    const crate = new THREE.Mesh(boxGeo, crateMat);
    crate.scale.set(s, s, s);
    crate.position.set(range(rng, -half, half), s / 2, range(rng, -half, half));
    crate.rotation.y = rng() * Math.PI;
    group.add(crate);
  }

  scene.add(group);
  return { group, buildings, roads, palms, lamps };
}

// Is a point on a road (within the road strips)?
export function onRoad(x, z) {
  const { block, road } = CITY;
  const rx = ((x % block) + block) % block;
  const rz = ((z % block) + block) % block;
  return rx < road / 2 + 2 || rx > block - road / 2 - 2 || rz < road / 2 + 2 || rz > block - road / 2 - 2;
}

// Snap a point to the nearest road centre line.
export function nearestRoadPoint(x, z) {
  const { block } = CITY;
  const nx = Math.round(x / block) * block;
  const nz = Math.round(z / block) * block;
  return Math.abs(x - nx) < Math.abs(z - nz) ? { x: nx, z } : { x, z: nz };
}
