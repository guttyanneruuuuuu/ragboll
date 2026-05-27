// ============================================================
// arenas/ringout.js — Wall-less platform with a deep pit.
// ============================================================

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ArenaBase } from './base.js';

export class RingOutArena extends ArenaBase {
  build() {
    const size = this.preset.size?.x || 18;
    this._ground(size, this.preset.floor.color, this.preset.floor.grid);
    this._addEdgeWarn(size);
    this._addPit();
  }

  _addEdgeWarn(size) {
    const half = size / 2;
    const ringGeom = new THREE.RingGeometry(half - 0.25, half - 0.1, 64);
    ringGeom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff5511,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const mesh = new THREE.Mesh(ringGeom, mat);
    mesh.position.y = 0.04;
    this.scene.add(mesh);
    this._meshes.push(mesh);
  }

  _addPit() {
    const y = this.preset.pit?.y ?? -10;
    const geom = new THREE.PlaneGeometry(80, 80);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const pit = new THREE.Mesh(geom, mat);
    pit.position.y = y;
    this.scene.add(pit);
    this._meshes.push(pit);
  }
}
