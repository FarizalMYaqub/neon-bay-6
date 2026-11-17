// Neon Bay city: street grid, lit-window towers, beach + sea, palms,
// streetlights, a neon-arch plaza, sidewalks and street props. Sunset lighting.
// Repeated props use InstancedMesh so the scene stays at a few dozen draw
// calls instead of a thousand (software GL would crawl otherwise).
import * as THREE from 'three';

export const GRID = [-90, -60, -30, 0, 30, 60, 90];
export const CITY_EDGE = 105;
export const BEACH_Z = 118; // sand strip starts here (south edge)
export const SEA_Z = 150;

const WINDOW_COLORS = [0xffd27a, 0x9fe8ff, 0xff9de2, 0xfff2b0, 0x8affc1];
const BUILDING_COLORS = [0x3a3f5c, 0x4a3550, 0x2f4257, 0x54423a, 0x39424e, 0x503a4e];

function litWindowTexture(rng) {
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

// Helper: fill an InstancedMesh from a list of {pos, rotY, scale, color}.
function fillInstances(mesh, items) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  items.forEach((it, i) => {
    e.set(0, it.rotY || 0, it.rotZ || 0);
    q.setFromEuler(e);
    p.set(it.pos[0], it.pos[1], it.pos[2]);
    s.set(it.scale[0], it.scale[1], it.scale[2]);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    if (it.color !== undefined) mesh.setColorAt(i, new THREE.Color(it.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
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

  // --- ground: asphalt base, sand + sea ---
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
  const walkItems = [];
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      walkItems.push({ pos: [gx * 30, 0.15, gz * 30], scale: [1, 1, 1] });
    }
  }
  const walks = fillInstances(
    new THREE.InstancedMesh(new THREE.BoxGeometry(24, 0.3, 24), walkMat, walkItems.length), walkItems);
  walks.receiveShadow = true;
  group.add(walks);

  // Road markings: dashed center lines along every grid road (one instanced mesh).
  const dashItems = [];
  for (const v of GRID) {
    for (let t = -102; t <= 102; t += 8) {
      dashItems.push({ pos: [v, 0.03, t], scale: [1, 1, 1] });
      dashItems.push({ pos: [t, 0.03, v], rotY: Math.PI / 2, scale: [1, 1, 1] });
    }
  }
  const dashes = fillInstances(
    new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.02, 3), new THREE.MeshBasicMaterial({ color: 0xd8c86a }), dashItems.length), dashItems);
  group.add(dashes);

  // --- buildings: varied heights, lit windows, rooftop neon trim ---
  const winTex = litWindowTexture(rng);
  const winMat = new THREE.MeshStandardMaterial({ map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.9, roughness: 0.8 });
  const neonColors = [0xff2d78, 0x00e5ff, 0xffa500, 0x7c4dff, 0x39ff88];
  const plazaBlock = { gx: 1, gz: 1 }; // block (30,30) becomes the neon plaza
  const bodyItems = [], skinItems = [], trimItems = [];
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      const cx = gx * 30, cz = gz * 30;
      if (gx === plazaBlock.gx && gz === plazaBlock.gz) continue; // plaza, no tower
      const w = rng.range(13, 19), d = rng.range(13, 19);
      const h = rng.range(10, 46) * (Math.abs(gx) + Math.abs(gz) <= 1 ? 1.6 : 1);
      const color = rng.pick(BUILDING_COLORS);
      bodyItems.push({ pos: [cx, h / 2 + 0.3, cz], scale: [w, h, d], color });
      skinItems.push({ pos: [cx, h / 2 + 0.3, cz], scale: [w + 0.15, h, d + 0.15] });
      trimItems.push({ pos: [cx, h + 0.45, cz], scale: [w + 0.4, 0.35, d + 0.4], color: rng.pick(neonColors) });
      colliders.push({ minX: cx - w / 2 - 0.5, maxX: cx + w / 2 + 0.5, minZ: cz - d / 2 - 0.5, maxZ: cz + d / 2 + 0.5 });
    }
  }
  const bodies = fillInstances(
    new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), bodyItems.length), bodyItems);
  bodies.castShadow = true; bodies.receiveShadow = true;
  group.add(bodies);
  const skins = fillInstances(
    new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), winMat, skinItems.length), skinItems);
  group.add(skins);
  const trims = fillInstances(
    new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({}), trimItems.length), trimItems);
  group.add(trims);

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

  // --- palm trees along the beach (instanced trunks + leaves) ---
  const trunkItems = [], leafItems = [];
  for (let x = -100; x <= 100; x += 12) {
    if (rng.chance(0.25)) continue;
    const px = x + rng.range(-2, 2), pz = BEACH_Z + rng.range(4, 14);
    trunkItems.push({ pos: [px, 3.5, pz], scale: [1, 1, 1] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      leafItems.push({
        pos: [px + Math.cos(a) * 1.6, 7.2, pz + Math.sin(a) * 1.6],
        rotY: 0, rotZ: Math.cos(a) * 1.1, scale: [1, 1, 1],
      });
    }
  }
  const trunks = fillInstances(
    new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }), trunkItems.length), trunkItems);
  trunks.castShadow = true;
  group.add(trunks);
  const leaves = fillInstances(
    new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 4.5, 4), new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.9 }), leafItems.length), leafItems);
  group.add(leaves);

  // --- streetlights along every road ---
  // Only a few poles carry a real PointLight: ~100 point lights would make
  // the forward renderer crawl on software GL. The rest are emissive lamps.
  const poleItems = [], lampItems = [];
  let poleCount = 0;
  const lightSpots = [];
  for (const v of GRID) {
    for (let t = -90; t <= 90; t += 30) {
      for (const [x, z] of [[v + 13, t], [v - 13, t]]) {
        if (Math.abs(x) > 108 || Math.abs(z) > 108) continue;
        poleItems.push({ pos: [x, 3.5, z], scale: [1, 1, 1] });
        lampItems.push({ pos: [x, 7.1, z], scale: [1, 1, 1] });
        if (poleCount % 8 === 0) lightSpots.push([x, 7, z]);
        poleCount++;
      }
    }
  }
  const poles = fillInstances(
    new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 8), new THREE.MeshStandardMaterial({ color: 0x30303a, roughness: 0.6, metalness: 0.5 }), poleItems.length), poleItems);
  group.add(poles);
  const lamps = fillInstances(
    new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), lampItems.length), lampItems);
  group.add(lamps);
  for (const [x, y, z] of lightSpots) {
    const pt = new THREE.PointLight(0xffd27a, 12, 22, 1.8);
    pt.position.set(x, y, z);
    group.add(pt);
  }

  // --- props: benches, hydrants (instanced) ---
  const benchItems = [], hydItems = [];
  for (let i = 0; i < 26; i++) {
    const bx = rng.pick(GRID) + rng.pick([-14, 14]);
    const bz = rng.range(-95, 95);
    benchItems.push({ pos: [bx, 0.7, bz], scale: [1, 1, 1] });
  }
  for (let i = 0; i < 18; i++) {
    const hx = rng.pick(GRID) + rng.pick([-13, 13]);
    const hz = rng.range(-95, 100);
    hydItems.push({ pos: [hx, 0.8, hz], scale: [1, 1, 1] });
  }
  const benches = fillInstances(
    new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.5, 0.9), new THREE.MeshStandardMaterial({ color: 0x7a4a2b, roughness: 0.9 }), benchItems.length), benchItems);
  benches.castShadow = true;
  group.add(benches);
  const hydrants = fillInstances(
    new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.4, 1, 10), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 }), hydItems.length), hydItems);
  group.add(hydrants);

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
