// ============================================================
// Game — 3D ragdoll sword combat arena.
//
// Modes:
//   solo          : YOU (P1) vs simple AI (P2)
//   local-versus  : P1=WASD+Mouse, P2=Arrow+IJKL    (split keyboard)
//   online-host   : YOU=P1, remote input drives P2  (server-authoritative)
//   online-joiner : YOU=P2, send inputs to host
// ============================================================
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Ragdoll, JOINT_KEYS } from './ragdoll.js';
import { Sword } from './sword.js';
import { InputManager } from './input.js';
import { AudioEngine } from '../audio/audio.js';
import { Effects } from './effects.js';

export class Game {
  constructor(opts) {
    this.canvas    = opts.canvas;
    this.settings  = opts.settings;
    this.hud       = opts.hud;
    this.net       = opts.net || null;
    this.mode      = opts.mode;
    this.onLoadProgress = opts.onLoadProgress || (() => {});
    this.onMatchEnd     = opts.onMatchEnd || (() => {});
    this.running = false;
    this.paused = false;

    // stats
    this.stats = { damageDealt: 0, maxCombo: 0, combo: 0, comboTimeout: 0, jointsLocked: 0 };
    this._ended = false;
  }

  async init() {
    // ---------- renderer ----------
    this.onLoadProgress(15, 'WebGL 初期化...');
    const lowQ = this.settings.quality === 'low';
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !lowQ,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.settings.quality === 'high' ? Math.min(devicePixelRatio, 2) : 1);
    this.renderer.shadowMap.enabled = false; // shadows off for perf
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._resize();
    window.addEventListener('resize', this._resizeBound = () => this._resize());

    // ---------- scene ----------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a14);
    this.scene.fog = new THREE.Fog(0x0a0a14, 18, 60);

    this.camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 200);
    this.camera.position.set(0, 7, 11);
    this.camera.lookAt(0, 1.2, 0);

    // ---------- lights ----------
    this.scene.add(new THREE.AmbientLight(0x6666aa, 0.45));
    const key = new THREE.DirectionalLight(0xffeec0, 1.1);
    key.position.set(10, 14, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xff5577, 0.5);
    fill.position.set(-10, 5, -4);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x33ffee, 0.35);
    rim.position.set(0, 6, -12);
    this.scene.add(rim);

    // ---------- physics ----------
    this.onLoadProgress(35, '物理エンジン起動...');
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -19.6, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 12;
    this.world.allowSleep = false;
    this.world.defaultContactMaterial.friction = 0.6;
    this.world.defaultContactMaterial.restitution = 0.05;

    // ---------- arena ----------
    this.onLoadProgress(50, 'アリーナ構築...');
    this._buildArena();

    // ---------- fighters ----------
    this.onLoadProgress(70, 'ファイター生成...');
    this.p1 = new Ragdoll({
      world: this.world, scene: this.scene,
      position: new THREE.Vector3(-2.5, 0, 0),
      bodyColor: 0xff4455, accentColor: 0xffcc33, name: 'P1',
    });
    this.p2 = new Ragdoll({
      world: this.world, scene: this.scene,
      position: new THREE.Vector3( 2.5, 0, 0),
      bodyColor: 0x33aaff, accentColor: 0x33ffee, name: 'P2',
    });
    // Make them face each other initially by tweaking yaw via tiny torque later.

    // ---------- swords ----------
    this.s1 = new Sword({ scene: this.scene, world: this.world, owner: 'p1', color: 0xffffff });
    this.s2 = new Sword({ scene: this.scene, world: this.world, owner: 'p2', color: 0xccffff });
    this.s1.setPreset(this.settings.weapon);
    this.s2.setPreset(this.settings.weapon);

    // ---------- audio / fx ----------
    this.audio = new AudioEngine(this.settings);
    this.fx = new Effects(this.scene, this.camera, this.settings);
    this.fx.recordCameraBase();

    // ---------- input ----------
    this.onLoadProgress(85, '入力設定...');
    this.input = new InputManager(this.canvas, { sensitivity: this.settings.sensitivity });

    // P1 swing state
    this.p1Swing = new SwingState();
    this.p2Swing = new SwingState();

    // HUD
    const p1Name = this.mode === 'solo' ? 'YOU' : this.mode === 'online-joiner' ? 'OPPONENT' : 'P1';
    const p2Name = this.mode === 'solo' ? 'AI'  : this.mode === 'online-joiner' ? 'YOU' : 'P2';
    this.hud.setNames(p1Name, p2Name);
    this.hud.setHp(1, 1); this.hud.setHp(2, 1);
    this.hud.setRound(1);

    // Network wiring
    if (this.net && this.mode.startsWith('online')) this._wireNetwork();

    this.onLoadProgress(100, 'GO!');
  }

  _buildArena() {
    // Floor (disk arena)
    const radius = 9;
    const floorGeo = new THREE.CylinderGeometry(radius, radius, 0.6, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1c0e30, metalness: 0.35, roughness: 0.55,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.3;
    this.scene.add(floor);

    // Physics floor
    const floorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      collisionFilterGroup: 1, collisionFilterMask: 0xffff,
    });
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
    this.world.addBody(floorBody);

    // Neon rings
    for (let i = 0; i < 3; i++) {
      const r = radius - 0.5 - i*0.4;
      const ringGeo = new THREE.TorusGeometry(r, 0.05, 6, 96);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xff3344 : i === 1 ? 0xffcc33 : 0x33ffee,
        transparent: true,
        opacity: 0.55 - i*0.1,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05 + i*0.005;
      this.scene.add(ring);
    }

    // Ring-out wall (invisible cylinder so fighters fall off if pushed too far)
    // We skip — the arena is a disk over the floor with sloped edge handled by gameplay (out-of-bounds check).

    // Bg deco — distant pillars
    for (let i = 0; i < 8; i++) {
      const ang = i / 8 * Math.PI * 2;
      const px = Math.cos(ang) * 20;
      const pz = Math.sin(ang) * 20;
      const ph = 6 + Math.random() * 4;
      const g = new THREE.BoxGeometry(0.5, ph, 0.5);
      const m = new THREE.MeshStandardMaterial({ color: 0x0e0822, emissive: 0x220033, emissiveIntensity: 0.4 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(px, ph/2 - 0.5, pz);
      this.scene.add(mesh);
    }

    // Optional stage gimmicks
    this.hazardBlades = [];
    if (this.settings.arena === 'hazard') {
      this._spawnHazardBlade(0, 0, 3.5, 1.5);
      this._spawnHazardBlade(0, 0, -3.5, -1.8);
    }
  }

  _spawnHazardBlade(x, y, z, spin) {
    const g = new THREE.BoxGeometry(3.2, 0.1, 0.35);
    const m = new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0x550000, metalness: 0.8, roughness: 0.25 });
    const blade = new THREE.Mesh(g, m);
    blade.position.set(x, y + 0.25, z);
    this.scene.add(blade);
    this.hazardBlades.push({ mesh: blade, spin });
  }

  _wireNetwork() {
    this.net.on('data', (msg) => {
      if (this.mode === 'online-host') {
        if (msg.type === 'input') this._remoteInput = msg.data;
      } else if (this.mode === 'online-joiner') {
        if (msg.type === 'state') this._applyRemoteState(msg.data);
      }
    });
  }

  _applyRemoteState(s) {
    // Apply received state to local bodies (lerped) — server-authoritative.
    const apply = (rag, ps) => {
      if (!ps) return;
      for (const partName in ps) {
        const b = rag.bodies[partName];
        if (!b) continue;
        const o = ps[partName];
        b.position.set(o.x, o.y, o.z);
        b.quaternion.set(o.qx, o.qy, o.qz, o.qw);
        b.velocity.set(0,0,0);
        b.angularVelocity.set(0,0,0);
      }
      if (ps.__hp !== undefined) { rag.hp = ps.__hp; }
    };
    apply(this.p1, s.p1);
    apply(this.p2, s.p2);
    this.hud.setHp(1, this.p1.hp / this.p1.maxHp);
    this.hud.setHp(2, this.p2.hp / this.p2.maxHp);
  }

  start() {
    this.running = true;
    this.startTime = performance.now();
    this.lastTick = this.startTime;
    this.audio.startBgm();
    this._loop();
  }
  pause()  { this.paused = true; }
  resume() { if (this.running) { this.paused = false; this.lastTick = performance.now(); } }
  restart() {
    this.dispose();
    this.init().then(() => this.start());
  }
  dispose() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    if (this._resizeBound) window.removeEventListener('resize', this._resizeBound);
    this.audio?.stopBgm();
    this.p1?.dispose(); this.p2?.dispose();
    this.s1?.dispose(); this.s2?.dispose();
    this.scene?.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.renderer?.dispose();
  }

  _resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }

  // ============================================================
  //  MAIN LOOP
  // ============================================================
  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    if (!this.running) return;
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (this.paused) { this._render(); return; }

    // hit-stop: skip game update
    if (this.fx.isHitStopped()) {
      this._render();
      return;
    }
    const scaled = dt * this.fx.timeScale;

    this.input.pollKeyboard();
    this._updateMatchTimer(now);

    // simulate
    if (this.mode !== 'online-joiner') {
      // host is authoritative
      this._stepPlayers(scaled, now);
      this.world.step(1/60, scaled, 4);
      this._postSimulate(scaled, now);

      if (this.mode === 'online-host') this._broadcastState();
    } else {
      // joiner: just send inputs, render received state
      this._sendInput();
      this.p1.sync(); this.p2.sync();
      // still update local sword visuals based on input
      this._stepLocalSwingOnly(scaled);
    }

    this.fx.update(scaled);
    this._updateCamera(scaled);

    this._render();
  }

  _stepPlayers(dt, now) {
    // P1 = local
    this._driveP1(dt, now);
    // P2 = AI or local2 or remote
    if (this.mode === 'solo') this._driveAI(dt, now);
    else if (this.mode === 'local-versus') this._driveP2Local(dt, now);
    else if (this.mode === 'online-host') this._driveP2Remote(dt, now);

    // upright torques + ground push
    this.p1.applyUprightTorque();
    this.p2.applyUprightTorque();
  }

  _stepLocalSwingOnly(dt) {
    // Update sword pose for local player's visual feedback only
    this._driveP1Sword(dt);
  }

  // ----- P1 control -----
  _driveP1(dt, now) {
    const m = this.input.move;
    // camera-relative movement on XZ plane (camera looks toward -Z)
    const dir = new THREE.Vector3(m.x, 0, m.y);
    if (dir.lengthSq() > 0.001) dir.normalize();
    this.p1.walk(dir, 60);
    if (this.input.consumeJump()) {
      if (this.p1.jump()) this.audio.whoosh(0.5);
    }
    this._driveP1Sword(dt);
  }

  _driveP1Sword(dt) {
    const sw = this.input.consumeSwing();
    const sg = this.p1Swing;
    sg.accumulate(sw);

    // hand position
    const hand = new THREE.Vector3();
    this.p1.rightHandWorld(hand);

    // aim direction: convert 2D swipe into world dir
    //   x → camera right, y → camera up*-? we'll use world Y
    const cam = this.camera;
    const camRight = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    const aim = new THREE.Vector3().copy(sg.aim);
    const worldAim = new THREE.Vector3()
      .addScaledVector(camRight, aim.x)
      .addScaledVector(new THREE.Vector3(0, -1, 0), aim.y * 0.8) // screen y down = aim down
      .addScaledVector(new THREE.Vector3().crossVectors(camRight, new THREE.Vector3(0,1,0)).negate(), 0.4); // base forward
    if (worldAim.lengthSq() < 0.001) worldAim.set(0, 0.6, -1);
    worldAim.normalize();

    this.s1.swingActive = sg.swingStrength > 0.04 || this.input.swinging;
    this.s1.setPose(hand, worldAim, 0.5);

    // whoosh on starting a fast swing
    if (this.s1.swingActive && this.s1.swingSpeed > 0.4 && !sg.didWhoosh) {
      this.audio.whoosh(Math.min(1, this.s1.swingSpeed * 0.6));
      sg.didWhoosh = true;
      setTimeout(() => { sg.didWhoosh = false; }, 250);
    }

    // hit test against opponent
    const hits = this.s1.testHits([this.p2], performance.now());
    for (const h of hits) this._applyHit(1, h);

    sg.decay(dt);
  }

  // ----- P2 control -----
  _driveAI(dt, now) {
    // simple AI: approach player, swing periodically.
    const me = this.p2, foe = this.p1;
    const myPos = me.bodies.pelvis.position;
    const foePos = foe.bodies.pelvis.position;
    const dir = new THREE.Vector3(foePos.x - myPos.x, 0, foePos.z - myPos.z);
    const dist = dir.length();
    if (dist > 0.001) dir.divideScalar(dist);

    if (foe.alive) {
      // approach
      if (dist > 1.4) me.walk(dir, 55);
      else me.walk(dir.multiplyScalar(-0.5), 25); // back off slightly
    }

    // sword
    const hand = new THREE.Vector3();
    me.rightHandWorld(hand);
    this._aiSwingTimer = (this._aiSwingTimer || 0) + dt;

    let aim;
    if (this._aiSwingTimer > 1.0 && dist < 2.5 && foe.alive) {
      // initiate swing toward foe with arc motion
      this._aiSwingPhase = (this._aiSwingPhase || 0) + dt * 6;
      const baseDir = new THREE.Vector3(-dir.x, 0, -dir.z); // toward foe (dir is foe-from-me so we need same; using dir actually)
      const toFoe = new THREE.Vector3(foePos.x - myPos.x, foePos.y + 0.5 - myPos.y, foePos.z - myPos.z).normalize();
      const lateral = new THREE.Vector3().crossVectors(toFoe, new THREE.Vector3(0,1,0)).multiplyScalar(Math.sin(this._aiSwingPhase) * 0.8);
      aim = toFoe.add(lateral).normalize();
      this.s2.swingActive = true;
      if (this._aiSwingTimer > 1.7) {
        this._aiSwingTimer = 0;
        this._aiSwingPhase = 0;
      }
    } else {
      aim = new THREE.Vector3(-dir.x, 0.5, -dir.z).normalize();
      this.s2.swingActive = false;
    }
    this.s2.setPose(hand, aim, 0.5);

    const hits = this.s2.testHits([this.p1], performance.now());
    for (const h of hits) this._applyHit(2, h);
  }

  _driveP2Local(dt, now) {
    // P2 keys: Arrow + IJKL for swing
    // (handled by InputManager later — for v0 we reuse AI movement)
    this._driveAI(dt, now);
  }
  _driveP2Remote(dt, now) {
    const ri = this._remoteInput;
    if (!ri) { this._driveAI(dt, now); return; }
    // Apply remote inputs to P2
    const dir = new THREE.Vector3(ri.mx || 0, 0, ri.my || 0);
    if (dir.lengthSq() > 0.001) dir.normalize();
    this.p2.walk(dir, 60);
    if (ri.jump) this.p2.jump();
    // remote swing
    const hand = new THREE.Vector3();
    this.p2.rightHandWorld(hand);
    const aim = new THREE.Vector3(ri.ax || 0, ri.ay || 0.5, ri.az || -1).normalize();
    this.s2.swingActive = !!ri.swinging;
    this.s2.setPose(hand, aim, 0.5);
    const hits = this.s2.testHits([this.p1], performance.now());
    for (const h of hits) this._applyHit(2, h);
  }

  _sendInput() {
    if (!this.net) return;
    const m = this.input.move;
    const sw = this.input.swingDelta;
    const data = {
      mx: m.x, my: m.y,
      ax: sw.x * 0.01, ay: 0.5, az: -1,
      swinging: this.input.swinging,
      jump: this.input.jumpPressed,
    };
    this.net.send({ type: 'input', data });
  }

  _broadcastState() {
    if (!this.net) return;
    const snap = (rag) => {
      const out = {};
      for (const p of rag.parts) {
        out[p.name] = {
          x: +p.body.position.x.toFixed(3),
          y: +p.body.position.y.toFixed(3),
          z: +p.body.position.z.toFixed(3),
          qx: +p.body.quaternion.x.toFixed(3),
          qy: +p.body.quaternion.y.toFixed(3),
          qz: +p.body.quaternion.z.toFixed(3),
          qw: +p.body.quaternion.w.toFixed(3),
        };
      }
      out.__hp = rag.hp;
      return out;
    };
    // throttle 20Hz
    const now = performance.now();
    if (!this._lastSend || now - this._lastSend > 50) {
      this._lastSend = now;
      this.net.send({ type: 'state', data: { p1: snap(this.p1), p2: snap(this.p2) } });
    }
  }

  // ----- common hit handler -----
  _applyHit(attackerIdx, hit) {
    const r = hit.target.receiveHit(hit.partName, hit.damage, hit.point, hit.dir);
    if (!r) return;

    // stats
    if (attackerIdx === 1) {
      this.stats.damageDealt += hit.damage;
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      this.stats.comboTimeout = 1.5;
      if (this.stats.combo >= 2) this.hud.showCombo(`${this.stats.combo} HIT!`);
    }
    if (r.locked) this.stats.jointsLocked++;

    // HUD
    this.hud.setHp(hit.target === this.p1 ? 1 : 2, r.hpRatio);
    if (r.joint) this.hud.setJoint(hit.target === this.p1 ? 1 : 2, r.joint, true);
    this.hud.flashHit(attackerIdx === 1 ? '#ffcc33' : '#ff3344');

    // SFX
    this.audio.hitMetal(Math.min(1.4, hit.damage / 25));
    this.audio.bodyImpact(Math.min(1, hit.damage / 30));
    if (r.locked) this.audio.jointLock();

    // FX
    this.fx.spawnSparks(hit.point, attackerIdx === 1 ? 0xffcc33 : 0x33ffee, Math.min(28, hit.damage));
    this.fx.triggerShake(Math.min(0.35, hit.damage * 0.012), 0.18);
    this.fx.triggerHitStop(Math.min(120, 40 + hit.damage * 2));
    this.fx.vibrate([Math.min(80, 20 + hit.damage * 2)]);

    // KO / lethal hit
    if (!hit.target.alive && !this._ended) {
      this._ended = true;
      this.fx.triggerSlowMo(0.2, 1200);
      this.fx.vibrate([60, 40, 100]);
      this.audio.fanfare();
      const victory = (hit.target === this.p2 && attackerIdx === 1) || (hit.target === this.p1 && attackerIdx === 2 && this.mode === 'online-joiner');
      const t = (performance.now() - this.startTime) / 1000;
      const mm = Math.floor(t/60), ss = Math.floor(t%60);
      setTimeout(() => {
        this.onMatchEnd({
          victory,
          time: `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`,
          damageDealt: Math.round(this.stats.damageDealt),
          maxCombo: this.stats.maxCombo,
          jointsLocked: this.stats.jointsLocked,
        });
      }, 1500);
    }
  }

  _postSimulate(dt, now) {
    // combo timer
    this.stats.comboTimeout -= dt;
    if (this.stats.comboTimeout <= 0) this.stats.combo = 0;

    // sync meshes
    this.p1.sync(); this.p2.sync();

    // ring-out check
    const checkOut = (rag, who) => {
      const p = rag.bodies.pelvis.position;
      const dist = Math.hypot(p.x, p.z);
      const ringRadius = this.settings.arena === 'ringout' ? 7.4 : 9.2;
      if (dist > ringRadius || p.y < -3) {
        if (rag.alive) {
          rag.alive = false;
          rag.hp = 0;
          this.hud.setHp(who, 0);
          // simulate fatal
          this._applyHit(who === 1 ? 2 : 1, {
            target: rag, partName: 'chest', damage: 100,
            point: new THREE.Vector3(p.x, p.y, p.z),
            dir: new THREE.Vector3(0,1,0),
          });
        }
      }
    };
    checkOut(this.p1, 1);
    checkOut(this.p2, 2);
    this._updateHazards(dt);
  }

  _updateHazards(dt) {
    if (!this.hazardBlades?.length || this._ended) return;
    for (const hz of this.hazardBlades) {
      hz.mesh.rotation.y += hz.spin * dt;
      for (const [rag, who] of [[this.p1, 1], [this.p2, 2]]) {
        if (!rag.alive) continue;
        const p = rag.bodies.pelvis.position;
        const d = Math.hypot(p.x - hz.mesh.position.x, p.z - hz.mesh.position.z);
        if (d < 1.35 && p.y < 1.9) {
          this._applyHit(who === 1 ? 2 : 1, {
            target: rag, partName: 'spine', damage: 30,
            point: new THREE.Vector3(p.x, p.y, p.z),
            dir: new THREE.Vector3(0, 1, 0),
          });
        }
      }
    }
  }

  _updateMatchTimer(now) {
    const elapsed = (now - this.startTime) / 1000;
    const remaining = Math.max(0, 90 - elapsed);
    this.hud.setTimer(remaining);
    if (remaining === 0 && !this._ended) {
      this._ended = true;
      const victory = this.p1.hp >= this.p2.hp;
      const t = elapsed;
      const mm = Math.floor(t/60), ss = Math.floor(t%60);
      this.onMatchEnd({
        victory, time: `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`,
        damageDealt: Math.round(this.stats.damageDealt),
        maxCombo: this.stats.maxCombo,
        jointsLocked: this.stats.jointsLocked,
      });
    }
  }

  _updateCamera(dt) {
    // mid-point follow
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    this.p1.centerPosition(a); this.p2.centerPosition(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dist = a.distanceTo(b);
    const target = new THREE.Vector3(mid.x * 0.4, mid.y + 3.5, Math.max(8, dist * 1.6) + 4);
    this.fx._cameraBase.lerp(target, Math.min(1, dt * 2.5));
    // when not shaking, keep camera at base
    if (this.fx.shake.time <= 0) this.camera.position.copy(this.fx._cameraBase);
    this.camera.lookAt(mid.x, 1.0, mid.z);
  }

  _render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// ============================================================
// Swing state: accumulates pointer deltas into an aim vector
// that decays back to neutral.
// ============================================================
class SwingState {
  constructor() {
    this.aim = new THREE.Vector2(0, 0);
    this.swingStrength = 0;
    this.didWhoosh = false;
  }
  accumulate(delta) {
    // delta is in screen px; map to ~unit vector
    const scale = 0.006;
    this.aim.x += delta.x * scale;
    this.aim.y += delta.y * scale;
    // clamp magnitude
    const mag = Math.hypot(this.aim.x, this.aim.y);
    const max = 1.6;
    if (mag > max) { this.aim.multiplyScalar(max / mag); }
    this.swingStrength = Math.max(this.swingStrength, mag);
  }
  decay(dt) {
    // gentle pull-back toward center
    const k = 4.0;
    this.aim.x -= this.aim.x * Math.min(1, k * dt);
    this.aim.y -= this.aim.y * Math.min(1, k * dt);
    this.swingStrength = Math.max(0, this.swingStrength - dt * 3);
  }
}
