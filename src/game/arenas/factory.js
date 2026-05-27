// ============================================================
// arenas/factory.js — Industrial floor with pistons + conveyors.
// ============================================================

import * as THREE from 'three';
import { ArenaBase } from './base.js';
import { HazardArena } from './hazard.js';

export class FactoryArena extends ArenaBase {
  build() {
    const size = this.preset.size?.x || 26;
    this._ground(size, this.preset.floor.color, this.preset.floor.grid);
    this._walls(size, 5);
    this._pipes(size);
    // reuse HazardArena builders
    const proxy = new HazardArena(this.preset, this.world, this.scene);
    for (const haz of this.preset.hazards || []) proxy._addHazard(haz);
    this._mergeProxy(proxy);
  }

  _mergeProxy(proxy) {
    for (const t of proxy._tickers) this._tickers.push(t);
    for (const m of proxy._meshes) this._meshes.push(m);
    for (const b of proxy._bodies) this._bodies.push(b);
    for (const h of proxy._hazards) this._hazards.push(h);
  }

  _pipes(size) {
    const half = size / 2;
    const mat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.6, roughness: 0.35 });
    for (let i = 0; i < 6; i++) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, size, 12), mat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 0.5 + i * 0.6, -half + 0.6);
      this.scene.add(pipe);
      this._meshes.push(pipe);
    }
  }
}
