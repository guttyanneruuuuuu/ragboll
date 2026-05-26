// ============================================================
// Effects — sparks, screen shake, hit-stop, slow-mo, vibrate.
// ============================================================
import * as THREE from 'three';

export class Effects {
  constructor(scene, camera, settings) {
    this.scene = scene;
    this.camera = camera;
    this.settings = settings;
    this.shake = { time: 0, mag: 0 };
    this.timeScale = 1.0;
    this._hitStopUntil = 0;
    this._sparks = [];
    this._sparkPool = [];
    this._cameraBase = new THREE.Vector3();
  }

  recordCameraBase() {
    this._cameraBase.copy(this.camera.position);
  }

  // ----- Screen shake -----
  triggerShake(magnitude = 0.2, duration = 0.25) {
    this.shake.mag = Math.max(this.shake.mag, magnitude);
    this.shake.time = Math.max(this.shake.time, duration);
  }

  // ----- Hit stop (freeze frame for impact) -----
  triggerHitStop(durationMs = 80) {
    this._hitStopUntil = performance.now() + durationMs;
  }
  isHitStopped() { return performance.now() < this._hitStopUntil; }

  // ----- Slow motion -----
  triggerSlowMo(scale = 0.3, durationMs = 600) {
    this.timeScale = scale;
    clearTimeout(this._slowMoT);
    this._slowMoT = setTimeout(() => { this.timeScale = 1.0; }, durationMs);
  }

  // ----- Vibration (mobile) -----
  vibrate(pattern) {
    if (!this.settings.vibrate) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ----- Sparks (additive billboard particles) -----
  spawnSparks(position, color = 0xffcc33, count = 14) {
    for (let i = 0; i < count; i++) {
      const s = this._sparkPool.pop() || this._newSpark();
      s.mesh.position.copy(position);
      s.mesh.material.color.setHex(color);
      // random outward velocity
      s.velocity.set(
        (Math.random() - 0.5) * 6,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 6
      );
      s.life = 0.35 + Math.random() * 0.25;
      s.maxLife = s.life;
      s.mesh.visible = true;
      this._sparks.push(s);
    }
  }
  _newSpark() {
    const g = new THREE.SphereGeometry(0.04, 6, 4);
    const m = new THREE.MeshBasicMaterial({
      color: 0xffcc33,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(g, m);
    this.scene.add(mesh);
    return { mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 0 };
  }

  // ----- Per-frame update -----
  update(dt) {
    // screen shake
    if (this.shake.time > 0) {
      this.shake.time -= dt;
      const m = this.shake.mag;
      this.camera.position.x = this._cameraBase.x + (Math.random()-0.5) * m;
      this.camera.position.y = this._cameraBase.y + (Math.random()-0.5) * m * 0.8;
      this.camera.position.z = this._cameraBase.z + (Math.random()-0.5) * m;
      if (this.shake.time <= 0) {
        this.shake.mag = 0;
        this.camera.position.copy(this._cameraBase);
      }
    }

    // sparks
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const s = this._sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        this._sparks.splice(i, 1);
        this._sparkPool.push(s);
        continue;
      }
      s.velocity.y -= 12 * dt; // gravity
      s.mesh.position.addScaledVector(s.velocity, dt);
      s.mesh.material.opacity = s.life / s.maxLife;
      const sc = 0.6 + (s.life / s.maxLife) * 0.7;
      s.mesh.scale.set(sc, sc, sc);
    }
  }
}
