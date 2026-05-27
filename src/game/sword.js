// ============================================================
// Sword — a kinematic blade that swings to match the player's
// pointer/swipe input. Generates hit events when the tip's trail
// intersects an opponent body part.
// ============================================================
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Sword {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {CANNON.World} opts.world
   * @param {string} opts.owner   - player id ('p1' | 'p2')
   * @param {number} opts.color   - hex blade color
   */
  constructor(opts) {
    this.scene = opts.scene;
    this.world = opts.world;
    this.owner = opts.owner;
    this.color = opts.color ?? 0xeeeeff;

    this.length = 1.4;      // blade length
    this.handleLen = 0.25;
    this.totalLen = this.length + this.handleLen;
    this.damageMul = 1.0;

    this._build();
    this._buildTrail();

    // swing state
    this.swingActive = false;
    this.swingSpeed = 0;      // magnitude
    this.lastTipPos = new THREE.Vector3();
    this.tipPos = new THREE.Vector3();
    this.hitCooldown = new Map(); // partName -> timestamp
  }

  setPreset(name) {
    const preset = {
      katana: { len: 1.4, damage: 1.0, trail: 1.0 },
      greatsword: { len: 1.7, damage: 1.3, trail: 1.2 },
      spear: { len: 1.95, damage: 0.9, trail: 0.8 },
    }[name] ?? { len: 1.4, damage: 1.0, trail: 1.0 };
    this.length = preset.len;
    this.totalLen = this.length + this.handleLen;
    this.damageMul = preset.damage;
    this.trailMesh.scale.setScalar(preset.trail);
    this.mesh.children[0].scale.y = this.length / 1.4;
    this.mesh.children[0].position.y = this.length / 2;
  }

  _build() {
    const group = new THREE.Group();
    // blade
    const bladeGeo = new THREE.BoxGeometry(0.06, this.length, 0.015);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.6,
      metalness: 0.9,
      roughness: 0.15,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = this.length / 2;
    group.add(blade);

    // guard
    const guardGeo = new THREE.BoxGeometry(0.22, 0.04, 0.06);
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xc0a060, metalness: 0.7, roughness: 0.3 });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = 0;
    group.add(guard);

    // handle
    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, this.handleLen, 8);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x402010 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = -this.handleLen / 2;
    group.add(handle);

    // pommel
    const pommelGeo = new THREE.SphereGeometry(0.04, 8, 6);
    const pommel = new THREE.Mesh(pommelGeo, guardMat);
    pommel.position.y = -this.handleLen;
    group.add(pommel);

    this.mesh = group;
    this.scene.add(group);
  }

  _buildTrail() {
    // Glowing trail behind the blade tip — implemented as a tapered
    // ribbon (BufferGeometry that we update each frame).
    this.trailLen = 12;
    const positions = new Float32Array(this.trailLen * 2 * 3); // 2 verts per segment
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const idx = [];
    for (let i = 0; i < this.trailLen - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      idx.push(a, c, b,  b, c, d);
    }
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.trailMesh = new THREE.Mesh(geo, mat);
    this.trailMesh.frustumCulled = false;
    this.scene.add(this.trailMesh);

    this.trailHistory = []; // {pos:Vec3, perp:Vec3, age}
  }

  /**
   * Position the sword from owner's right hand outward in a target dir.
   * @param {THREE.Vector3} handWorld
   * @param {THREE.Vector3} aim - world-space direction the player wants the tip to go
   * @param {number} progress  - 0..1 swing progress (rest -> extended)
   */
  setPose(handWorld, aim, progress = 0.5) {
    // base position = right hand
    this.mesh.position.copy(handWorld);
    // orient sword so its +Y aligns with aim direction
    const dir = aim.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    this.mesh.quaternion.copy(q);

    // compute tip
    this.lastTipPos.copy(this.tipPos);
    this.tipPos.copy(handWorld).addScaledVector(dir, this.totalLen);

    // swing speed (used as damage multiplier)
    this.swingSpeed = this.tipPos.distanceTo(this.lastTipPos);

    // push trail point
    if (this.swingActive) {
      const perpAxis = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(0.05);
      this.trailHistory.unshift({
        pos: this.tipPos.clone(),
        perp: perpAxis,
        age: 0,
      });
      if (this.trailHistory.length > this.trailLen) this.trailHistory.pop();
    } else {
      // fade out
      if (this.trailHistory.length) this.trailHistory.pop();
    }
    this._updateTrailGeometry();
  }

  _updateTrailGeometry() {
    const arr = this.trailMesh.geometry.attributes.position.array;
    for (let i = 0; i < this.trailLen; i++) {
      const p = this.trailHistory[i];
      if (!p) {
        // collapse to origin
        arr[i*6+0] = arr[i*6+3] = 0;
        arr[i*6+1] = arr[i*6+4] = -1000;
        arr[i*6+2] = arr[i*6+5] = 0;
        continue;
      }
      const taper = 1 - i / this.trailLen;
      const ox = p.perp.x * taper;
      const oy = p.perp.y * taper;
      const oz = p.perp.z * taper;
      arr[i*6+0] = p.pos.x + ox;
      arr[i*6+1] = p.pos.y + oy;
      arr[i*6+2] = p.pos.z + oz;
      arr[i*6+3] = p.pos.x - ox;
      arr[i*6+4] = p.pos.y - oy;
      arr[i*6+5] = p.pos.z - oz;
    }
    this.trailMesh.geometry.attributes.position.needsUpdate = true;
    this.trailMesh.material.opacity = this.swingActive ? 0.7 : Math.max(0, this.trailMesh.material.opacity - 0.05);
  }

  /** Test if blade segment hits any body in `targets` (Ragdoll[]). */
  testHits(targets, now) {
    const hits = [];
    if (this.swingSpeed < 0.02) return hits;

    // Segment from tip back to hand position along the blade
    const tip = this.tipPos;
    const last = this.lastTipPos;
    const swept = new THREE.Vector3().subVectors(tip, last);
    const sweptLen = swept.length();
    if (sweptLen < 0.001) return hits;

    for (const t of targets) {
      if (!t.alive) continue;
      for (const part of t.parts) {
        // simple sphere hit test using part's halfExtents approx radius
        const b = part.body;
        const p = b.position;
        const partPos = new THREE.Vector3(p.x, p.y, p.z);
        // radius: heuristic from shape bounds
        let r = 0.2;
        const shape = b.shapes[0];
        if (shape instanceof CANNON.Sphere) r = shape.radius;
        else if (shape instanceof CANNON.Box) r = Math.max(shape.halfExtents.x, shape.halfExtents.y, shape.halfExtents.z) * 1.05;

        // distance from part center to blade segment
        const ab = swept;
        const ap = new THREE.Vector3().subVectors(partPos, last);
        const t_ = Math.max(0, Math.min(1, ap.dot(ab) / (sweptLen * sweptLen)));
        const proj = new THREE.Vector3().copy(last).addScaledVector(ab, t_);
        const dist = proj.distanceTo(partPos);
        if (dist < r + 0.05) {
          // cooldown
          const k = `${t.name}:${part.name}`;
          const last_t = this.hitCooldown.get(k) || 0;
          if (now - last_t < 200) continue;
          this.hitCooldown.set(k, now);
          // damage proportional to swing speed
          const speedKmh = this.swingSpeed * 60; // arbitrary scale
          const dmg = Math.min(45, 8 + speedKmh * 1.5) * this.damageMul;
          hits.push({
            target: t,
            partName: part.name,
            point: proj,
            dir: new THREE.Vector3().copy(ab).normalize(),
            damage: dmg,
          });
        }
      }
    }
    return hits;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.scene.remove(this.trailMesh);
    this.trailMesh.geometry.dispose();
    this.trailMesh.material.dispose();
  }
}
