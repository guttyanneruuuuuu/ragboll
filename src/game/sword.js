// ============================================================
// sword.js — Weapon attached to a ragdoll's right hand.
//
// Visual geometry is procedurally built from the weapon preset
// in `src/data/weapons.js`. A circular buffer of recent blade
// tip positions is used to test swing-vs-ragdoll collision and
// to render the colourful trail.
// ============================================================

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { clamp } from '../util/math.js';
import { getWeapon } from '../data/weapons.js';

const TRAIL_SAMPLES = 18;

export class Sword {
  constructor(opts) {
    this.scene = opts.scene;
    this.world = opts.world;
    this.owner = opts.owner;            // Ragdoll instance
    this.weapon = opts.weapon || getWeapon('katana');
    this.modifiers = opts.modifiers || {};
    this.trailColor = opts.trailColor || this.weapon.trail;
    this.dropped = false;

    const length = this.weapon.length * (1 + (this.modifiers.weaponLength || 0));
    const mass   = this.weapon.mass   * (1 + (this.modifiers.weaponMass   || 0));
    this.length = length;
    this.mass   = mass;
    this.blade  = this.weapon.blade  * (1 + (this.modifiers.weaponLength || 0));
    this.handleLength = length - this.blade;
    this.tipOffset = length / 2;
    this.swingForceScale = (this.weapon.swingForce || 1) * (1 + (this.modifiers.swingForce || 0));
    this.guardBreak = clamp((this.weapon.guardBreak || 0) + (this.modifiers.guardBreak || 0), 0, 1);
    this.crit       = clamp((this.weapon.crit       || 0) + (this.modifiers.critChance || 0), 0, 1);
    this.bleed      = (this.weapon.bleed || 0) + (this.modifiers.bleed || 0);
    this.jointBreak = (this.weapon.jointBreak || 1) * (1 + (this.modifiers.jointBreak || 0));

    this._buildMesh();
    this._buildBody();
    this._buildTrail();
  }

  _buildMesh() {
    const group = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeff, metalness: 0.9, roughness: 0.18, emissive: 0x222244, emissiveIntensity: 0.3,
    });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.2 });
    const guardMat  = new THREE.MeshStandardMaterial({ color: this.weapon.spark || 0xffd966, metalness: 0.7, roughness: 0.3 });

    // Handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, this.handleLength, 12), handleMat);
    handle.position.y = -this.length / 2 + this.handleLength / 2;
    group.add(handle);

    // Guard (cross-piece)
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), guardMat);
    guard.position.y = -this.length / 2 + this.handleLength;
    group.add(guard);

    // Blade — shape depends on weapon model hint.
    const hint = this.weapon.model && this.weapon.model.type || 'katana';
    const bladeMesh = this._buildBladeMesh(hint, bladeMat);
    bladeMesh.position.y = -this.length / 2 + this.handleLength + this.blade / 2;
    group.add(bladeMesh);

    // Pommel
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), guardMat);
    pommel.position.y = -this.length / 2;
    group.add(pommel);

    this.mesh = group;
    this.scene.add(this.mesh);
  }

  _buildBladeMesh(kind, mat) {
    const blade = this.blade;
    const w = this.weapon.width;
    switch (kind) {
      case 'greatsword':
        return new THREE.Mesh(new THREE.BoxGeometry(w * 1.4, blade, 0.015), mat);
      case 'rapier':
        return new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, blade, 0.012), mat);
      case 'twin':
        return new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, blade, 0.012), mat);
      case 'axe': {
        const g = new THREE.Group();
        const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, blade, 10), mat);
        const head = new THREE.Mesh(new THREE.BoxGeometry(w * 2.0, w * 1.4, 0.04), mat);
        head.position.y = blade / 2 - w * 0.7;
        g.add(haft, head);
        return g;
      }
      case 'spear': {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, blade * 0.85, 10), mat);
        const tip   = new THREE.Mesh(new THREE.ConeGeometry(0.06, blade * 0.15, 12), mat);
        tip.position.y = blade / 2 + (blade * 0.15) / 2 - blade * 0.075;
        g.add(shaft, tip);
        return g;
      }
      case 'scythe': {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, blade * 0.9, 10), mat);
        const head  = new THREE.Mesh(new THREE.TorusGeometry(blade * 0.32, 0.014, 6, 18, Math.PI * 0.9), mat);
        head.position.y = blade / 2 - blade * 0.15;
        head.rotation.z = -Math.PI / 2;
        g.add(shaft, head);
        return g;
      }
      case 'hammer': {
        const g = new THREE.Group();
        const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, blade, 10), mat);
        const head = new THREE.Mesh(new THREE.BoxGeometry(w * 1.8, w * 1.6, w * 1.6), mat);
        head.position.y = blade / 2 - w * 0.8;
        g.add(haft, head);
        return g;
      }
      case 'naginata': {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, blade * 0.85, 10), mat);
        const head  = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, blade * 0.25, 0.012), mat);
        head.position.y = blade / 2 - blade * 0.12;
        g.add(shaft, head);
        return g;
      }
      case 'plasma': {
        const g = new THREE.Group();
        const core = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, blade, 10),
          new THREE.MeshBasicMaterial({ color: this.weapon.trail || 0x33ffff }),
        );
        const glow = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, blade, 10),
          new THREE.MeshBasicMaterial({
            color: this.weapon.spark || 0x99ffff,
            transparent: true,
            opacity: 0.35,
          }),
        );
        g.add(core, glow);
        return g;
      }
      case 'estoc':
        return new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, blade, 0.01), mat);
      case 'short':
      default:
        return new THREE.Mesh(new THREE.BoxGeometry(w, blade, 0.012), mat);
    }
  }

  _buildBody() {
    const body = new CANNON.Body({ mass: this.mass });
    const half = new CANNON.Vec3(0.05, this.length / 2, 0.05);
    body.addShape(new CANNON.Box(half));
    body.linearDamping  = 0.2;
    body.angularDamping = 0.2;
    body.allowSleep = false;
    body.collisionFilterGroup = 2;
    body.userData = { sword: this };
    const hand = this.owner.bodies.get('forearmR');
    if (hand) {
      body.position.copy(hand.position);
      body.position.y -= 0.1;
    }
    this.world.addBody(body);
    this.body = body;

    // Attach to the right forearm with a stiff cone-twist so the
    // sword "follows" the hand but can still rotate.
    const constraint = new CANNON.PointToPointConstraint(
      hand, new CANNON.Vec3(0, -0.18, 0.04),
      body, new CANNON.Vec3(0, this.length / 2 - 0.04, 0),
    );
    constraint.collideConnected = false;
    this.world.addConstraint(constraint);
    this.constraint = constraint;

    const guideConstraint = new CANNON.PointToPointConstraint(
      hand, new CANNON.Vec3(0, -0.28, 0.04),
      body, new CANNON.Vec3(0, this.length / 2 - 0.18, 0),
    );
    guideConstraint.collideConnected = false;
    this.world.addConstraint(guideConstraint);
    this.guideConstraint = guideConstraint;
  }

  _buildTrail() {
    this.tipHistory = new Array(TRAIL_SAMPLES);
    for (let i = 0; i < TRAIL_SAMPLES; i++) this.tipHistory[i] = new THREE.Vector3();
    this.tipIndex = 0;
    this.tipFilled = 0;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(TRAIL_SAMPLES * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: this.trailColor,
      linewidth: 3,
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(geom, mat);
    line.frustumCulled = false;
    this.scene.add(line);
    this.trail = line;
  }

  /** Compute the current world-space tip position. */
  tipPosition() {
    const local = new THREE.Vector3(0, this.length / 2, 0);
    const out = new THREE.Vector3();
    // approximate: use cannon-es position + quaternion
    out.copy(this.body.position);
    const q = this.body.quaternion;
    const v = new THREE.Vector3(local.x, local.y, local.z);
    v.applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    out.add(v);
    return out;
  }

  /** Compute the world-space handle (base) position. */
  basePosition() {
    const local = new THREE.Vector3(0, -this.length / 2, 0);
    const out = new THREE.Vector3();
    out.copy(this.body.position);
    const q = this.body.quaternion;
    const v = new THREE.Vector3(local.x, local.y, local.z);
    v.applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    out.add(v);
    return out;
  }

  /** Update trail buffer and mesh. */
  updateTrail() {
    const tip = this.tipPosition();
    this.tipHistory[this.tipIndex].copy(tip);
    this.tipIndex = (this.tipIndex + 1) % TRAIL_SAMPLES;
    this.tipFilled = Math.min(this.tipFilled + 1, TRAIL_SAMPLES);
    const arr = this.trail.geometry.attributes.position.array;
    for (let i = 0; i < TRAIL_SAMPLES; i++) {
      const sample = this.tipHistory[(this.tipIndex + i) % TRAIL_SAMPLES];
      arr[i*3+0] = sample.x;
      arr[i*3+1] = sample.y;
      arr[i*3+2] = sample.z;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.computeBoundingSphere();
  }

  /** Sync the rendered group to the physics body. */
  sync() {
    if (!this.mesh) return;
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
    this.updateTrail();
  }

  /** Apply a swing impulse onto the sword body. */
  swing(direction, power) {
    if (!this.body || this.dropped) return;
    const strength = power * this.swingForceScale * 28;
    this.body.applyImpulse(
      new CANNON.Vec3(direction.x * strength, direction.y * strength, direction.z * strength),
      new CANNON.Vec3(0, this.length / 2 - 0.1, 0),
    );
    // Add torque so the blade rotates instead of just translating.
    const torque = new CANNON.Vec3(direction.z, 0.6, -direction.x);
    torque.scale(strength * 0.4, torque);
    this.body.angularVelocity.vadd(torque, this.body.angularVelocity);
  }

  /** Compute the linear velocity at the tip. */
  tipVelocity() {
    const lv = this.body.velocity;
    const av = this.body.angularVelocity;
    // r = tip relative to centre
    const r = new CANNON.Vec3(0, this.length / 2, 0);
    const q = this.body.quaternion;
    q.vmult(r, r);
    const cross = new CANNON.Vec3();
    av.cross(r, cross);
    return { x: lv.x + cross.x, y: lv.y + cross.y, z: lv.z + cross.z };
  }

  /** Force the sword to drop (player loses grip). */
  drop() {
    if (this.dropped) return;
    if (this.constraint) {
      try { this.world.removeConstraint(this.constraint); } catch (_err) { /* ignore */ }
      this.constraint = null;
    }
    if (this.guideConstraint) {
      try { this.world.removeConstraint(this.guideConstraint); } catch (_err) { /* ignore */ }
      this.guideConstraint = null;
    }
    this.dropped = true;
  }

  /** Pick the sword back up (used by AI / cards). */
  pickup() {
    if (!this.dropped) return;
    const hand = this.owner.bodies.get('forearmR');
    if (!hand) return;
    const constraint = new CANNON.PointToPointConstraint(
      hand, new CANNON.Vec3(0, -0.18, 0.04),
      this.body, new CANNON.Vec3(0, this.length / 2 - 0.04, 0),
    );
    constraint.collideConnected = false;
    this.world.addConstraint(constraint);
    this.constraint = constraint;
    this.dropped = false;
  }

  /** Dispose physics + render resources. */
  dispose() {
    if (this.constraint) try { this.world.removeConstraint(this.constraint); } catch (_e) {}
    if (this.guideConstraint) try { this.world.removeConstraint(this.guideConstraint); } catch (_e) {}
    if (this.body) try { this.world.removeBody(this.body); } catch (_e) {}
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.dispose && m.dispose();
        }
      });
    }
    if (this.trail) {
      this.scene.remove(this.trail);
      this.trail.geometry.dispose();
      this.trail.material.dispose();
    }
  }
}
