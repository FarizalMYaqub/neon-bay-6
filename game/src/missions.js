// Missions + story for Neon Bay. Three missions from contact "Mara":
// 1. First Job — drive to Marina Point. 2. The Pickup — grab a package,
//    rival gang shows up. 3. Getaway — lose a 3-star wanted level.
// Progress is saved; finishing all three shows the completion screen.
import * as THREE from 'three';

const MARA_LINES = {
  start1: 'Mara: "New in Neon Bay? First job: meet my runner at Marina Point. Don\'t keep him waiting."',
  done1: 'Mara: "Clean driving. One more thing — pick up a package for me at the old arcade."',
  start2: 'Mara: "The package is at the arcade on 5th. Word is the Vipers want it too. Watch yourself."',
  done2: 'Mara: "You handled the Vipers. Last job: the cops are onto you. Lose them and you\'re one of us."',
  start3: 'Mara: "Three stars on you now. Break line of sight, lay low, and don\'t get caught."',
  done3: 'Mara: "You\'re a ghost, kid. Welcome to Neon Bay. The city is yours now."',
};

export class MissionSystem {
  constructor(scene, rng, city) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.index = 0; // 0,1,2 = active mission; 3 = all done
    this.completed = [false, false, false];
    this.objective = '';
    this.target = null; // {x, z, label}
    this.dialogue = '';
    this.dialogueT = 0;
    this.packageTaken = false;
    this.gangSpawned = false;
    this.beacon = this._makeBeacon();
    this.packageMesh = null;
    this.onGangSpawn = null; // (x, z) => void, wired by game.js
    this.onWantedSet = null; // (stars) => void
    this.onReward = null; // (cash) => void
    this.onAllDone = null;
    this._setMission(0);
  }

  _makeBeacon() {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 42, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
    cyl.position.y = 21;
    g.add(cyl);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1;
    g.add(ring);
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  _say(key) {
    this.dialogue = MARA_LINES[key] || '';
    this.dialogueT = 7;
  }

  _setMission(i) {
    this.index = i;
    if (i === 0) {
      const m = this.city.marinaPoint;
      this.target = { x: m.x, z: m.z, label: 'Marina Point' };
      this.objective = 'Drive to Marina Point';
      this._say('start1');
    } else if (i === 1) {
      this.target = { x: -45, z: -45, label: 'Old Arcade' };
      this.objective = 'Pick up the package at the Old Arcade';
      this.packageTaken = false;
      this.gangSpawned = false;
      this._spawnPackage();
      this._say('start2');
    } else if (i === 2) {
      this.target = null;
      this.objective = 'Lose the police — get wanted to 0 stars';
      this._say('start3');
      if (this.onWantedSet) this.onWantedSet(3);
    } else {
      this.target = null;
      this.objective = 'All missions complete — Neon Bay is yours';
      this._say('done3');
      if (this.onAllDone) this.onAllDone();
    }
    this._placeBeacon();
  }

  _spawnPackage() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.6, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0x664400, roughness: 0.4 }),
    );
    mesh.position.set(this.target.x, 0.6, this.target.z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.packageMesh = mesh;
  }

  _placeBeacon() {
    if (this.target) {
      this.beacon.position.set(this.target.x, 0, this.target.z);
      this.beacon.visible = true;
    } else {
      this.beacon.visible = false;
    }
  }

  // Called every frame; returns true when a mission just completed.
  update(dt, playerPos, wanted) {
    if (this.dialogueT > 0) this.dialogueT -= dt;
    if (this.beacon.visible) this.beacon.rotation.y += dt * 0.8;
    if (this.packageMesh) this.packageMesh.rotation.y += dt * 1.5;
    if (this.index >= 3 || !this.target) {
      if (this.index === 2 && wanted === 0) this._complete(2);
      return false;
    }
    const d = Math.hypot(playerPos.x - this.target.x, playerPos.z - this.target.z);
    if (this.index === 0 && d < 6) { this._complete(0); return true; }
    if (this.index === 1) {
      if (!this.packageTaken && d < 4) {
        this.packageTaken = true;
        if (this.packageMesh) { this.scene.remove(this.packageMesh); this.packageMesh = null; }
        this.objective = 'Rival gang incoming — deal with them, then return to Mara';
        this.target = { x: 30, z: 30, label: 'Mara at the Plaza' };
        this._placeBeacon();
        if (!this.gangSpawned && this.onGangSpawn) {
          this.gangSpawned = true;
          this.onGangSpawn(this.target.x, this.target.z);
        }
      } else if (this.packageTaken && d < 6) { this._complete(1); return true; }
    }
    return false;
  }

  _complete(i) {
    this.completed[i] = true;
    const reward = [500, 900, 1500][i];
    if (this.onReward) this.onReward(reward);
    if (i === 0) this._say('done1');
    if (i === 1) this._say('done2');
    this._setMission(i + 1);
  }

  // Save/load: only the mission index + completed flags.
  saveState() { return { index: this.index, completed: this.completed }; }
  loadState(s) {
    if (!s) return;
    this.completed = s.completed || [false, false, false];
    const idx = Math.min(3, s.index || 0);
    if (this.packageMesh) { this.scene.remove(this.packageMesh); this.packageMesh = null; }
    this._setMission(idx);
  }
}
