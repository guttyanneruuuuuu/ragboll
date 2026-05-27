// ============================================================
// math.js — Vector / scalar utility helpers used across the
// gameplay, physics, AI and UI layers of RAGBLADE ARENA.
//
// Everything here is intentionally framework agnostic so the
// modules can be re-used in worker threads (e.g. the replay
// processor) where Three.js / cannon-es are not available.
//
// All numeric helpers operate on plain `{ x, y, z }` literals.
// ============================================================

/** Tiny epsilon comparable to a thousandth of a millimeter. */
export const EPS = 1e-6;

/** Tau is just two PI — included to keep the call-sites readable. */
export const TAU = Math.PI * 2;

/** Clamp `value` between `lo` and `hi` (inclusive). */
export function clamp(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/** Wrap an angle (radians) into the range `[-PI, +PI]`. */
export function wrapAngle(angle) {
  let a = angle;
  while (a >  Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/** Linear interpolation between two scalars. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smooth-step interpolation, ease in/out flavour. */
export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0 || EPS), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Inverse linear interpolation — return the `t` for `value`. */
export function inverseLerp(a, b, value) {
  if (Math.abs(b - a) < EPS) return 0;
  return clamp((value - a) / (b - a), 0, 1);
}

/** Round `value` to the closest multiple of `step`. */
export function snap(value, step) {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Damp a scalar towards `target` using an exponential decay over
 * `dt` seconds with the half-life equal to `halfLife`.
 *
 * Handy for camera / HUD interpolation because it is framerate
 * independent.
 */
export function damp(value, target, halfLife, dt) {
  if (halfLife <= 0) return target;
  const k = Math.pow(0.5, dt / halfLife);
  return target + (value - target) * k;
}

/** Convert degrees to radians. */
export function deg2rad(deg) { return deg * Math.PI / 180; }

/** Convert radians to degrees. */
export function rad2deg(rad) { return rad * 180 / Math.PI; }

/** Tiny deterministic PRNG (mulberry32) — useful for replays. */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function rand() {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Pick a random element from an array using the supplied RNG. */
export function pick(rng, arr) {
  if (!arr || !arr.length) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

/** Shuffle an array in-place using the Fisher–Yates algorithm. */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Create a new `{x,y,z}` vector literal. */
export function v3(x = 0, y = 0, z = 0) { return { x, y, z }; }

/** Add two `v3` literals into `out` (or a new object) and return it. */
export function v3add(a, b, out = {}) {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  out.z = a.z + b.z;
  return out;
}

/** Subtract `b` from `a` into `out`. */
export function v3sub(a, b, out = {}) {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  out.z = a.z - b.z;
  return out;
}

/** Scale a `v3` literal by `s` into `out`. */
export function v3scale(a, s, out = {}) {
  out.x = a.x * s;
  out.y = a.y * s;
  out.z = a.z * s;
  return out;
}

/** Length / magnitude of a `v3` literal. */
export function v3len(a) {
  return Math.hypot(a.x, a.y, a.z);
}

/** Squared length of a `v3` literal — avoids the sqrt. */
export function v3lenSq(a) {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}

/** Distance between two `v3` literals. */
export function v3dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Normalise a `v3` literal in place (or into `out`). */
export function v3normalize(a, out = {}) {
  const l = v3len(a);
  if (l < EPS) {
    out.x = 0; out.y = 0; out.z = 0;
    return out;
  }
  out.x = a.x / l;
  out.y = a.y / l;
  out.z = a.z / l;
  return out;
}

/** Dot product of two `v3` literals. */
export function v3dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Cross product of two `v3` literals into `out`. */
export function v3cross(a, b, out = {}) {
  out.x = a.y * b.z - a.z * b.y;
  out.y = a.z * b.x - a.x * b.z;
  out.z = a.x * b.y - a.y * b.x;
  return out;
}

/** Linear interpolation between two `v3` literals. */
export function v3lerp(a, b, t, out = {}) {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}

/** Random point inside a unit sphere — uses rejection sampling. */
export function randomInUnitSphere(rng) {
  while (true) {
    const x = rng() * 2 - 1;
    const y = rng() * 2 - 1;
    const z = rng() * 2 - 1;
    if (x * x + y * y + z * z <= 1) return { x, y, z };
  }
}

/** Random unit vector pointing in any direction. */
export function randomDirection(rng) {
  const z = rng() * 2 - 1;
  const a = rng() * TAU;
  const r = Math.sqrt(1 - z * z);
  return { x: Math.cos(a) * r, y: z, z: Math.sin(a) * r };
}

/** Random point inside a 2D disc on the XZ plane. */
export function randomInDisc(rng, radius) {
  const r = Math.sqrt(rng()) * radius;
  const a = rng() * TAU;
  return { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r };
}

/**
 * Build a quaternion from euler XYZ angles. Returns a plain
 * `{x,y,z,w}` literal so it can be used both in Three.js (after
 * `quat.set(...)`) and in cannon-es directly.
 */
export function eulerToQuat(x, y, z) {
  const cx = Math.cos(x * 0.5);
  const sx = Math.sin(x * 0.5);
  const cy = Math.cos(y * 0.5);
  const sy = Math.sin(y * 0.5);
  const cz = Math.cos(z * 0.5);
  const sz = Math.sin(z * 0.5);
  return {
    x: sx * cy * cz - cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz + sx * sy * sz,
  };
}

/**
 * Hermite-cubic interpolation through points p0..p3 — useful for
 * sword swing trajectories where the input swipe should curve
 * smoothly between captured samples.
 */
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/** Sample a catmull-rom spline as a `v3`. */
export function catmullRomV3(p0, p1, p2, p3, t) {
  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
    y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
    z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
  };
}

/** Approximate the signed angle (radians) between two 2D vectors. */
export function signedAngle2D(ax, ay, bx, by) {
  const dot = ax * bx + ay * by;
  const det = ax * by - ay * bx;
  return Math.atan2(det, dot);
}

/** Compute a slightly randomised hit response intensity. */
export function hitForce(speed, weight, rng) {
  const base = clamp(speed, 0, 32) / 32;
  const w = clamp(weight, 0.2, 2.5);
  const jitter = 0.85 + rng() * 0.3;
  return base * (0.7 + w * 0.4) * jitter;
}

/** Approximate world-to-screen projection for a quick UI marker. */
export function projectPoint(camera, point, viewport) {
  const v = { x: point.x, y: point.y, z: point.z };
  // Three.js exposes `project()`, but here we expect a plain helper.
  if (camera && typeof camera.project === 'function') {
    const p = camera.project(v);
    return {
      x: ( p.x * 0.5 + 0.5) * viewport.width,
      y: (-p.y * 0.5 + 0.5) * viewport.height,
      visible: p.z > -1 && p.z < 1,
    };
  }
  return { x: viewport.width * 0.5, y: viewport.height * 0.5, visible: true };
}

/** Color HSL → 0xRRGGBB helper used by the dynamic palette. */
export function hsl2hex(h, s, l) {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);
  return (r << 16) | (g << 8) | b;
}

/** Pleasing default palette used by skin / weapon trail generators. */
export const DEFAULT_PALETTE = [
  0xff4455, 0xff8833, 0xffd23a, 0x8fdc4f, 0x33d6c2,
  0x33aaff, 0x6a5cff, 0xc063ff, 0xff5fc8, 0xffeeee,
];

/** Pseudo deterministic colour based on a string id (player name). */
export function colorForId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return DEFAULT_PALETTE[Math.abs(h) % DEFAULT_PALETTE.length];
}

/** Convert an integer 0xRRGGBB to a CSS `rgb()` string. */
export function hex2css(hex) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >>  8) & 0xff;
  const b =  hex        & 0xff;
  return `rgb(${r}, ${g}, ${b})`;
}

/** Approximate Hermite-style ease curve, identical signature to
 *  Three's `MathUtils.smoothstep`. */
export function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** ease-out cubic — handy for HUD bars settling. */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/** ease-in cubic — used for charging weapon swings. */
export function easeInCubic(t) {
  return t * t * t;
}

/** Compute a moving exponential average. */
export function ema(prev, sample, alpha) {
  return prev + alpha * (sample - prev);
}

/** Wrap an integer index inside `[0, length)` with negative support. */
export function wrapIndex(i, length) {
  return ((i % length) + length) % length;
}

/** Compute a deterministic colour-friendly hue from a hash. */
export function hueFromString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x9E3779B1);
  }
  return ((h >>> 0) % 360) / 360;
}

/** Compute the centroid of an array of `v3` literals. */
export function centroid(points) {
  if (!points.length) return { x: 0, y: 0, z: 0 };
  let x = 0, y = 0, z = 0;
  for (const p of points) { x += p.x; y += p.y; z += p.z; }
  const n = 1 / points.length;
  return { x: x * n, y: y * n, z: z * n };
}

/** Compute an axis-aligned bounding box for a list of `v3`s. */
export function aabb(points) {
  const out = {
    min: { x: +Infinity, y: +Infinity, z: +Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };
  for (const p of points) {
    if (p.x < out.min.x) out.min.x = p.x;
    if (p.y < out.min.y) out.min.y = p.y;
    if (p.z < out.min.z) out.min.z = p.z;
    if (p.x > out.max.x) out.max.x = p.x;
    if (p.y > out.max.y) out.max.y = p.y;
    if (p.z > out.max.z) out.max.z = p.z;
  }
  return out;
}

/** Approximate the angle between two `v3` literals in radians. */
export function v3angle(a, b) {
  const dot = v3dot(a, b);
  const denom = v3len(a) * v3len(b);
  if (denom < EPS) return 0;
  return Math.acos(clamp(dot / denom, -1, 1));
}

/** Tween an object by mutating numeric props towards `target`. */
export function tweenObject(obj, target, halfLife, dt) {
  for (const key of Object.keys(target)) {
    if (typeof target[key] === 'number') {
      obj[key] = damp(obj[key] ?? 0, target[key], halfLife, dt);
    }
  }
}

/** Convert milliseconds to a clock string `M:SS.t`. */
export function msToClock(ms) {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const tenth   = Math.floor((total % 1000) / 100);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenth}`;
}

/** Convert seconds to compact `MM:SS` (no fractional part). */
export function secondsToClock(seconds) {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
