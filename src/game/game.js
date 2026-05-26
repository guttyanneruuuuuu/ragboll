// ============================================================
// Game — main class (skeleton). Phase 0 = bootable shell.
// Full 3D ragdoll + sword combat is added in subsequent commits.
// ============================================================
import * as THREE from 'three';

export class Game {
  constructor(opts) {
    this.canvas = opts.canvas;
    this.settings = opts.settings;
    this.hud = opts.hud;
    this.net = opts.net || null;
    this.mode = opts.mode;
    this.onLoadProgress = opts.onLoadProgress || (() => {});
    this.onMatchEnd = opts.onMatchEnd || (() => {});
    this.running = false;
    this.paused = false;
  }

  async init() {
    this.onLoadProgress(20, 'WebGL 初期化中...');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.settings.quality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.settings.quality === 'high' ? Math.min(devicePixelRatio, 2) : 1);
    this.resizeRenderer();
    window.addEventListener('resize', () => this.resizeRenderer());

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);
    this.scene.fog = new THREE.Fog(0x0a0a0f, 15, 50);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 1, 0);

    // basic lighting
    this.scene.add(new THREE.AmbientLight(0x4444aa, 0.4));
    const key = new THREE.DirectionalLight(0xffeecc, 1.0);
    key.position.set(8, 12, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xff5577, 0.4);
    fill.position.set(-8, 4, -4);
    this.scene.add(fill);

    this.onLoadProgress(50, 'ステージ生成中...');
    this._buildArena();

    this.onLoadProgress(80, 'コントロール準備中...');
    // HUD names
    this.hud.setNames(
      this.mode === 'solo' ? 'YOU' : 'P1',
      this.mode === 'solo' ? 'ENEMY' : 'P2'
    );
    this.hud.setHp(1, 1); this.hud.setHp(2, 1);
    this.hud.setRound(1);

    this.onLoadProgress(100, '準備完了');
  }

  _buildArena() {
    // Floor
    const floorGeo = new THREE.CylinderGeometry(12, 12, 0.6, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1028, metalness: 0.3, roughness: 0.7,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.3;
    this.scene.add(floor);

    // Neon ring on the floor
    const ringGeo = new THREE.TorusGeometry(11.5, 0.08, 8, 96);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    this.scene.add(ring);
    this._ring = ring;

    // Placeholder players: two upright boxes for now (replaced by ragdolls in next commit)
    const mkPlayer = (color, x) => {
      const g = new THREE.BoxGeometry(0.8, 1.8, 0.5);
      const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, 1, 0);
      this.scene.add(mesh);
      return mesh;
    };
    this.p1Mesh = mkPlayer(0xff3344, -3);
    this.p2Mesh = mkPlayer(0x33ccff,  3);
  }

  resizeRenderer() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }

  start() {
    this.running = true;
    this.startTime = performance.now();
    this.lastTick = this.startTime;
    this._loop();
  }

  pause()  { this.paused = true; }
  resume() { if (this.running) { this.paused = false; this.lastTick = performance.now(); } }
  restart() {
    // For now: simply re-init the scene & HUD.
    this.dispose();
    this.init().then(() => this.start());
  }
  dispose() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    this.scene?.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    this.renderer?.dispose();
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (!this.paused) this._update(dt, now);
    this._render();
  }

  _update(dt, now) {
    // gentle idle: spin neon ring for life
    if (this._ring) this._ring.rotation.z += dt * 0.5;
    // HUD timer: 90s round
    const elapsed = (now - this.startTime) / 1000;
    const remaining = Math.max(0, 90 - elapsed);
    this.hud.setTimer(remaining);
    if (remaining === 0 && !this._ended) {
      this._ended = true;
      this._endMatch({ victory: true, time: '01:30', damageDealt: 0, maxCombo: 0, jointsLocked: 0 });
    }
  }

  _render() {
    this.renderer.render(this.scene, this.camera);
  }

  _endMatch(result) {
    this.running = false;
    this.onMatchEnd(result);
  }
}
