// ============================================================
// ragdoll.js — Procedural humanoid built out of capsules,
// boxes and cone-twist style constraints.
//
// The body uses 13 rigid bodies (pelvis, torso, head, two
// upper-arms, two forearms, two thighs, two shins, two feet)
// joined with cannon-es `ConeTwistConstraint` and a couple of
// `PointToPointConstraint`s. Each joint has a `health` value
// that the combat layer drains; once depleted the joint locks
// up — i.e. the motor strength is zeroed and the limb is
// effectively dead weight.
//
// Visuals are kept intentionally cartoony to evoke the original
// Ragdoll Blade: round head, single-colour limbs, two eye dots.
// ============================================================

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { clamp, lerp } from '../util/math.js';

/** Stable joint identifiers used everywhere (HUD, events, …). */
export const JOINT_KEYS = Object.freeze([
  'neck',
  'shoulderL', 'shoulderR',
  'elbowL',    'elbowR',
  'waist',
  'hipL',      'hipR',
  'kneeL',     'kneeR',
  'ankleL',    'ankleR',
]);

/** Generic body part identifiers (used to score limb-targeting cards). */
export const BODY_PARTS = Object.freeze({
  HEAD:     'head',
  TORSO:    'torso',
  PELVIS:   'pelvis',
  ARM_L:    'upperArmL',
  ARM_R:    'upperArmR',
  FOREARM_L:'forearmL',
  FOREARM_R:'forearmR',
  THIGH_L:  'thighL',
  THIGH_R:  'thighR',
  SHIN_L:   'shinL',
  SHIN_R:   'shinR',
  FOOT_L:   'footL',
  FOOT_R:   'footR',
});

const DEFAULT_JOINT_HP = 100;

/**
 * Build the Three.js + cannon-es representation of one ragdoll.
 */
export class Ragdoll {
  constructor(opts) {
    this.world = opts.world;
    this.scene = opts.scene;
    this.name  = opts.name || 'P';
    this.scale = clamp(opts.scale ?? 1.0, 0.5, 2.0);
    this.bodyColor   = opts.bodyColor   ?? 0xff4455;
    this.accentColor = opts.accentColor ?? 0xffcc33;
    this.facing = opts.facing ?? 1; // 1 = facing +X, -1 = facing -X
    this.position = opts.position ? opts.position.clone() : new THREE.Vector3(0, 0, 0);

    /** @type {Map<string, CANNON.Body>} */
    this.bodies = new Map();
    /** @type {Map<string, THREE.Mesh>}  */
    this.meshes = new Map();
    /** @type {Map<string, CANNON.Constraint>} */
    this.constraints = new Map();
    /** @type {Map<string, number>} */
    this.jointHealth = new Map();
    /** @type {Set<string>} */
    this.lockedJoints = new Set();
    /** Total HP for the entire ragdoll (sum of joints). */
    this.maxHp = JOINT_KEYS.length * DEFAULT_JOINT_HP;
    this.hp = this.maxHp;
    /** Whether the player has been knocked out. */
    this.defeated = false;
    /** Last hit timestamp for combat feedback / combo decay. */
    this.lastHitAt = 0;
    /** Optional sword reference (assigned by the combat layer). */
    this.sword = null;
    /** Per-fighter modifiers applied from cards / loadout. */
    this.modifiers = opts.modifiers || {};

    this._build(opts);
  }

  // ------------------------------------------------------------
  // Construction
  // ------------------------------------------------------------

  _build(opts) {
    const s = this.scale;
    // Sizes — rough proportional human at ~1.85m tall.
    const sizes = {
      pelvis:    { x: 0.45 * s, y: 0.30 * s, z: 0.30 * s, mass: 6.0 },
      torso:     { x: 0.55 * s, y: 0.55 * s, z: 0.30 * s, mass: 8.5 },
      head:      { r: 0.22 * s,                          mass: 2.0 },
      upperArm:  { l: 0.45 * s, r: 0.10 * s,             mass: 1.6 },
      forearm:   { l: 0.40 * s, r: 0.09 * s,             mass: 1.2 },
      thigh:     { l: 0.55 * s, r: 0.13 * s,             mass: 3.0 },
      shin:      { l: 0.50 * s, r: 0.11 * s,             mass: 2.5 },
      foot:      { x: 0.22 * s, y: 0.10 * s, z: 0.30 * s, mass: 0.6 },
    };
    this._sizes = sizes;

    // Anchor positions in world space.
    const origin = this.position;
    const pelvisY = 1.05 * s;

    const pelvis = this._makeBox('pelvis', sizes.pelvis, [origin.x, origin.y + pelvisY, origin.z]);
    const torso  = this._makeBox('torso',  sizes.torso,  [origin.x, origin.y + pelvisY + sizes.pelvis.y/2 + sizes.torso.y/2, origin.z]);
    const head   = this._makeSphere('head', sizes.head,  [origin.x, origin.y + pelvisY + sizes.pelvis.y/2 + sizes.torso.y + sizes.head.r * 0.8, origin.z]);

    const armOffset = sizes.torso.x/2 + sizes.upperArm.r * 1.6;
    const upperArmL = this._makeCapsule('upperArmL', sizes.upperArm, [origin.x - armOffset, origin.y + pelvisY + sizes.pelvis.y/2 + sizes.torso.y * 0.7, origin.z]);
    const upperArmR = this._makeCapsule('upperArmR', sizes.upperArm, [origin.x + armOffset, origin.y + pelvisY + sizes.pelvis.y/2 + sizes.torso.y * 0.7, origin.z]);
    const forearmL  = this._makeCapsule('forearmL',  sizes.forearm,  [origin.x - armOffset, origin.y + pelvisY + sizes.pelvis.y/2 + sizes.torso.y * 0.7 - sizes.upperArm.l - sizes.forearm.l/2, origin.z]);
    const forearmR  = this._makeCapsule('forearmR',  sizes.forearm,  [origin.x + armOffset, origin.y + pelvisY + sizes.pelvis.y/2 + sizes.torso.y * 0.7 - sizes.upperArm.l - sizes.forearm.l/2, origin.z]);

    const hipOffset = sizes.pelvis.x/2 - sizes.thigh.r * 1.0;
    const thighL = this._makeCapsule('thighL', sizes.thigh, [origin.x - hipOffset, origin.y + pelvisY - sizes.pelvis.y/2 - sizes.thigh.l/2, origin.z]);
    const thighR = this._makeCapsule('thighR', sizes.thigh, [origin.x + hipOffset, origin.y + pelvisY - sizes.pelvis.y/2 - sizes.thigh.l/2, origin.z]);
    const shinL  = this._makeCapsule('shinL',  sizes.shin,  [origin.x - hipOffset, origin.y + pelvisY - sizes.pelvis.y/2 - sizes.thigh.l - sizes.shin.l/2, origin.z]);
    const shinR  = this._makeCapsule('shinR',  sizes.shin,  [origin.x + hipOffset, origin.y + pelvisY - sizes.pelvis.y/2 - sizes.thigh.l - sizes.shin.l/2, origin.z]);
    const footL  = this._makeBox('footL', sizes.foot, [origin.x - hipOffset, origin.y + 0.05, origin.z + 0.06 * s]);
    const footR  = this._makeBox('footR', sizes.foot, [origin.x + hipOffset, origin.y + 0.05, origin.z + 0.06 * s]);

    // ----- Visuals: stylised meshes -----
    this._addBoxMesh('pelvis',   sizes.pelvis,   this.bodyColor);
    this._addBoxMesh('torso',    sizes.torso,    this.bodyColor);
    this._addSphereMesh('head',  sizes.head,     this.bodyColor);
    this._addCapsuleMesh('upperArmL', sizes.upperArm, this.bodyColor);
    this._addCapsuleMesh('upperArmR', sizes.upperArm, this.bodyColor);
    this._addCapsuleMesh('forearmL',  sizes.forearm,  this.bodyColor);
    this._addCapsuleMesh('forearmR',  sizes.forearm,  this.bodyColor);
    this._addCapsuleMesh('thighL', sizes.thigh, this.bodyColor);
    this._addCapsuleMesh('thighR', sizes.thigh, this.bodyColor);
    this._addCapsuleMesh('shinL',  sizes.shin,  this.bodyColor);
    this._addCapsuleMesh('shinR',  sizes.shin,  this.bodyColor);
    this._addBoxMesh('footL', sizes.foot, this.accentColor);
    this._addBoxMesh('footR', sizes.foot, this.accentColor);
    this._addEyes();

    // ----- Joints -----
    this._jointBetween('waist',     pelvis, torso,
      [0,  sizes.pelvis.y/2, 0],
      [0, -sizes.torso.y/2, 0],
      0.6);
    this._jointBetween('neck',      torso, head,
      [0,  sizes.torso.y/2, 0],
      [0, -sizes.head.r * 0.7, 0],
      0.55);
    this._jointBetween('shoulderL', torso, upperArmL,
      [-sizes.torso.x/2, sizes.torso.y/2 - 0.05 * s, 0],
      [0,  sizes.upperArm.l/2, 0],
      1.2);
    this._jointBetween('shoulderR', torso, upperArmR,
      [ sizes.torso.x/2, sizes.torso.y/2 - 0.05 * s, 0],
      [0,  sizes.upperArm.l/2, 0],
      1.2);
    this._jointBetween('elbowL',    upperArmL, forearmL,
      [0, -sizes.upperArm.l/2, 0],
      [0,  sizes.forearm.l/2, 0],
      0.7);
    this._jointBetween('elbowR',    upperArmR, forearmR,
      [0, -sizes.upperArm.l/2, 0],
      [0,  sizes.forearm.l/2, 0],
      0.7);
    this._jointBetween('hipL',      pelvis, thighL,
      [-hipOffset, -sizes.pelvis.y/2, 0],
      [0,  sizes.thigh.l/2, 0],
      1.0);
    this._jointBetween('hipR',      pelvis, thighR,
      [ hipOffset, -sizes.pelvis.y/2, 0],
      [0,  sizes.thigh.l/2, 0],
      1.0);
    this._jointBetween('kneeL',     thighL, shinL,
      [0, -sizes.thigh.l/2, 0],
      [0,  sizes.shin.l/2, 0],
      0.65);
    this._jointBetween('kneeR',     thighR, shinR,
      [0, -sizes.thigh.l/2, 0],
      [0,  sizes.shin.l/2, 0],
      0.65);
    this._jointBetween('ankleL',    shinL, footL,
      [0, -sizes.shin.l/2, 0],
      [0,  sizes.foot.y/2,  -0.05 * s],
      0.5);
    this._jointBetween('ankleR',    shinR, footR,
      [0, -sizes.shin.l/2, 0],
      [0,  sizes.foot.y/2,  -0.05 * s],
      0.5);

    // Set up initial health values; cards / modifiers can scale.
    for (const key of JOINT_KEYS) {
      const bonus = this.modifiers.jointHp || 0;
      const scale = 1 + (this.modifiers.jointHpScale || 0);
      this.jointHealth.set(key, Math.max(20, (DEFAULT_JOINT_HP + bonus) * scale));
    }
    this.maxHp = Array.from(this.jointHealth.values()).reduce((a,b) => a+b, 0);
    this.hp = this.maxHp;

    // Orient torso to face the chosen direction.
    if (this.facing < 0) this._yaw(pelvis, Math.PI);
  }

  _makeBox(key, size, position) {
    const half = new CANNON.Vec3(size.x/2, size.y/2, size.z/2);
    const body = new CANNON.Body({ mass: size.mass, shape: new CANNON.Box(half) });
    body.position.set(position[0], position[1], position[2]);
    body.linearDamping  = 0.12;
    body.angularDamping = 0.18;
    body.userData = { ragdoll: this, key };
    body.allowSleep = false;
    this.world.addBody(body);
    this.bodies.set(key, body);
    return body;
  }

  _makeSphere(key, size, position) {
    const body = new CANNON.Body({ mass: size.mass, shape: new CANNON.Sphere(size.r) });
    body.position.set(position[0], position[1], position[2]);
    body.linearDamping = 0.18;
    body.angularDamping = 0.28;
    body.userData = { ragdoll: this, key };
    body.allowSleep = false;
    this.world.addBody(body);
    this.bodies.set(key, body);
    return body;
  }

  _makeCapsule(key, size, position) {
    // cannon-es does not ship a capsule shape so we approximate
    // with a cylinder for inertia plus two spheres for contact.
    const cyl = new CANNON.Cylinder(size.r, size.r, size.l - size.r * 2, 12);
    const body = new CANNON.Body({ mass: size.mass });
    body.addShape(cyl);
    body.addShape(new CANNON.Sphere(size.r), new CANNON.Vec3(0,  (size.l/2 - size.r), 0));
    body.addShape(new CANNON.Sphere(size.r), new CANNON.Vec3(0, -(size.l/2 - size.r), 0));
    body.position.set(position[0], position[1], position[2]);
    body.linearDamping = 0.12;
    body.angularDamping = 0.18;
    body.userData = { ragdoll: this, key };
    body.allowSleep = false;
    this.world.addBody(body);
    this.bodies.set(key, body);
    return body;
  }

  _addBoxMesh(key, size, color) {
    const geom = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat  = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.bodyKey = key;
    this.scene.add(mesh);
    this.meshes.set(key, mesh);
  }

  _addSphereMesh(key, size, color) {
    const geom = new THREE.SphereGeometry(size.r, 16, 12);
    const mat  = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.bodyKey = key;
    this.scene.add(mesh);
    this.meshes.set(key, mesh);
  }

  _addCapsuleMesh(key, size, color) {
    const group = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(size.r, size.r, size.l - size.r * 2, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 }),
    );
    const topCap = new THREE.Mesh(
      new THREE.SphereGeometry(size.r, 12, 8),
      cyl.material,
    );
    const botCap = topCap.clone();
    topCap.position.y =  (size.l/2 - size.r);
    botCap.position.y = -(size.l/2 - size.r);
    group.add(cyl, topCap, botCap);
    group.userData.bodyKey = key;
    this.scene.add(group);
    this.meshes.set(key, group);
  }

  _addEyes() {
    const head = this.meshes.get('head');
    if (!head) return;
    const eyeMat  = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat= new THREE.MeshBasicMaterial({ color: 0x111111 });
    const r = this._sizes.head.r;
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 10, 8), eyeMat);
    const eyeR = eyeL.clone();
    const pupL = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 8, 6), pupilMat);
    const pupR = pupL.clone();
    eyeL.position.set(-r * 0.32, r * 0.15, r * 0.78);
    eyeR.position.set( r * 0.32, r * 0.15, r * 0.78);
    pupL.position.set(-r * 0.32, r * 0.18, r * 0.92);
    pupR.position.set( r * 0.32, r * 0.18, r * 0.92);
    head.add(eyeL, eyeR, pupL, pupR);
    this._eyes = { eyeL, eyeR, pupL, pupR };
  }

  _yaw(body, radians) {
    const q = new CANNON.Quaternion();
    q.setFromEuler(0, radians, 0);
    body.quaternion.mult(q, body.quaternion);
  }

  _jointBetween(key, a, b, pivotA, pivotB, twistRange) {
    const c = new CANNON.ConeTwistConstraint(a, b, {
      pivotA: new CANNON.Vec3(...pivotA),
      pivotB: new CANNON.Vec3(...pivotB),
      axisA:  new CANNON.Vec3(0, 1, 0),
      axisB:  new CANNON.Vec3(0, 1, 0),
      angle:  twistRange,
      twistAngle: 0.5,
      maxForce: 1e6,
    });
    c.collideConnected = false;
    this.world.addConstraint(c);
    this.constraints.set(key, c);
  }

  // ------------------------------------------------------------
  // Per-frame sync
  // ------------------------------------------------------------

  sync() {
    for (const [key, body] of this.bodies) {
      const mesh = this.meshes.get(key);
      if (!mesh) continue;
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
  }

  // ------------------------------------------------------------
  // Damage / joint locking
  // ------------------------------------------------------------

  damageJoint(key, amount) {
    if (!this.jointHealth.has(key)) return 0;
    if (this.lockedJoints.has(key)) return 0;
    const hp = this.jointHealth.get(key) - amount;
    this.jointHealth.set(key, hp);
    this.lastHitAt = performance.now();
    if (hp <= 0) {
      this.lockedJoints.add(key);
      const constraint = this.constraints.get(key);
      if (constraint) constraint.maxForce = 0; // limp limb
      return amount + hp; // overflow
    }
    return amount;
  }

  damageBodyKey(bodyKey, amount) {
    const map = {
      head: 'neck', torso: 'waist', pelvis: 'waist',
      upperArmL: 'shoulderL', upperArmR: 'shoulderR',
      forearmL:  'elbowL',    forearmR:  'elbowR',
      thighL:    'hipL',      thighR:    'hipR',
      shinL:     'kneeL',     shinR:     'kneeR',
      footL:     'ankleL',    footR:     'ankleR',
    };
    const joint = map[bodyKey] || 'waist';
    return this.damageJoint(joint, amount);
  }

  /** Total remaining hp as a 0..1 fraction. */
  hpFraction() {
    let total = 0;
    for (const v of this.jointHealth.values()) total += Math.max(0, v);
    return clamp(total / this.maxHp, 0, 1);
  }

  /** Apply a velocity impulse at `point` to a specific body part. */
  applyHitImpulse(bodyKey, force, point) {
    const body = this.bodies.get(bodyKey);
    if (!body) return;
    body.applyImpulse(
      new CANNON.Vec3(force.x, force.y, force.z),
      new CANNON.Vec3(point.x - body.position.x, point.y - body.position.y, point.z - body.position.z),
    );
  }

  /** Wake up every body — used when respawning. */
  wakeAll() {
    for (const body of this.bodies.values()) body.wakeUp();
  }

  // ------------------------------------------------------------
  // Movement (root motion)
  // ------------------------------------------------------------

  /**
   * Apply a movement impulse to the pelvis. The combat layer
   * calls this every fixed step, passing the desired velocity.
   */
  applyMove(direction, strength = 12) {
    const pelvis = this.bodies.get('pelvis');
    if (!pelvis) return;
    const grounded = this._groundContacts() > 0;
    const factor = grounded ? 1.0 : 0.25;
    pelvis.applyImpulse(
      new CANNON.Vec3(direction.x * strength * factor, 0, direction.z * strength * factor),
      new CANNON.Vec3(0, 0, 0),
    );
    if (grounded && Math.hypot(direction.x, direction.z) > 0.01) {
      // gentle hop so the ragdoll bounces "alive"
      pelvis.applyImpulse(new CANNON.Vec3(0, 1.6, 0), new CANNON.Vec3(0, 0, 0));
    }
  }

  /** Apply a jump impulse if grounded. */
  applyJump(strength = 7.5) {
    if (this._groundContacts() === 0) return false;
    const pelvis = this.bodies.get('pelvis');
    if (!pelvis) return false;
    pelvis.applyImpulse(new CANNON.Vec3(0, strength, 0), new CANNON.Vec3(0, 0, 0));
    return true;
  }

  /** Try to face a world-space point. */
  faceTowards(target) {
    const pelvis = this.bodies.get('pelvis');
    if (!pelvis) return;
    const dx = target.x - pelvis.position.x;
    const dz = target.z - pelvis.position.z;
    if (dx*dx + dz*dz < 0.01) return;
    const yaw = Math.atan2(dx, dz);
    const desired = new CANNON.Quaternion();
    desired.setFromEuler(0, yaw, 0);
    pelvis.quaternion.slerp(desired, 0.04, pelvis.quaternion);
  }

  _groundContacts() {
    const pelvis = this.bodies.get('pelvis');
    if (!pelvis) return 0;
    let count = 0;
    for (const c of this.world.contacts) {
      const bi = c.bi, bj = c.bj;
      if (bi === pelvis || bj === pelvis) count++;
    }
    return count;
  }

  /** Dispose all physics + render resources (called on round end). */
  dispose() {
    for (const constraint of this.constraints.values()) {
      try { this.world.removeConstraint(constraint); } catch (_err) { /* ignore */ }
    }
    this.constraints.clear();
    for (const body of this.bodies.values()) {
      try { this.world.removeBody(body); } catch (_err) { /* ignore */ }
    }
    this.bodies.clear();
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) m.dispose && m.dispose();
      }
    }
    this.meshes.clear();
  }

  /** Convenience: world position of the head. */
  headPosition() {
    const head = this.bodies.get('head');
    return head ? head.position : { x: 0, y: 0, z: 0 };
  }

  /** Convenience: world position of the pelvis. */
  pelvisPosition() {
    const pelvis = this.bodies.get('pelvis');
    return pelvis ? pelvis.position : { x: 0, y: 0, z: 0 };
  }

  /** Centre of mass approximation. */
  centerOfMass() {
    let x = 0, y = 0, z = 0, total = 0;
    for (const body of this.bodies.values()) {
      const m = body.mass;
      x += body.position.x * m;
      y += body.position.y * m;
      z += body.position.z * m;
      total += m;
    }
    if (total < 1e-6) return { x: 0, y: 0, z: 0 };
    return { x: x/total, y: y/total, z: z/total };
  }

  /** Approximate forward direction in world coordinates. */
  forwardVector() {
    const pelvis = this.bodies.get('pelvis');
    if (!pelvis) return { x: 0, y: 0, z: 1 };
    const q = pelvis.quaternion;
    const x = 2 * (q.x * q.z + q.w * q.y);
    const z = 1 - 2 * (q.x * q.x + q.y * q.y);
    return { x, y: 0, z };
  }

  /** Inspect joint health for HUD rendering. */
  jointStatus() {
    const out = {};
    for (const key of JOINT_KEYS) {
      const hp = this.jointHealth.get(key) ?? 0;
      out[key] = {
        hp,
        max: DEFAULT_JOINT_HP * (1 + (this.modifiers.jointHpScale || 0)),
        locked: this.lockedJoints.has(key),
      };
    }
    return out;
  }

  /** Are all critical joints (head/torso) destroyed? */
  isKnockedOut() {
    if (this.defeated) return true;
    const neck = this.jointHealth.get('neck') ?? 0;
    const waist = this.jointHealth.get('waist') ?? 0;
    if (neck <= -10 || waist <= -10) return true;
    // Or every limb is locked
    let limbsLocked = 0;
    for (const key of ['shoulderL','shoulderR','hipL','hipR']) {
      if (this.lockedJoints.has(key)) limbsLocked++;
    }
    return limbsLocked >= 4;
  }
}
