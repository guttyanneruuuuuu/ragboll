// ============================================================
// Audio — procedural SFX & BGM via Web Audio API.
// 0 bytes of asset payload — generated entirely from oscillators
// so we stay tiny + offline-safe.
// ============================================================
export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.bgmBus = null;
    this.bgmNodes = [];
    this.bgmPlaying = false;
  }

  _ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 1.0;
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.settings.sfx;
      this.bgmBus = this.ctx.createGain(); this.bgmBus.gain.value = this.settings.bgm;
      this.sfxBus.connect(this.master);
      this.bgmBus.connect(this.master);
      this.master.connect(this.ctx.destination);

      // resume on user gesture
      const resume = () => { this.ctx.resume(); };
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
    } catch (e) { console.warn('Audio init failed', e); }
  }

  applyVolume() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.settings.sfx;
    this.bgmBus.gain.value = this.settings.bgm;
  }

  // ----- SFX -----

  /** Metallic clang on blade hit. */
  hitMetal(intensity = 1) {
    this._ensure(); if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    // mix: bright "ting" + body "thunk"
    const ting = this.ctx.createOscillator();
    ting.type = 'square';
    ting.frequency.setValueAtTime(1800 + Math.random()*400, t0);
    ting.frequency.exponentialRampToValueAtTime(900, t0 + 0.12);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t0);
    tg.gain.exponentialRampToValueAtTime(0.6 * intensity, t0 + 0.005);
    tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    ting.connect(tg).connect(this.sfxBus);
    ting.start(t0); ting.stop(t0 + 0.3);

    const thunk = this.ctx.createOscillator();
    thunk.type = 'triangle';
    thunk.frequency.setValueAtTime(180, t0);
    thunk.frequency.exponentialRampToValueAtTime(60, t0 + 0.1);
    const thg = this.ctx.createGain();
    thg.gain.setValueAtTime(0.001, t0);
    thg.gain.exponentialRampToValueAtTime(0.5 * intensity, t0 + 0.005);
    thg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    thunk.connect(thg).connect(this.sfxBus);
    thunk.start(t0); thunk.stop(t0 + 0.2);
  }

  /** Whoosh — swing through air. */
  whoosh(intensity = 1) {
    this._ensure(); if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const bufSize = this.ctx.sampleRate * 0.25;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 1200; bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.25 * intensity, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t0); src.stop(t0 + 0.3);
  }

  /** Impact thud on body blow. */
  bodyImpact(intensity = 1) {
    this._ensure(); if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(40, t0 + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.exponentialRampToValueAtTime(0.8 * intensity, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    o.connect(g).connect(this.sfxBus);
    o.start(t0); o.stop(t0 + 0.25);
  }

  /** Bone-snap / joint lock chime. */
  jointLock() {
    this._ensure(); if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(440, t0);
    o.frequency.exponentialRampToValueAtTime(220, t0 + 0.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
    o.connect(g).connect(this.sfxBus);
    o.start(t0); o.stop(t0 + 0.3);
  }

  /** Victory fanfare. */
  fanfare() {
    this._ensure(); if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
    const t0 = this.ctx.currentTime;
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + i*0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i*0.12 + 0.4);
      o.connect(g).connect(this.sfxBus);
      o.start(t0 + i * 0.12); o.stop(t0 + i*0.12 + 0.5);
    });
  }

  // ----- BGM (loopable shoegaze drum pulse) -----
  startBgm() {
    this._ensure(); if (!this.ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;
    const ctx = this.ctx;
    const bpm = 110;
    const beat = 60 / bpm;
    const bar = beat * 4;

    // Pad chord (lush)
    const pad = ctx.createOscillator(); pad.type = 'sawtooth';
    pad.frequency.value = 110; // A2
    const padFilt = ctx.createBiquadFilter(); padFilt.type = 'lowpass';
    padFilt.frequency.value = 400; padFilt.Q.value = 4;
    const padGain = ctx.createGain(); padGain.gain.value = 0.18;
    pad.connect(padFilt).connect(padGain).connect(this.bgmBus);
    pad.start();
    // slow LFO on filter for movement
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1;
    const lfoG = ctx.createGain(); lfoG.gain.value = 200;
    lfo.connect(lfoG).connect(padFilt.frequency);
    lfo.start();
    this.bgmNodes.push(pad, lfo);

    // Kick on beat
    this._bgmTimer = setInterval(() => {
      const t = ctx.currentTime;
      // kick
      const k = ctx.createOscillator(); k.type = 'sine';
      k.frequency.setValueAtTime(120, t);
      k.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const kg = ctx.createGain();
      kg.gain.setValueAtTime(0.0001, t);
      kg.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
      kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      k.connect(kg).connect(this.bgmBus);
      k.start(t); k.stop(t + 0.2);
    }, beat * 1000);
  }

  stopBgm() {
    if (!this.bgmPlaying) return;
    this.bgmPlaying = false;
    clearInterval(this._bgmTimer);
    this.bgmNodes.forEach((n) => { try { n.stop(); } catch (_) {} });
    this.bgmNodes = [];
  }
}
