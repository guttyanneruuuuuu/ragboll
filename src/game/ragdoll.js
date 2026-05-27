// ============================================================
// Ragdoll — physics-driven humanoid character built with cannon-es.
// ============================================================
// 10 limbs joined by ConeTwist/Hinge constraints. Each joint can be
// "locked" (constraint stiffened + motor torque zeroed) when damaged,
// simulating Ragdoll Blade's signature penalty system.
//
// Limb layout:
//   head         capsule  ─┐ neck    (ConeTwist)
//   chest        box       │
//   pelvis       box       │ spine   (ConeTwist)
//   lUpperArm    capsule   │ lShoulder
//   lLowerArm    capsule   │ lElbow  (Hinge)
//   rUpperArm    capsule   │ rShoulder
//   rLowerArm    capsule   │ rElbow  (Hinge)
//   lThigh       capsule   │ lHip
//   lShin        capsule   │ lKnee   (Hinge)
//   rThigh       capsule   │ rHip
//   rShin        capsule   │ rKnee   (Hinge)
// ============================================================

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const JOINT_KEYS = [
  'neck', 'spine', 'lShoulder', 'rShoulder', 'lElbow', 'rElbow',
  'lHip', 'rHip', 'lKnee', 'rKnee'
];

export class Ragdoll {
  /**
   * @param {object} opts
   * @param {CANNON.World} opts.world
   * @param {THREE.Scene} opts.scene
   * @param {THREE.Vector3} opts.position
   * @param {number} opts.bodyColor    hex
   * @param {number} opts.accentColor  hex (joints/eyes)
   * @param {string} opts.name
   */
  constructor(opts) {
    this.world = opts.world;
    this.scene = opts.scene;
    this.name = opts.name || 'P';
    this.bodyColor = opts.bodyColor ?? 0xff6677;
    this.accentColor = opts.accentColor ?? 0xffcc33;
    this.position = opts.position || new THREE.Vector3();

    this.bodies = {};       // name -> CANNON.Body
    this.meshes = {};       // name -> THREE.Mesh
    this.constraints = {};  // name -> CANNON.Constraint
    this.joints = {};       // jointKey -> { constraint, locked: bool }
    this.parts = [];        // ordered list of {name, body, mesh}

    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;

    this._build();
  }

  // ---------- construction ----------
  _mat(color) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.1,
      emissive: color,
      emissiveIntensity: 0.1,
    });
  }

  _addPart(name, shape, halfExtents, position, mass, color) {
    const body = new CANNON.Body({
      mass,
      shape,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.2,
      angularDamping: 0.2,
      collisionFilterGroup: 2,        // ragdoll group
      collisionFilterMask:  1 | 4,    // collide with world + swords (NOT other ragdoll parts)
    });
    body.userData = { ragdoll: this, partName: name };
    this.world.addBody(body);

    // mesh
    let geo;
    if (shape instanceof CANNON.Box) {
      geo = new THREE.BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2);
    } else if (shape instanceof CANNON.Sphere) {
      geo = new THREE.SphereGeometry(halfExtents, 16, 12);
    } else if (shape.type === CANNON.Shape.types.CYLINDER || shape.constructor === CANNON.Cylinder) {
      geo = new THREE.CylinderGeometry(halfExtents.radiusTop, halfExtents.radiusBottom, halfExtents.height, 12);
    } else {
      geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    }
    const mesh = new THREE.Mesh(geo, this._mat(color));
    mesh.castShadow = true;
    this.scene.add(mesh);

    this.bodies[name] = body;
    this.meshes[name] = mesh;
    this.parts.push({ name, body, mesh });
    return body;
  }

  _build() {
    const p = this.position;
    const bc = this.bodyColor;
    const ac = this.accentColor;

    // ---- HEAD ----
    const scale = 1.35;
    const headRadius = 0.26 * scale;
    this._addPart('head', new CANNON.Sphere(headRadius), headRadius,
      new THREE.Vector3(p.x, p.y + 2.55 * scale, p.z), 1.5, ac);

    // ---- CHEST ----
    const chestHE = new CANNON.Vec3(0.38 * scale, 0.42 * scale, 0.24 * scale);
    this._addPart('chest', new CANNON.Box(chestHE), chestHE,
      new THREE.Vector3(p.x, p.y + 1.95 * scale, p.z), 6.0, bc);

    // ---- PELVIS ----
    const pelvHE = new CANNON.Vec3(0.34 * scale, 0.24 * scale, 0.22 * scale);
    this._addPart('pelvis', new CANNON.Box(pelvHE), pelvHE,
      new THREE.Vector3(p.x, p.y + 1.25 * scale, p.z), 4.0, bc);

    // ---- Arms (cylinder via Box for stability) ----
    const upperArmHE = new CANNON.Vec3(0.11 * scale, 0.30 * scale, 0.11 * scale);
    const lowerArmHE = new CANNON.Vec3(0.10 * scale, 0.28 * scale, 0.10 * scale);

    this._addPart('lUpperArm', new CANNON.Box(upperArmHE), upperArmHE,
      new THREE.Vector3(p.x - 0.62 * scale, p.y + 1.95 * scale, p.z), 1.5, bc);
    this._addPart('lLowerArm', new CANNON.Box(lowerArmHE), lowerArmHE,
      new THREE.Vector3(p.x - 0.62 * scale, p.y + 1.35 * scale, p.z), 1.0, bc);

    this._addPart('rUpperArm', new CANNON.Box(upperArmHE), upperArmHE,
      new THREE.Vector3(p.x + 0.62 * scale, p.y + 1.95 * scale, p.z), 1.5, bc);
    this._addPart('rLowerArm', new CANNON.Box(lowerArmHE), lowerArmHE,
      new THREE.Vector3(p.x + 0.62 * scale, p.y + 1.35 * scale, p.z), 1.0, bc);

    // ---- Legs ----
    const thighHE = new CANNON.Vec3(0.13 * scale, 0.38 * scale, 0.13 * scale);
    const shinHE  = new CANNON.Vec3(0.12 * scale, 0.36 * scale, 0.12 * scale);

    this._addPart('lThigh', new CANNON.Box(thighHE), thighHE,
      new THREE.Vector3(p.x - 0.18 * scale, p.y + 0.72 * scale, p.z), 2.5, bc);
    this._addPart('lShin', new CANNON.Box(shinHE), shinHE,
      new THREE.Vector3(p.x - 0.18 * scale, p.y + 0.06 * scale, p.z), 1.8, bc);

    this._addPart('rThigh', new CANNON.Box(thighHE), thighHE,
      new THREE.Vector3(p.x + 0.18 * scale, p.y + 0.72 * scale, p.z), 2.5, bc);
    this._addPart('rShin', new CANNON.Box(shinHE), shinHE,
      new THREE.Vector3(p.x + 0.18 * scale, p.y + 0.06 * scale, p.z), 1.8, bc);

    // ---- Constraints ----
    const Vec = (x, y, z) => new CANNON.Vec3(x, y, z);

    const addConeTwist = (key, a, b, pivotA, pivotB, swing = Math.PI/4, twist = Math.PI/6) => {
      const c = new CANNON.ConeTwistConstraint(a, b, {
        pivotA, pivotB,
        axisA: Vec(0,1,0), axisB: Vec(0,1,0),
        angle: swing,
        twistAngle: twist,
        maxForce: 1e7,
      });
      this.world.addConstraint(c);
      this.constraints[key] = c;
      this.joints[key] = { constraint: c, locked: false, swing, twist };
    };

    const addHinge = (key, a, b, pivotA, pivotB, axis = Vec(1,0,0)) => {
      const c = new CANNON.HingeConstraint(a, b, {
        pivotA, pivotB,
        axisA: axis, axisB: axis,
        maxForce: 1e7,
      });
      this.world.addConstraint(c);
      this.constraints[key] = c;
      this.joints[key] = { constraint: c, locked: false, hinge: true };
    };

    // neck (head -> chest)
    addConeTwist('neck',
      this.bodies.head, this.bodies.chest,
      Vec(0, -headRadius, 0), Vec(0,  chestHE.y, 0),
      Math.PI/6, Math.PI/8);

    // spine (chest -> pelvis)
    addConeTwist('spine',
      this.bodies.chest, this.bodies.pelvis,
      Vec(0, -chestHE.y, 0), Vec(0,  pelvHE.y, 0),
      Math.PI/8, Math.PI/10);

    // shoulders
    addConeTwist('lShoulder',
      this.bodies.chest, this.bodies.lUpperArm,
      Vec(-chestHE.x - 0.05,  chestHE.y - 0.08, 0), Vec(0,  upperArmHE.y, 0),
      Math.PI/2, Math.PI/3);
    addConeTwist('rShoulder',
      this.bodies.chest, this.bodies.rUpperArm,
      Vec( chestHE.x + 0.05,  chestHE.y - 0.08, 0), Vec(0,  upperArmHE.y, 0),
      Math.PI/2, Math.PI/3);

    // elbows (hinge)
    addHinge('lElbow',
      this.bodies.lUpperArm, this.bodies.lLowerArm,
      Vec(0, -upperArmHE.y, 0), Vec(0,  lowerArmHE.y, 0),
      Vec(1,0,0));
    addHinge('rElbow',
      this.bodies.rUpperArm, this.bodies.rLowerArm,
      Vec(0, -upperArmHE.y, 0), Vec(0,  lowerArmHE.y, 0),
      Vec(1,0,0));

    // hips
    addConeTwist('lHip',
      this.bodies.pelvis, this.bodies.lThigh,
      Vec(-0.15, -pelvHE.y, 0), Vec(0,  thighHE.y, 0),
      Math.PI/3, Math.PI/8);
    addConeTwist('rHip',
      this.bodies.pelvis, this.bodies.rThigh,
      Vec( 0.15, -pelvHE.y, 0), Vec(0,  thighHE.y, 0),
      Math.PI/3, Math.PI/8);

    // knees (hinge)
    addHinge('lKnee',
      this.bodies.lThigh, this.bodies.lShin,
      Vec(0, -thighHE.y, 0), Vec(0,  shinHE.y, 0),
      Vec(1,0,0));
    addHinge('rKnee',
      this.bodies.rThigh, this.bodies.rShin,
      Vec(0, -thighHE.y, 0), Vec(0,  shinHE.y, 0),
      Vec(1,0,0));

    // simple humanoid face accents (eyes) for readability
    const eyeGeo = new THREE.SphereGeometry(0.055 * scale, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.scene.add(this.leftEye);
    this.scene.add(this.rightEye);

    // Default body posture forces — gentle upright torque on chest so the
    // character doesn't immediately face-plant. Disabled when "ragdolled"=true.
    this.uprightStrength = 35;
    this.ragdolled = false;
  }

  // ---------- runtime ----------

  /** Apply standing torque to chest/pelvis. Toggle off when knocked out. */
  applyUprightTorque() {
    if (this.ragdolled) return;
    const chest = this.bodies.chest;
    const pelvis = this.bodies.pelvis;
    // current up-axis after rotation
    const localUp = new CANNON.Vec3(0,1,0);
    const worldUp = new CANNON.Vec3();
    chest.quaternion.vmult(localUp, worldUp);
    // torque = up_local × up_world  (rotational error to vertical)
    const desired = new CANNON.Vec3(0,1,0);
    const error = new CANNON.Vec3();
    worldUp.cross(desired, error);
    const torque = error.scale(this.uprightStrength);
    // damp angular velocity to avoid wobble
    const damp = chest.angularVelocity.scale(-2);
    chest.torque.vadd(torque, chest.torque);
    chest.torque.vadd(damp, chest.torque);

    // pelvis lighter
    const localUp2 = new CANNON.Vec3(0,1,0);
    const worldUp2 = new CANNON.Vec3();
    pelvis.quaternion.vmult(localUp2, worldUp2);
    const err2 = new CANNON.Vec3();
    worldUp2.cross(desired, err2);
    pelvis.torque.vadd(err2.scale(20), pelvis.torque);
  }

  /** Apply horizontal walking force on pelvis/chest. */
  walk(dir, strength = 25) {
    if (this.ragdolled || !this.alive) return;
    const f = new CANNON.Vec3(dir.x * strength, 0, dir.z * strength);
    this.bodies.pelvis.applyForce(f, this.bodies.pelvis.position);
    // tilt chest slightly forward in movement direction (anim hint)
    const tilt = new CANNON.Vec3(dir.z * 4, 0, -dir.x * 4);
    this.bodies.chest.torque.vadd(tilt, this.bodies.chest.torque);
  }

  jump(impulse = 8) {
    if (this.ragdolled || !this.alive) return;
    const onGround = this.bodies.lShin.position.y < 0.2 || this.bodies.rShin.position.y < 0.2;
    if (!onGround) return false;
    this.bodies.pelvis.velocity.y = impulse;
    this.bodies.chest.velocity.y = impulse * 0.9;
    return true;
  }

  /**
   * "Lock" a joint when damaged. Reduces its compliance so the limb stops
   * being driven by upright forces (effectively paralyzes that limb).
   */
  lockJoint(jointKey) {
    const j = this.joints[jointKey];
    if (!j || j.locked) return false;
    j.locked = true;
    // For ConeTwist, narrow the angle to 0 so the joint becomes rigid
    if (j.constraint.angle !== undefined) {
      j.constraint.angle = 0.05;
      j.constraint.twistAngle = 0.05;
    }
    // Hinge joints have no angle clamp here; just tag visually
    // also: dampen the bodies attached
    return true;
  }

  unlockAllJoints() {
    JOINT_KEYS.forEach((k) => {
      const j = this.joints[k];
      if (!j) return;
      j.locked = false;
      if (j.swing !== undefined && j.constraint.angle !== undefined) {
        j.constraint.angle = j.swing;
        j.constraint.twistAngle = j.twist;
      }
    });
  }

  /** Damage and possibly lock a joint based on which body part was hit. */
  receiveHit(partName, damage, hitPoint, hitDir) {
    if (!this.alive) return null;
    this.hp = Math.max(0, this.hp - damage);
    const jointForPart = {
      head: 'neck',
      chest: 'spine',
      pelvis: 'spine',
      lUpperArm: 'lShoulder',
      lLowerArm: 'lElbow',
      rUpperArm: 'rShoulder',
      rLowerArm: 'rElbow',
      lThigh: 'lHip',
      lShin: 'lKnee',
      rThigh: 'rHip',
      rShin: 'rKnee',
    };
    const jk = jointForPart[partName];
    let locked = false;
    if (jk) locked = this.lockJoint(jk);

    // knockback impulse on hit body
    if (this.bodies[partName] && hitDir) {
      const force = hitDir.clone().multiplyScalar(damage * 1.2);
      this.bodies[partName].applyImpulse(
        new CANNON.Vec3(force.x, force.y + damage*0.05, force.z),
        new CANNON.Vec3(hitPoint.x, hitPoint.y, hitPoint.z)
      );
    }

    if (this.hp <= 0) {
      this.alive = false;
      this.ragdolled = true;
    }
    // critical damage (head) also ragdolls temporarily
    if (partName === 'head' && damage > 25) this.ragdolled = true;
    return { joint: jk, locked, hpRatio: this.hp / this.maxHp };
  }

  /** Sync Three meshes from cannon bodies. */
  sync() {
    for (const p of this.parts) {
      p.mesh.position.copy(p.body.position);
      p.mesh.quaternion.copy(p.body.quaternion);
    }
    if (this.leftEye && this.rightEye) {
      const h = this.bodies.head;
      const l = new CANNON.Vec3(-0.08, 0.03, 0.22);
      const r = new CANNON.Vec3(0.08, 0.03, 0.22);
      const lw = h.pointToWorldFrame(l);
      const rw = h.pointToWorldFrame(r);
      this.leftEye.position.set(lw.x, lw.y, lw.z);
      this.rightEye.position.set(rw.x, rw.y, rw.z);
    }
  }

  /** AABB center for camera tracking. */
  centerPosition(out = new THREE.Vector3()) {
    const c = this.bodies.chest.position;
    return out.set(c.x, c.y, c.z);
  }

  /** Returns world position of right hand (sword anchor). */
  rightHandWorld(out = new THREE.Vector3()) {
    const b = this.bodies.rLowerArm;
    out.set(b.position.x, b.position.y - 0.28, b.position.z);
    return out;
  }

  dispose() {
    for (const p of this.parts) {
      this.world.removeBody(p.body);
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    Object.values(this.constraints).forEach((c) => this.world.removeConstraint(c));
    if (this.leftEye) { this.scene.remove(this.leftEye); this.leftEye.geometry.dispose(); this.leftEye.material.dispose(); }
    if (this.rightEye) { this.scene.remove(this.rightEye); this.rightEye.geometry.dispose(); this.rightEye.material.dispose(); }
    this.bodies = {}; this.meshes = {}; this.constraints = {}; this.joints = {}; this.parts = [];
  }
}

export { JOINT_KEYS };
