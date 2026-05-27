// ============================================================
// Input — unified handler for keyboard / mouse / touch / virtual stick.
// Emits a continuous "swing aim" 2D vector and movement vector.
// ============================================================
import * as THREE from 'three';

export class InputManager {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.sensitivity = opts.sensitivity || 1.0;
    this.oneHand = !!opts.oneHand;

    // movement (-1..1 each axis), x=right z=forward (camera relative)
    this.move = new THREE.Vector2(0, 0);

    // swing aim — direction the player is dragging the sword tip toward
    // in screen-relative units. We accumulate motion velocity each frame.
    this.swingDelta = new THREE.Vector2(0, 0);
    this.swinging = false;

    this.guarding = false;
    this.jumpPressed = false;

    this._keys = new Set();
    this._lastPointer = null;
    this._touchSwingId = null;
    this._touchMoveId = null;

    this._bind();
  }

  _bind() {
    // keyboard
    window.addEventListener('keydown', (e) => {
      this._keys.add(e.code);
      if (e.code === 'Space') this.jumpPressed = true;
    });
    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
    });

    // mouse (PC): drag = swing, right click hold = guard
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.swinging = true;
        this._lastPointer = { x: e.clientX, y: e.clientY };
      } else if (e.button === 2) {
        this.guarding = true;
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (this.swinging && this._lastPointer) {
        const dx = e.clientX - this._lastPointer.x;
        const dy = e.clientY - this._lastPointer.y;
        this.swingDelta.x += dx * this.sensitivity;
        this.swingDelta.y += dy * this.sensitivity;
        this._lastPointer = { x: e.clientX, y: e.clientY };
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.swinging = false; this._lastPointer = null; }
      if (e.button === 2) this.guarding = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // touch: one-hand mode = drag anywhere to swing + move
    if (this.oneHand) {
      this.canvas.addEventListener('touchstart', (e) => {
        if (this._touchSwingId != null) return;
        const t = e.changedTouches[0];
        this._touchSwingId = t.identifier;
        this.swinging = true;
        this._lastPointer = { x: t.clientX, y: t.clientY };
        e.preventDefault();
      }, { passive: false });
      this.canvas.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier !== this._touchSwingId || !this._lastPointer) continue;
          const dx = t.clientX - this._lastPointer.x;
          const dy = t.clientY - this._lastPointer.y;
          this.swingDelta.x += dx * this.sensitivity;
          this.swingDelta.y += dy * this.sensitivity;
          // same drag controls movement (low gain for precision)
          this.move.x = Math.max(-1, Math.min(1, dx / 45));
          this.move.y = Math.max(-1, Math.min(1, dy / 45));
          this._lastPointer = { x: t.clientX, y: t.clientY };
          e.preventDefault();
        }
      }, { passive: false });
      const endAny = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this._touchSwingId) {
            this._touchSwingId = null;
            this.swinging = false;
            this._lastPointer = null;
            this.move.set(0, 0);
          }
        }
      };
      this.canvas.addEventListener('touchend', endAny);
      this.canvas.addEventListener('touchcancel', endAny);
      return;
    }

    // touch: left half = move (virtual joystick), right half = swing
    const stickEl = document.getElementById('virtual-stick');
    const knob = stickEl?.querySelector('.stick-knob');
    if (stickEl) {
      let stickOrigin = null;
      stickEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        this._touchMoveId = t.identifier;
        stickOrigin = { x: t.clientX, y: t.clientY };
      });
      stickEl.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier !== this._touchMoveId || !stickOrigin) continue;
          const dx = t.clientX - stickOrigin.x;
          const dy = t.clientY - stickOrigin.y;
          const lim = 50;
          const mag = Math.hypot(dx, dy);
          const f = mag > lim ? lim / mag : 1;
          knob.style.transform = `translate(calc(-50% + ${dx*f}px), calc(-50% + ${dy*f}px))`;
          this.move.x = (dx * f) / lim;
          this.move.y = (dy * f) / lim;
        }
      });
      const endMove = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this._touchMoveId) {
            this._touchMoveId = null;
            stickOrigin = null;
            this.move.set(0, 0);
            if (knob) knob.style.transform = 'translate(-50%, -50%)';
          }
        }
      };
      stickEl.addEventListener('touchend', endMove);
      stickEl.addEventListener('touchcancel', endMove);
    }

    // swing touch — right half of the screen
    this.canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth / 2 && this._touchSwingId == null) {
          this._touchSwingId = t.identifier;
          this.swinging = true;
          this._lastPointer = { x: t.clientX, y: t.clientY };
          e.preventDefault();
        }
      }
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this._touchSwingId || !this._lastPointer) continue;
        const dx = t.clientX - this._lastPointer.x;
        const dy = t.clientY - this._lastPointer.y;
        this.swingDelta.x += dx * this.sensitivity;
        this.swingDelta.y += dy * this.sensitivity;
        this._lastPointer = { x: t.clientX, y: t.clientY };
        e.preventDefault();
      }
    }, { passive: false });
    const endSwing = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._touchSwingId) {
          this._touchSwingId = null;
          this.swinging = false;
          this._lastPointer = null;
        }
      }
    };
    this.canvas.addEventListener('touchend', endSwing);
    this.canvas.addEventListener('touchcancel', endSwing);

    // virtual guard & jump buttons
    const guardBtn = document.getElementById('virtual-guard');
    if (guardBtn) {
      const press = () => { this.guarding = true; };
      const rel = () => { this.guarding = false; };
      guardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); press(); });
      guardBtn.addEventListener('touchend', (e) => { e.preventDefault(); rel(); });
      guardBtn.addEventListener('mousedown', press);
      guardBtn.addEventListener('mouseup', rel);
      guardBtn.addEventListener('mouseleave', rel);
    }
    const jumpBtn = document.getElementById('virtual-jump');
    if (jumpBtn) {
      const jump = (e) => { e.preventDefault(); this.jumpPressed = true; };
      jumpBtn.addEventListener('touchstart', jump);
      jumpBtn.addEventListener('mousedown', jump);
    }
  }

  /** Call once per frame at start of update. */
  pollKeyboard() {
    // WASD / Arrow movement
    let mx = 0, my = 0;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft'))  mx -= 1;
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) mx += 1;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp'))    my -= 1;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown'))  my += 1;
    // only override if non-zero (let virtual stick stay otherwise)
    if (mx !== 0 || my !== 0) this.move.set(mx, my);
    else if (this._touchMoveId == null) this.move.set(0, 0);
  }

  /** Consume and return accumulated swing delta this frame. */
  consumeSwing() {
    const v = this.swingDelta.clone();
    this.swingDelta.set(0, 0);
    return v;
  }

  consumeJump() {
    const j = this.jumpPressed;
    this.jumpPressed = false;
    return j;
  }
}
