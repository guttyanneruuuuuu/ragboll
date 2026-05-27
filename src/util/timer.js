// ============================================================
// timer.js — Frame ticker, fixed-step accumulator and small
// helpers (debounce, throttle, defer) used throughout RAGBLADE.
// ============================================================

/**
 * The main fixed-step ticker used by the gameplay loop. It keeps
 * the physics update rate independent from the render rate, while
 * still draining lag in a deterministic order.
 */
export class FixedTicker {
  constructor({ rate = 60, maxStepsPerFrame = 5 } = {}) {
    this.rate = rate;
    this.fixedDt = 1 / rate;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.accumulator = 0;
    this.totalElapsed = 0;
    this.simulatedSteps = 0;
    this.lastWall = 0;
    this.runningSlow = false;
    this.callbacks = new Set();
  }

  add(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  step(realDt) {
    this.accumulator += realDt;
    const max = this.maxStepsPerFrame * this.fixedDt;
    if (this.accumulator > max) {
      this.runningSlow = true;
      this.accumulator = max;
    } else {
      this.runningSlow = false;
    }
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxStepsPerFrame) {
      this.totalElapsed += this.fixedDt;
      this.simulatedSteps++;
      for (const cb of this.callbacks) {
        try { cb(this.fixedDt, this.totalElapsed, this.simulatedSteps); }
        catch (err) { console.error('[FixedTicker]', err); }
      }
      this.accumulator -= this.fixedDt;
      steps++;
    }
    return steps;
  }

  reset() {
    this.accumulator = 0;
    this.totalElapsed = 0;
    this.simulatedSteps = 0;
    this.runningSlow = false;
  }
}

/** Convenience high-resolution timestamp in milliseconds. */
export function now() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/** Sleep using the timer / animation frame fallback. */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Wait for the next animation frame. */
export function nextFrame() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 16);
  });
}

/** Run `fn` at most once per `delay` ms. */
export function throttle(fn, delay) {
  let last = 0;
  let timeout = null;
  let lastArgs = null;
  return function throttled(...args) {
    const t = now();
    const remaining = delay - (t - last);
    lastArgs = args;
    if (remaining <= 0) {
      last = t;
      if (timeout) { clearTimeout(timeout); timeout = null; }
      fn.apply(this, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        last = now();
        timeout = null;
        fn.apply(this, lastArgs);
      }, remaining);
    }
  };
}

/** Delay execution until `fn` has not been called for `delay` ms. */
export function debounce(fn, delay) {
  let timeout = null;
  return function debounced(...args) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Schedule a callback for the *next* microtask. Useful when we
 * need to defer state mutations triggered by an event handler so
 * the current emit chain finishes first.
 */
export function defer(fn) {
  if (typeof queueMicrotask === 'function') queueMicrotask(fn);
  else Promise.resolve().then(fn);
}

/**
 * Tiny FPS / step-time counter used by the debug overlay.
 */
export class PerfMeter {
  constructor(window = 60) {
    this.window = window;
    this.samples = [];
    this.lastTime = now();
    this.fps = 0;
    this.frameTime = 0;
    this._totalFrames = 0;
  }
  tick() {
    const t = now();
    const dt = t - this.lastTime;
    this.lastTime = t;
    this.samples.push(dt);
    if (this.samples.length > this.window) this.samples.shift();
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.fps = avg > 0 ? 1000 / avg : 0;
    this.frameTime = avg;
    this._totalFrames++;
    return { fps: this.fps, ms: this.frameTime };
  }
  reset() {
    this.samples.length = 0;
    this.lastTime = now();
    this._totalFrames = 0;
    this.fps = 0;
    this.frameTime = 0;
  }
}

/** Convert performance.now milliseconds into seconds. */
export function msToSec(ms) { return ms * 0.001; }

/** Convert seconds back to milliseconds. */
export function secToMs(s) { return s * 1000; }
