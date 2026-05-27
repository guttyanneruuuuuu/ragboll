// ============================================================
// spatial.js — Lightweight broad-phase helpers used by particle
// systems and AI navigation. Three.js and cannon-es already do
// the heavy lifting for physics; this module fills the gaps for
// non-physical queries (range, line of sight estimates, …).
// ============================================================

/**
 * Uniform-grid hash for `{ position }` items. Suitable for swarm
 * AI and decal pooling in arenas up to ~64×64 metres.
 */
export class GridIndex {
  constructor(cellSize = 4) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  _key(x, z) {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx}|${cz}`;
  }

  clear() { this.cells.clear(); }

  insert(item) {
    if (!item || !item.position) return;
    const key = this._key(item.position.x, item.position.z);
    let bucket = this.cells.get(key);
    if (!bucket) { bucket = []; this.cells.set(key, bucket); }
    bucket.push(item);
  }

  /** Yield candidate items inside a radius (broad-phase only). */
  *query(x, z, radius) {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minZ = Math.floor((z - radius) / this.cellSize);
    const maxZ = Math.floor((z + radius) / this.cellSize);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const bucket = this.cells.get(`${cx}|${cz}`);
        if (!bucket) continue;
        for (const item of bucket) yield item;
      }
    }
  }
}

/** Convert grid-space to world. */
export function gridToWorld(cell, cellSize) {
  return { x: cell.cx * cellSize, y: 0, z: cell.cz * cellSize };
}

/** Approximate 2D segment intersection — used for sword arcs. */
export function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const r1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const r2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const r3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const r4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  if (((r1 > 0 && r2 < 0) || (r1 < 0 && r2 > 0)) &&
      ((r3 > 0 && r4 < 0) || (r3 < 0 && r4 > 0))) {
    const denom = (r1 - r2);
    if (denom === 0) return null;
    const t = r1 / denom;
    return { x: ax + t * (bx - ax), y: ay + t * (by - ay) };
  }
  return null;
}

/** Squared distance from point P to segment AB (XZ plane). */
export function distToSegmentSq2D(px, pz, ax, az, bx, bz) {
  const ax2 = bx - ax;
  const az2 = bz - az;
  const lenSq = ax2 * ax2 + az2 * az2;
  let t = 0;
  if (lenSq > 1e-6) {
    t = ((px - ax) * ax2 + (pz - az) * az2) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const cx = ax + ax2 * t;
  const cz = az + az2 * t;
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
}

/** Map a circle vs AABB intersection (XZ plane). */
export function circleHitsBox(cx, cz, r, minX, minZ, maxX, maxZ) {
  let dx = 0, dz = 0;
  if (cx < minX) dx = cx - minX;
  else if (cx > maxX) dx = cx - maxX;
  if (cz < minZ) dz = cz - minZ;
  else if (cz > maxZ) dz = cz - maxZ;
  return (dx * dx + dz * dz) <= r * r;
}

/** Spatial pool used to reuse particle data objects. */
export class ObjectPool {
  constructor(factory, reset = () => {}, initialSize = 0) {
    this.factory = factory;
    this.reset = reset;
    this.pool = [];
    for (let i = 0; i < initialSize; i++) this.pool.push(factory());
  }

  acquire() {
    return this.pool.length ? this.pool.pop() : this.factory();
  }

  release(obj) {
    if (!obj) return;
    try { this.reset(obj); } catch (_err) { /* ignore */ }
    this.pool.push(obj);
  }

  drain(fn) {
    while (this.pool.length) fn(this.pool.pop());
  }

  size() { return this.pool.length; }
}
