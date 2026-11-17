// Missions + story: three jobs across one night in Neon Bay.
import * as THREE from 'three';

// Mission definitions. `target` is the world position of the objective marker.
export const MISSIONS = [
  {
    id: 1,
    title: 'MISSION 1 — FIRST JOB',
    objective: 'Drive to the meet at Marina Point',
    target: { x: -88, z: -132 },
    dialogue: '<b>MARA (phone):</b> "Rico, you\'re out. Good. Marina Point, south beach — my crew is waiting. Don\'t keep us waiting, wheelman."',
    reward: 400,
    onStart: null,
  },
  {
    id: 2,
    title: 'MISSION 2 — THE PICKUP',
    objective: 'Grab the package, then deliver it to the Neon Arch',
    target: { x: 88, z: 88 },
    dialogue: '<b>MARA:</b> "Package is stashed at the east docks. Grab it, bring it to the Neon Arch — and watch out, the Red Vipers want it too."',
    reward: 900,
    onStart: 'gang',
  },
  {
    id: 3,
    title: 'MISSION 3 — GETAWAY',
    objective: 'Lose the heat — drop your wanted level to 0',
    target: { x: 0, z: 0 },
    dialogue: '<b>MARA:</b> "Cops are all over you, Rico. Lay low, break line of sight, and get that heat off you. Then we\'re rich."',
    reward: 1500,
    onStart: 'wanted3',
  },
];

// Floating beacon + ground ring marking the current objective.
export class ObjectiveMarker {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 14, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beam = new THREE.Mesh(geo, mat);
    const ringGeo = new THREE.RingGeometry(2.2, 3.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.beam.visible = false;
    this.ring.visible = false;
    scene.add(this.beam);
    scene.add(this.ring);
    this.t = 0;
  }
  set(x, z, visible) {
    this.beam.position.set(x, 7, z);
    this.ring.position.set(x, 0.06, z);
    this.beam.visible = visible;
    this.ring.visible = visible;
  }
  update(dt) {
    this.t += dt;
    if (this.beam.visible) {
      this.beam.rotation.y += dt * 0.8;
      this.ring.scale.setScalar(1 + Math.sin(this.t * 3) * 0.12);
    }
  }
}

// Mission state machine: start / progress / complete.
export class MissionManager {
  constructor(marker) {
    this.marker = marker;
    this.index = 0;          // 0-based into MISSIONS
    this.phase = 'go';       // 'go' | 'deliver' | 'done'
    this.finished = false;
    this.onEvent = null;     // callback(event, data)
  }
  current() { return MISSIONS[this.index]; }
  start() {
    const m = this.current();
    this.phase = 'go';
    this.marker.set(m.target.x, m.target.z, true);
    if (this.onEvent) this.onEvent('dialogue', m.dialogue);
    if (this.onEvent) this.onEvent('start', m);
  }
  // Called every frame with the player's position.
  update(px, pz, wanted) {
    if (this.finished) return;
    const m = this.current();
    if (this.index === 2) {
      // Getaway: win when the heat is gone.
      if (wanted === 0) this.complete();
      return;
    }
    const tx = this.phase === 'deliver' ? 0 : m.target.x;
    const tz = this.phase === 'deliver' ? -14 : m.target.z;
    const d = Math.hypot(px - tx, pz - tz);
    if (d < 7) {
      if (this.index === 1 && this.phase === 'go') {
        this.phase = 'deliver';
        this.marker.set(0, -14, true);
        if (this.onEvent) this.onEvent('dialogue', '<b>MARA:</b> "Package secured. Now the Neon Arch, centre plaza — fast, before the Vipers catch up."');
        if (this.onEvent) this.onEvent('objective', 'Deliver the package to the Neon Arch');
      } else {
        this.complete();
      }
    }
  }
  complete() {
    const m = this.current();
    if (this.onEvent) this.onEvent('reward', m.reward);
    if (this.onEvent) this.onEvent('dialogue', `<b>MISSION COMPLETE — ${m.title}:</b> +$${m.reward}.`);
    this.index++;
    if (this.index >= MISSIONS.length) {
      this.finished = true;
      this.marker.set(0, 0, false);
      if (this.onEvent) this.onEvent('finished', null);
    } else {
      this.start();
    }
  }
  label() {
    if (this.finished) return 'ALL MISSIONS COMPLETE';
    return this.current().title;
  }
  objectiveText() {
    if (this.finished) return 'Free roam — Neon Bay is yours, Rico.';
    if (this.index === 1 && this.phase === 'deliver') return 'Deliver the package to the Neon Arch';
    return this.current().objective;
  }
  targetPos() {
    if (this.finished) return null;
    if (this.index === 1 && this.phase === 'deliver') return { x: 0, z: -14 };
    return this.current().target;
  }
}
