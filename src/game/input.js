// ============================================================
// input.js — Unified input layer.
//
// Inputs are flattened into a single `state` object so the
// gameplay layer never needs to care whether the user is on
// keyboard, touch, or a gamepad. Supported control schemes:
//
//   dualstick : left virtual stick (move), right swipe (swing)
//   onehand   : one drag controls both move and swing (mobile)
//   gamepad   : standard XInput layout
//   keyboard  : WASD + mouse drag
//   arrows    : Arrow keys + IJKL (split-screen P2)
//
// All angles use the camera-space convention: +x right, +y up,
// +z forward (into the screen).
// ============================================================

import { clamp } from '../util/math.js';
import { settings } from '../core/settings.js';
import { bus, Channels } from '../util/events.js';
import { logger } from '../util/logger.js';

const log = logger('input');

const KEYS = {
  W: 'KeyW', A: 'KeyA', S: 'KeyS', D: 'KeyD',
  SPACE: 'Space', SHIFT: 'ShiftLeft',
  Q: 'KeyQ', E: 'KeyE',
  UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
  I: 'KeyI', J: 'KeyJ', K: 'KeyK', L: 'KeyL',
  G: 'KeyG', ENTER: 'Enter',
};

export class InputManager {
  constructor(opts = {}) {
    this.canvas = opts.canvas;
    this.scheme = opts.scheme || settings.controls || 'dualstick';
    this.targetPlayer = opts.target || 'p1';   // p1 | p2
    this._enabled = true;

    /** Public state read by the gameplay layer each fixed tick. */
    this.state = {
      moveX: 0, moveZ: 0,
      look:  0,                  // -1 .. 1 — camera pan hint
      jump:  false,
      guard: false,
      dash:  false,
      special: false,
      taunt: false,
      pause: false,
      swing: null,              // { dx, dy, power, angle }
    };

    this.pointerSwing = null;
    this.swipePath = [];
    this.swipeStartTs = 0;
    this.virtualStick = { active: false, dx: 0, dy: 0 };
    this.oneHandActive = false;
    this.oneHandStart = null;

    this._keyState = new Set();
    this._listeners = [];

    this._installKeyboard();
    this._installPointer();
    this._installGamepad();
    this._installVirtualStick();
    this._installOneHand();
    bus.on(Channels.SETTINGS_CHANGE, ({ key, value }) => {
      if (key === 'controls') this.scheme = value;
    });
  }

  enable()  { this._enabled = true; }
  disable() { this._enabled = false; this._reset(); }

  /** Adjust scheme on the fly. */
  setScheme(scheme) { this.scheme = scheme; }

  dispose() {
    for (const off of this._listeners) {
      try { off(); } catch (_err) { /* ignore */ }
    }
    this._listeners = [];
  }

  /** Internal helper to track unbind functions. */
  _bind(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this._listeners.push(() => target.removeEventListener(event, handler, options));
  }

  _reset() {
    this.state.moveX = this.state.moveZ = 0;
    this.state.jump = this.state.guard = this.state.dash = this.state.special = this.state.taunt = false;
    this.pointerSwing = null;
    this.swipePath.length = 0;
    this.virtualStick.active = false;
  }

  // ------------------------------------------------------------
  // Keyboard
  // ------------------------------------------------------------
  _installKeyboard() {
    const down = e => {
      if (!this._enabled) return;
      this._keyState.add(e.code);
      this._handleKeyEdge(e.code, true);
    };
    const up = e => {
      if (!this._enabled) return;
      this._keyState.delete(e.code);
      this._handleKeyEdge(e.code, false);
    };
    this._bind(window, 'keydown', down);
    this._bind(window, 'keyup', up);
  }

  _handleKeyEdge(code, pressed) {
    if (!pressed) {
      if (code === KEYS.SPACE) this.state.jump = false;
      if (code === KEYS.SHIFT) this.state.guard = false;
      return;
    }
    if (code === KEYS.SPACE)      this.state.jump = true;
    else if (code === KEYS.SHIFT) this.state.guard = true;
    else if (code === KEYS.Q)     this.state.dash = true;
    else if (code === KEYS.E)     this.state.special = true;
    else if (code === KEYS.G)     this.state.taunt = true;
    else if (code === 'Escape')   this.state.pause = true;
  }

  // ------------------------------------------------------------
  // Pointer (mouse + touch swing)
  // ------------------------------------------------------------
  _installPointer() {
    const canvas = this.canvas;
    if (!canvas) return;
    const startSwing = ev => {
      if (!this._enabled) return;
      if (this.scheme === 'onehand') return; // one-hand handler manages all
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      // Avoid hijacking the left virtual stick zone on mobile.
      if (ev.pointerType === 'touch' && x < rect.width * 0.4 && y > rect.height * 0.55) return;
      this.pointerSwing = { startX: x, startY: y, lastX: x, lastY: y, startTs: performance.now() };
      this.swipePath.length = 0;
      this.swipePath.push({ x, y, t: performance.now() });
    };
    const moveSwing = ev => {
      if (!this._enabled || !this.pointerSwing) return;
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      this.pointerSwing.lastX = x;
      this.pointerSwing.lastY = y;
      this.swipePath.push({ x, y, t: performance.now() });
      if (this.swipePath.length > 24) this.swipePath.shift();
    };
    const endSwing = () => {
      if (!this._enabled || !this.pointerSwing) return;
      const samples = this.swipePath.slice(-8);
      if (samples.length >= 2) {
        const first = samples[0];
        const last  = samples[samples.length - 1];
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const dt = Math.max(1, last.t - first.t);
        const distance = Math.hypot(dx, dy);
        const speed = distance / dt; // px / ms
        const power = clamp(speed * 0.4, 0, 1.6);
        if (distance > 12) {
          const angle = Math.atan2(dy, dx);
          this.state.swing = { dx, dy, power, angle, distance, speed };
        }
      }
      this.pointerSwing = null;
      this.swipePath.length = 0;
    };

    this._bind(canvas, 'pointerdown', startSwing);
    this._bind(window, 'pointermove', moveSwing);
    this._bind(window, 'pointerup', endSwing);

    // right-click guard
    const guardDown = e => {
      if (e.button === 2) { this.state.guard = true; e.preventDefault(); }
    };
    const guardUp = e => {
      if (e.button === 2) { this.state.guard = false; }
    };
    this._bind(canvas, 'pointerdown', guardDown);
    this._bind(window, 'pointerup', guardUp);
    this._bind(canvas, 'contextmenu', e => e.preventDefault());
  }

  // ------------------------------------------------------------
  // Gamepad — polled each fixed tick
  // ------------------------------------------------------------
  _installGamepad() {
    this._bind(window, 'gamepadconnected', e => log.info('Gamepad connected', e.gamepad.id));
    this._bind(window, 'gamepaddisconnected', () => log.info('Gamepad disconnected'));
  }

  _pollGamepad() {
    if (this.scheme !== 'gamepad' && !this._hasActiveGamepad()) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) return;
    const ax = applyDeadzone(pad.axes[0]);
    const ay = applyDeadzone(pad.axes[1]);
    this.state.moveX = ax;
    this.state.moveZ = ay;
    const rx = applyDeadzone(pad.axes[2]);
    const ry = applyDeadzone(pad.axes[3]);
    if (Math.hypot(rx, ry) > 0.35) {
      const power = clamp(Math.hypot(rx, ry), 0, 1);
      this.state.swing = { dx: rx * 200, dy: ry * 200, power, angle: Math.atan2(ry, rx), distance: 200, speed: 1 };
    }
    if (pad.buttons[0]?.pressed) this.state.jump = true;
    if (pad.buttons[4]?.pressed) this.state.guard = true; else this.state.guard = false;
    if (pad.buttons[2]?.pressed) this.state.dash = true;
    if (pad.buttons[1]?.pressed) this.state.special = true;
    if (pad.buttons[9]?.pressed) this.state.pause = true;
  }

  _hasActiveGamepad() {
    if (!navigator.getGamepads) return false;
    for (const p of navigator.getGamepads()) if (p && p.connected) return true;
    return false;
  }

  // ------------------------------------------------------------
  // Virtual stick (mobile left thumb)
  // ------------------------------------------------------------
  _installVirtualStick() {
    const stick = document.getElementById('virtual-stick');
    if (!stick) return;
    const base = stick.querySelector('.stick-base');
    const knob = stick.querySelector('.stick-knob');
    const radius = 56;
    let activePointer = null;

    const start = e => {
      if (!this._enabled) return;
      if (this.scheme === 'onehand') return;
      activePointer = e.pointerId;
      stick.style.opacity = 1;
      stick.style.pointerEvents = 'auto';
      e.preventDefault();
    };
    const move = e => {
      if (!this._enabled || activePointer !== e.pointerId) return;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        dx = dx / dist * radius;
        dy = dy / dist * radius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.virtualStick.active = true;
      this.virtualStick.dx = dx / radius;
      this.virtualStick.dy = dy / radius;
      e.preventDefault();
    };
    const end = e => {
      if (activePointer !== e.pointerId) return;
      activePointer = null;
      this.virtualStick.active = false;
      this.virtualStick.dx = this.virtualStick.dy = 0;
      knob.style.transform = 'translate(0, 0)';
    };

    this._bind(stick, 'pointerdown', start);
    this._bind(window, 'pointermove', move);
    this._bind(window, 'pointerup', end);
    this._bind(window, 'pointercancel', end);

    const guardBtn = document.getElementById('virtual-guard');
    if (guardBtn) {
      const onDown = () => this.state.guard = true;
      const onUp   = () => this.state.guard = false;
      this._bind(guardBtn, 'pointerdown', onDown);
      this._bind(window, 'pointerup', onUp);
    }
    const jumpBtn = document.getElementById('virtual-jump');
    if (jumpBtn) {
      const tap = () => { this.state.jump = true; setTimeout(() => this.state.jump = false, 120); };
      this._bind(jumpBtn, 'pointerdown', tap);
    }
  }

  // ------------------------------------------------------------
  // One-hand drag scheme (single touch drives both move + swing)
  // ------------------------------------------------------------
  _installOneHand() {
    const canvas = this.canvas;
    if (!canvas) return;
    const down = ev => {
      if (!this._enabled) return;
      if (this.scheme !== 'onehand') return;
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      this.oneHandActive = true;
      this.oneHandStart = { x, y, t: performance.now(), lastX: x, lastY: y };
      this.swipePath.length = 0;
      this.swipePath.push({ x, y, t: performance.now() });
    };
    const move = ev => {
      if (!this._enabled || !this.oneHandActive) return;
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const dx = x - this.oneHandStart.x;
      const dy = y - this.oneHandStart.y;
      const power = clamp(Math.hypot(dx, dy) / 160, 0, 1);
      // Drive move continuously while held.
      const moveScale = 1;
      this.virtualStick.active = true;
      this.virtualStick.dx = clamp(dx / 160, -1, 1) * moveScale;
      this.virtualStick.dy = clamp(dy / 160, -1, 1) * moveScale;
      this.oneHandStart.lastX = x;
      this.oneHandStart.lastY = y;
      this.swipePath.push({ x, y, t: performance.now() });
      if (this.swipePath.length > 24) this.swipePath.shift();
      void power;
    };
    const up = ev => {
      if (!this._enabled || !this.oneHandActive) return;
      // emit a swing pulse if the drag was fast
      const samples = this.swipePath.slice(-8);
      if (samples.length >= 2) {
        const first = samples[0];
        const last  = samples[samples.length - 1];
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const dt = Math.max(1, last.t - first.t);
        const distance = Math.hypot(dx, dy);
        const speed = distance / dt;
        if (distance > 30 && speed > 0.4) {
          const power = clamp(speed * 0.35, 0.25, 1.4);
          const angle = Math.atan2(dy, dx);
          this.state.swing = { dx, dy, power, angle, distance, speed };
        }
      }
      this.oneHandActive = false;
      this.virtualStick.active = false;
      this.virtualStick.dx = 0;
      this.virtualStick.dy = 0;
      this.swipePath.length = 0;
      void ev;
    };

    this._bind(canvas, 'pointerdown', down);
    this._bind(window, 'pointermove', move);
    this._bind(window, 'pointerup', up);
    this._bind(window, 'pointercancel', up);
  }

  // ------------------------------------------------------------
  // Per-frame update — called from the gameplay layer.
  // ------------------------------------------------------------
  update() {
    // 1) read keyboard
    const mx = (this._keyState.has(KEYS.D) || this._keyState.has(KEYS.RIGHT) || this._keyState.has(KEYS.L) ? 1 : 0)
             - (this._keyState.has(KEYS.A) || this._keyState.has(KEYS.LEFT)  || this._keyState.has(KEYS.J) ? 1 : 0);
    const mz = (this._keyState.has(KEYS.S) || this._keyState.has(KEYS.DOWN)  || this._keyState.has(KEYS.K) ? 1 : 0)
             - (this._keyState.has(KEYS.W) || this._keyState.has(KEYS.UP)    || this._keyState.has(KEYS.I) ? 1 : 0);

    let dx = mx, dz = mz;
    // 2) overlay virtual stick (if active)
    if (this.virtualStick.active) {
      dx = this.virtualStick.dx;
      dz = this.virtualStick.dy;
    }

    // 3) gamepad
    this._pollGamepad();

    // 4) normalise
    const mag = Math.hypot(dx, dz);
    if (mag > 1) { dx /= mag; dz /= mag; }
    this.state.moveX = dx;
    this.state.moveZ = dz;

    // 5) collect pending swing -> consume after one read
    // (handled by `consumeSwing`)
    return this.state;
  }

  /** Consume the buffered swing event (returns null if none). */
  consumeSwing() {
    const swing = this.state.swing;
    this.state.swing = null;
    return swing;
  }

  /** Consume the pause edge. */
  consumePause() {
    const p = this.state.pause;
    this.state.pause = false;
    return p;
  }

  /** Consume dash / special / taunt edges. */
  consumeDash()    { const v = this.state.dash;    this.state.dash    = false; return v; }
  consumeSpecial() { const v = this.state.special; this.state.special = false; return v; }
  consumeTaunt()   { const v = this.state.taunt;   this.state.taunt   = false; return v; }
}

function applyDeadzone(v, dz = 0.16) {
  const a = Math.abs(v);
  if (a < dz) return 0;
  const sign = v < 0 ? -1 : 1;
  return sign * (a - dz) / (1 - dz);
}
