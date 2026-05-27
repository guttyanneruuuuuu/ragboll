// ============================================================
// arenas/castle.js — Snowy keep with falling icicle hazard.
// ============================================================

import * as THREE from 'three';
import { ArenaBase } from './base.js';
import { HazardArena } from './hazard.js';

export class CastleArena extends ArenaBase {
  build() {
    const size = this.preset.size?.x || 22;
    this._ground(size, this.preset.floor.color, this.preset.floor.grid);
    this._battlements(size);
    // delegate hazard creation to the hazard mixin behaviour
    const proxy = new HazardArena(this.preset, this.world, this.scene);
    for (const haz of this.preset.hazards || []) {
      if (haz.type === 'icicle') proxy._addIcicle(haz);
    }
    this._mergeProxy(proxy);
    this._snowflakes();
  }

  _battlements(size) {
    const half = size / 2;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.85 });
    for (let i = 0; i < 4; i++) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(size, 1.6, 0.4), wallMat);
      const angle = (Math.PI / 2) * i;
      wall.position.set(Math.cos(angle) * half, 0.8, Math.sin(angle) * half);
      wall.rotation.y = angle;
      this.scene.add(wall);
      this._meshes.push(wall);
    }
  }

  _mergeProxy(proxy) {
    for (const t of proxy._tickers) this._tickers.push(t);
    for (const m of proxy._meshes) this._meshes.push(m);
    for (const b of proxy._bodies) this._bodies.push(b);
    for (const h of proxy._hazards) this._hazards.push(h);
  }

  _snowflakes() {
    const count = 240;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i*3+0] = (Math.random() - 0.5) * 30;
      positions[i*3+1] = Math.random() * 12;
      positions[i*3+2] = (Math.random() - 0.5) * 30;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.8 });
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this._meshes.push(points);
    this._tickers.push((dt) => {
      const arr = geom.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i*3+1] -= dt * (0.4 + (i % 7) * 0.05);
        if (arr[i*3+1] < 0) arr[i*3+1] = 12;
      }
      geom.attributes.position.needsUpdate = true;
    });
  }
}
