// ============================================================
// arenas/base.js — Abstract arena base class.
//
// Each preset under `src/data/arenas.js` is matched with a
// builder that knows how to assemble the physics colliders and
// render meshes. Hazards are exposed through `activeHazards()`
// so the combat layer can poll their position each step.
// ============================================================

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class ArenaBase {
  constructor(preset, world, scene) {
    this.preset = preset;
    this.world = world;
    this.scene = scene;
    /** @type {Array<{ position:{x:number,y:number,z:number}, radius:number, type:string, damage:number }>} */
    this._hazards = [];
    this._meshes = [];
    this._bodies = [];
    this._tickers = [];
  }

  /** Subclasses should populate the world / scene here. */
  build() { /* abstract */ }

  /** Step animation logic (rotating blades, conveyors, …). */
  step(dt, totalTime) {
    for (const t of this._tickers) t(dt, totalTime);
  }

  /** Active hazards for the combat layer. */
  activeHazards() { return this._hazards; }

  /** Remove all owned physics + meshes from the world. */
  dispose() {
    for (const mesh of this._meshes) {
      this.scene.remove(mesh);
      mesh.traverse?.(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.dispose && m.dispose();
        }
      });
    }
    for (const body of this._bodies) {
      try { this.world.removeBody(body); } catch (_e) {}
    }
    this._meshes.length = 0;
    this._bodies.length = 0;
    this._hazards.length = 0;
    this._tickers.length = 0;
  }

  /** Helper: add a static plane / box ground. */
  _ground(size, color, gridColor) {
    const half = size / 2;
    const geom = new THREE.PlaneGeometry(size, size, 32, 32);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.1 });
    const mesh = new THREE.Mesh(geom, mat);
    this.scene.add(mesh);
    this._meshes.push(mesh);

    // grid overlay for arena vibe
    const gridSize = 12;
    const grid = new THREE.GridHelper(size, gridSize, gridColor, gridColor);
    grid.position.y = 0.01;
    this.scene.add(grid);
    this._meshes.push(grid);

    const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(floorBody);
    this._bodies.push(floorBody);
    void half;
  }

  /** Helper: add walls around the arena. */
  _walls(size, height = 4) {
    const half = size / 2;
    const wallShape = new CANNON.Box(new CANNON.Vec3(half, height / 2, 0.3));
    const positions = [
      { x: 0, y: height / 2, z:  half + 0.3, ry: 0 },
      { x: 0, y: height / 2, z: -half - 0.3, ry: 0 },
      { x:  half + 0.3, y: height / 2, z: 0, ry: Math.PI / 2 },
      { x: -half - 0.3, y: height / 2, z: 0, ry: Math.PI / 2 },
    ];
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x202030, roughness: 0.7, metalness: 0.15, transparent: true, opacity: 0.6,
    });
    for (const p of positions) {
      const body = new CANNON.Body({ mass: 0, shape: wallShape });
      body.position.set(p.x, p.y, p.z);
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), p.ry);
      this.world.addBody(body);
      this._bodies.push(body);

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, height, 0.6), wallMat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = p.ry;
      this.scene.add(mesh);
      this._meshes.push(mesh);
    }
  }
}
