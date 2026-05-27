// ============================================================
// arenas/hazard.js — Rotating sawblades + danger pads.
// ============================================================

import * as THREE from 'three';
import { ArenaBase } from './base.js';

export class HazardArena extends ArenaBase {
  build() {
    const size = this.preset.size?.x || 20;
    this._ground(size, this.preset.floor.color, this.preset.floor.grid);
    this._walls(size, 5);
    for (const haz of this.preset.hazards || []) this._addHazard(haz);
  }

  _addHazard(haz) {
    if (haz.type === 'blade') this._addBlade(haz);
    else if (haz.type === 'piston') this._addPiston(haz);
    else if (haz.type === 'conveyor') this._addConveyor(haz);
    else if (haz.type === 'icicle') this._addIcicle(haz);
  }

  _addBlade(haz) {
    const radius = haz.radius;
    const speed  = haz.speed;
    const blade = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.08, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0xff3344, metalness: 0.8, roughness: 0.2 }),
    );
    ring.rotation.x = -Math.PI / 2;
    blade.add(ring);
    for (let i = 0; i < 6; i++) {
      const tooth = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.5, 6),
        new THREE.MeshStandardMaterial({ color: 0xffaa44, metalness: 0.9, roughness: 0.15 }),
      );
      const ang = (Math.PI * 2 / 6) * i;
      tooth.position.set(Math.cos(ang) * radius, 0, Math.sin(ang) * radius);
      tooth.rotation.z = ang + Math.PI / 2;
      blade.add(tooth);
    }
    blade.position.set(haz.position.x, haz.height || 0.45, haz.position.z);
    this.scene.add(blade);
    this._meshes.push(blade);
    this._tickers.push(dt => blade.rotation.y += speed * dt);
    this._hazards.push({
      type: 'blade',
      position: { x: haz.position.x, y: haz.height || 0.45, z: haz.position.z },
      radius:   radius + 0.4,
      damage:   haz.damage || 70,
    });
  }

  _addPiston(haz) {
    const piston = new THREE.Mesh(
      new THREE.CylinderGeometry(haz.radius, haz.radius, 0.6, 16),
      new THREE.MeshStandardMaterial({ color: 0xddaa33, metalness: 0.7, roughness: 0.2 }),
    );
    piston.position.set(haz.position.x, 0.3, haz.position.z);
    this.scene.add(piston);
    this._meshes.push(piston);
    let t = 0;
    this._tickers.push(dt => {
      t += dt;
      const phase = (t % haz.period) / haz.period;
      piston.position.y = phase < 0.5 ? 0.3 + phase * 4 : 0.3 + (1 - phase) * 4;
      this._hazards[this._hazards.length - 1].active = phase > 0.45 && phase < 0.55;
    });
    this._hazards.push({
      type: 'piston',
      position: { x: haz.position.x, y: 0.3, z: haz.position.z },
      radius:   haz.radius + 0.3,
      damage:   haz.damage || 80,
      active:   false,
    });
  }

  _addConveyor(haz) {
    const length = haz.length || 12;
    const width  = haz.width || 2;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.08, length),
      new THREE.MeshStandardMaterial({ color: 0x33aaff, metalness: 0.4, roughness: 0.6 }),
    );
    mesh.position.set(haz.position.x, 0.05, haz.position.z);
    this.scene.add(mesh);
    this._meshes.push(mesh);
    // conveyor uses a virtual push field — register as hazard with 0 damage
    this._hazards.push({
      type: 'conveyor',
      position: { x: haz.position.x, y: 0.05, z: haz.position.z },
      radius:   Math.max(length, width) / 2,
      damage:   0,
      force:    haz.speed || 4,
    });
  }

  _addIcicle(haz) {
    // procedural falling icicles every `haz.period`
    let t = 0;
    this._tickers.push((dt) => {
      t += dt;
      if (t > haz.period) {
        t = 0;
        const x = haz.position.x + (Math.random() - 0.5) * haz.radius * 2;
        const z = haz.position.z + (Math.random() - 0.5) * haz.radius * 2;
        const icicle = new THREE.Mesh(
          new THREE.ConeGeometry(0.15, 0.8, 8),
          new THREE.MeshStandardMaterial({ color: 0xddeeff, transparent: true, opacity: 0.7 }),
        );
        icicle.position.set(x, 6, z);
        this.scene.add(icicle);
        this._meshes.push(icicle);
        const haz2 = { type: 'icicle', position: { x, y: 6, z }, radius: 0.5, damage: haz.damage || 70 };
        this._hazards.push(haz2);
        let fall = 0;
        const fallTicker = (dt2) => {
          fall += dt2 * 14;
          icicle.position.y = Math.max(0, 6 - fall);
          haz2.position.y = icicle.position.y;
          if (icicle.position.y <= 0.1) {
            // remove
            this.scene.remove(icicle);
            const idx = this._meshes.indexOf(icicle);
            if (idx >= 0) this._meshes.splice(idx, 1);
            const hi = this._hazards.indexOf(haz2);
            if (hi >= 0) this._hazards.splice(hi, 1);
            const ti = this._tickers.indexOf(fallTicker);
            if (ti >= 0) this._tickers.splice(ti, 1);
          }
        };
        this._tickers.push(fallTicker);
      }
    });
  }
}
