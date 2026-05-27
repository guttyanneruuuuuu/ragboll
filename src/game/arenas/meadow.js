// ============================================================
// arenas/meadow.js — Wide-open grass field with a soft boundary
// that pushes fighters back in (replicates the mobile original).
// ============================================================

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ArenaBase } from './base.js';

export class MeadowArena extends ArenaBase {
  build() {
    const size = this.preset.size?.x || 32;
    this._buildGrass(size);
    this._mountains();
    this._softBoundary();
  }

  _buildGrass(size) {
    const geom = new THREE.PlaneGeometry(size * 2, size * 2, 64, 64);
    geom.rotateX(-Math.PI / 2);
    // soft terrain bumps
    const positions = geom.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const h = Math.sin(x * 0.3) * 0.05 + Math.cos(z * 0.4) * 0.05;
      positions.setY(i, h);
    }
    positions.needsUpdate = true;
    geom.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: this.preset.floor.color, roughness: 0.95 });
    const grass = new THREE.Mesh(geom, mat);
    this.scene.add(grass);
    this._meshes.push(grass);

    // grass blades (instanced billboards)
    const bladeGeo = new THREE.PlaneGeometry(0.1, 0.35);
    bladeGeo.translate(0, 0.17, 0);
    const bladeMat = new THREE.MeshBasicMaterial({
      color: this.preset.floor.grid,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const count = 600;
    const inst = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * size * 0.9;
      const a = Math.random() * Math.PI * 2;
      dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.scale.set(1, 0.7 + Math.random() * 0.8, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(inst);
    this._meshes.push(inst);

    // physics floor
    const floor = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    floor.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(floor);
    this._bodies.push(floor);
  }

  _mountains() {
    const grp = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      const distance = 28;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(3 + Math.random() * 2, 6 + Math.random() * 3, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a4f3a, roughness: 1 }),
      );
      mountain.position.set(x, 2.5, z);
      grp.add(mountain);
    }
    this.scene.add(grp);
    this._meshes.push(grp);
  }

  _softBoundary() {
    const sb = this.preset.softBoundary || { radius: 14, returnForce: 12 };
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(sb.radius, 0.08, 6, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    this.scene.add(ring);
    this._meshes.push(ring);

    this._tickers.push((dt) => {
      // soft pull-back happens in combat layer where we know the players
      void dt;
    });

    this.softBoundary = sb;
  }
}
