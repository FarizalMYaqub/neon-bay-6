// Neon Bay city: street grid, lit-window towers, beach + sea, palms,
// streetlights, a neon-arch plaza, sidewalks and street props. Sunset lighting.
import * as THREE from 'three';

export const GRID = [-90, -60, -30, 0, 30, 60, 90];
export const CITY_EDGE = 105;
export const BEACH_Z = 118; // sand strip starts here (south edge)
export const SEA_Z = 150;

const WINDOW_COLORS = [0xffd27a, 0x9fe8ff, 0xff9de2, 0xfff2b0, 0x8affc1];
const BUILDING_COLORS = [0x3a3f5c, 0x4a3550, 0x2f4257, 0x54423a, 0x39424e, 0x503a4e];

function litWindowMaterial(rng) {
  // One shared emissive window texture, drawn once on a canvas.
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#101018'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      if (rng.chance(0.45)) {
        g.fillStyle = '#' + new THREE.Color(rng.pick(WINDOW_COLORS)).getHexString();
        g.globalAlpha = 0.75 + rng.next() * 0.25;
        g.fillRect(x, y, 8, 7);
      }
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // --- sky, sun, fog ---
  scene.background = new THREE.Color(0x2a1540);
  scene.fog = new THREE.Fog(0x3a1c4d, 120, 420);
  const hemi = new THREE.HemisphereLight(0xff9a5c, 0x1a1030, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff8c42, 2.2);
  sun.position.set(-120, 55, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  // Low sun disc on the horizon over the sea.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false }),
  );
  sunDisc.position.set(40, 26, 320);
  sunDisc.lookAt(0, 26, 0);
  scene.add(sunDisc);

  // --- ground: asphalt base, grass blocks, sand + sea ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x23232e, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 46),
    new THREE.MeshStandardMaterial({ color: 0xd9b380, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, BEACH_Z + 22);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 220),
    new THREE.MeshStandardMaterial({ color: 0x1c4d6e, roughness: 0.25, metalness: 0.35 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.01, SEA_Z + 110);
  group.add(sea);

  // Sidewalk blocks (raised slightly, lighter than asphalt).
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x4a4a58, roughness: 0.9 });
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      const cx = gx * 30, cz = gz * 30;
      const block = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 24), walkMat);
      block.position.set(cx, 0.15, cz);
      block.receiveShadow = true;
      group.add(block);
    }
  }

  // Road markings: dashed center lines along every grid road.
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
  const dash = new THREE.BoxGeometry(0.5, 0.02, 3);
  for (const v of GRID) {
    for (let t = -102; t <= 102; t += 8) {
      const d1 = new THREE.Mesh(dash, lineMat); d1.position.set(v, 0.03, t); group.add(d1);
      const d2 = new THREE.Mesh(dash, lineMat); d2.position.set(t, 0.03, v); d2.rotation.y = Math.PI / 2; group.add(d2);
    }
  }

  // --- buildings: varied heights, lit windows, rooftop neon trim ---
  const winTex = litWindowMaterial(rng);
  const winMat = new THREE.MeshStandardMaterial({ map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.9, roughness: 0.8 });
  const neonColors = [0xff2d78, 0x00e5ff, 0xffa500, 0x7c4dff, 0x39ff88];
  const plazaBlock = { gx: 1, gz: 1 }; // block (30,30) becomes the neon plaza
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      const cx = gx * 30, cz = gz * 30;
      if (gx === plazaBlock.gx && gz === plazaBlock.gz) continue; // plaza, no tower
      const w = rng.range(13, 19), d = rng.range(13, 19);
      const h = rng.range(10, 46) * (Math.abs(gx) + Math.abs(gz) <= 1 ? 1.6 : 1);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: rng.pick(BUILDING_COLORS), roughness: 0.85 }),
      );
      body.position.set(cx, h / 2 + 0.3, cz);
      body.castShadow = true; body.receiveShadow = true;
      group.add(body);
      // Window skin: a slightly larger box with the lit-window texture.
      const skin = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, h, d + 0.15), winMat);
      skin.position.copy(body.position);
      group.add(skin);
      // Neon roof trim.
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4),
        new THREE.MeshBasicMaterial({ color: rng.pick(neonColors) }),
      );
      trim.position.set(cx, h + 0.45, cz);
      group.add(trim);
      colliders.push({ minX: cx - w / 2 - 0.5, maxX: cx + w / 2 + 0.5, minZ: cz - d / 2 - 0.5, maxZ: cz + d / 2 + 0.5 });
    }
  }

  // --- neon-arch plaza at block (30, 30) ---
  const plaza = new THREE.Group();
  plaza.position.set(30, 0, 30);
  const archMat = new THREE.MeshBasicMaterial({ color: 0xff2d78 });
  const archMat2 = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const pillarGeo = new THREE.BoxGeometry(1.2, 9, 1.2);
  const p1 = new THREE.Mesh(pillarGeo, archMat); p1.position.set(-6, 4.5, 0); plaza.add(p1);
  const p2 = new THREE.Mesh(pillarGeo, archMat); p2.position.set(6, 4.5, 0); plaza.add(p2);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(13.2, 1.2, 1.2), archMat2);
  beam.position.set(0, 9.4, 0); plaza.add(beam);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 0.6),
    new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  sign.position.set(0, 7.2, 0); plaza.add(sign);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 1, 20),
    new THREE.MeshStandardMaterial({ color: 0x2b6cb0, roughness: 0.2, metalness: 0.4 }));
  fountain.position.set(0, 0.8, 0); plaza.add(fountain);
  group.add(plaza);
  colliders.push({ minX: 30 - 7, maxX: 30 + 7, minZ: 30 - 1.2, maxZ: 30 + 1.2 }); // arch pillars row
  colliders.push({ minX: 27, maxX: 33, minZ: 27, maxZ: 33 }); // fountain

  // --- palm trees along the beach ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.9 });
  for (let x = -100; x <= 100; x += 12) {
    if (rng.chance(0.25)) continue;
    const px = x + rng.range(-2, 2), pz = BEACH_Z + rng.range(4, 14);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 8), trunkMat);
    trunk.position.set(px, 3.5, pz); trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(px + Math.cos(a) * 1.6, 7.2, pz + Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      group.add(leaf);
    }
  }

  // --- streetlights along every road ---
  // Only a few poles carry a real PointLight: ~100 point lights would make
  // the forward renderer crawl on software GL. The rest are emissive lamps.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x30303a, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  let poleCount = 0;
  for (const v of GRID) {
    for (let t = -90; t <= 90; t += 30) {
      for (const [x, z] of [[v + 13, t], [v - 13, t]]) {
        if (Math.abs(x) > 108 || Math.abs(z) > 108) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 8), poleMat);
        pole.position.set(x, 3.5, z); group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), lampMat);
        lamp.position.set(x, 7.1, z); group.add(lamp);
        if (poleCount % 8 === 0) {
          const pt = new THREE.PointLight(0xffd27a, 12, 22, 1.8);
          pt.position.set(x, 7, z);
          group.add(pt);
        }
        poleCount++;
      }
    }
  }

  // --- props: benches, hydrants, signs ---
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a4a2b, roughness: 0.9 });
  const hydMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 });
  for (let i = 0; i < 26; i++) {
    const bx = rng.pick(GRID) + rng.pick([-14, 14]);
    const bz = rng.range(-95, 95);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.9), benchMat);
    bench.position.set(bx, 0.7, bz); bench.castShadow = true;
    group.add(bench);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.7), benchMat);
    leg.position.set(bx, 0.3, bz); group.add(leg);
  }
  for (let i = 0; i < 18; i++) {
    const hx = rng.pick(GRID) + rng.pick([-13, 13]);
    const hz = rng.range(-95, 100);
    const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1, 10), hydMat);
    hyd.position.set(hx, 0.8, hz); group.add(hyd);
  }

  return {
    colliders,
    roads: GRID.slice(),
    plazaPos: new THREE.Vector3(30, 0, 30),
    marinaPoint: new THREE.Vector3(60, 0, 112), // meet point by the beach
    beachZ: BEACH_Z,
    isBlocked(x, z, r = 0.6) {
      for (const c of colliders) {
        if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
      }
      return false;
    },
  };
}
