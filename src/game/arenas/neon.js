// ============================================================
// arenas/neon.js — Default neon-platform arena builder.
// ============================================================

import * as THREE from 'three';
import { ArenaBase } from './base.js';

export class NeonArena extends ArenaBase {
  build() {
    const size = (this.preset.size?.x || 24);
    this._ground(size, this.preset.floor.color, this.preset.floor.grid);
    this._walls(size, 5);
    this._addBackdrop(size);
    this._addRimLights(size);
  }

  _addBackdrop(size) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(size * 0.6, size * 0.62, 64),
      new THREE.MeshBasicMaterial({ color: 0xff4466, side: THREE.DoubleSide, transparent: true, opacity: 0.4 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.scene.add(ring);
    this._meshes.push(ring);

    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(size * 0.6, 0.04, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x33aaff, transparent: true, opacity: 0.65 }),
      );
      beam.position.y = 0.04;
      beam.rotation.y = (Math.PI / 4) * i;
      this.scene.add(beam);
      this._meshes.push(beam);
    }
  }

  _addRimLights(size) {
    const half = size / 2;
    const positions = [
      [-half + 0.5, 1.4,  half - 0.5],
      [ half - 0.5, 1.4,  half - 0.5],
      [-half + 0.5, 1.4, -half + 0.5],
      [ half - 0.5, 1.4, -half + 0.5],
    ];
    for (const [x, y, z] of positions) {
      const pole = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 2.8, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.6 }),
      );
      pole.position.set(x, y, z);
      this.scene.add(pole);
      this._meshes.push(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xff66aa }),
      );
      lamp.position.set(x, y + 1.6, z);
      this.scene.add(lamp);
      this._meshes.push(lamp);
    }
  }
}
