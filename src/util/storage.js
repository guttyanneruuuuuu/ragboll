// ============================================================
// storage.js — Robust wrapper around localStorage that survives
// missing storage (Safari private mode), corrupted entries and
// schema migrations.
// ============================================================

const ROOT_PREFIX = 'ragblade::';
const VERSION_KEY = ROOT_PREFIX + '_v';
const CURRENT_VERSION = 3;

/** In-memory fallback when window.localStorage is unavailable. */
const memoryFallback = new Map();

/** Detect whether the runtime exposes a usable localStorage. */
function storageAvailable() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const probe = '__ragblade_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch (_err) {
    return false;
  }
}

const HAS_STORAGE = storageAvailable();

function rawGet(key) {
  if (HAS_STORAGE) {
    try { return localStorage.getItem(key); }
    catch (_err) { return null; }
  }
  return memoryFallback.has(key) ? memoryFallback.get(key) : null;
}

function rawSet(key, value) {
  if (HAS_STORAGE) {
    try { localStorage.setItem(key, value); return true; }
    catch (_err) { /* quota or denied */ }
  }
  memoryFallback.set(key, value);
  return false;
}

function rawRemove(key) {
  if (HAS_STORAGE) {
    try { localStorage.removeItem(key); }
    catch (_err) { /* ignore */ }
  }
  memoryFallback.delete(key);
}

/** Persist (key, value) as JSON with an internal prefix. */
export function saveJSON(key, value) {
  const full = ROOT_PREFIX + key;
  try {
    rawSet(full, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('[storage] save failed', err);
    return false;
  }
}

/** Read JSON, returning `fallback` when missing or invalid. */
export function loadJSON(key, fallback = null) {
  const full = ROOT_PREFIX + key;
  const raw = rawGet(full);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); }
  catch (_err) { return fallback; }
}

/** Remove a single key. */
export function removeKey(key) {
  rawRemove(ROOT_PREFIX + key);
}

/** Iterate every namespaced key. */
export function keys() {
  const result = [];
  if (HAS_STORAGE) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(ROOT_PREFIX) && key !== VERSION_KEY) {
          result.push(key.slice(ROOT_PREFIX.length));
        }
      }
    } catch (_err) { /* ignore */ }
  } else {
    for (const key of memoryFallback.keys()) {
      if (key.startsWith(ROOT_PREFIX) && key !== VERSION_KEY) {
        result.push(key.slice(ROOT_PREFIX.length));
      }
    }
  }
  return result;
}

/**
 * Apply pending schema migrations. The function is idempotent —
 * it stamps `CURRENT_VERSION` once everything has been processed.
 */
export function migrate() {
  const stored = parseInt(rawGet(VERSION_KEY) || '0', 10) || 0;
  if (stored >= CURRENT_VERSION) return;
  if (stored < 1) {
    // v0 → v1 : namespace rename `rb::` → `ragblade::`
    if (HAS_STORAGE) {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('rb::')) {
            const value = localStorage.getItem(key);
            localStorage.removeItem(key);
            if (value) localStorage.setItem(ROOT_PREFIX + key.slice(4), value);
          }
        }
      } catch (_err) { /* ignore */ }
    }
  }
  if (stored < 2) {
    // v1 → v2 : flatten settings
    const s = loadJSON('settings', null);
    if (s && typeof s === 'object' && s.audio && typeof s.audio === 'object') {
      const flat = {
        ...s,
        sfxVolume: s.audio.sfx ?? 0.8,
        bgmVolume: s.audio.bgm ?? 0.5,
      };
      delete flat.audio;
      saveJSON('settings', flat);
    }
  }
  if (stored < 3) {
    // v2 → v3 : add cosmetics / profile placeholders if absent
    if (!loadJSON('profile')) {
      saveJSON('profile', {
        playerName: 'RAGDOLLER',
        avatarHue:   210,
        elo:         1000,
        wins:        0,
        losses:      0,
        draws:       0,
        playtimeSec: 0,
        achievements: [],
        seenOnboarding: false,
        createdAt: Date.now(),
      });
    }
    if (!loadJSON('cosmetics')) {
      saveJSON('cosmetics', {
        bodyColor:   '#ff4455',
        accentColor: '#ffcc33',
        trailColor:  '#ff66aa',
        skinId:      'classic',
        emoteIds:    ['cheer', 'taunt'],
        unlocked:    ['classic'],
      });
    }
    if (!loadJSON('replays')) saveJSON('replays', []);
    if (!loadJSON('match-history')) saveJSON('match-history', []);
  }
  rawSet(VERSION_KEY, String(CURRENT_VERSION));
}

/** Helper used by feature toggles. */
export function flag(name, fallback = false) {
  const v = loadJSON('flag::' + name, fallback);
  if (typeof v === 'boolean') return v;
  return !!v;
}

/** Persist a feature flag toggle. */
export function setFlag(name, value) {
  saveJSON('flag::' + name, !!value);
}

/**
 * Dump every persisted entry to a single JSON object — used by
 * the settings panel's "Export" button.
 */
export function exportAll() {
  const out = { version: CURRENT_VERSION, exportedAt: Date.now(), data: {} };
  for (const key of keys()) out.data[key] = loadJSON(key);
  return out;
}

/** Restore a previously exported snapshot. */
export function importAll(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.data) return false;
  for (const [key, value] of Object.entries(snapshot.data)) {
    saveJSON(key, value);
  }
  return true;
}

/** Convenience: clear all RAGBLADE-namespaced data. */
export function reset() {
  for (const key of keys()) rawRemove(ROOT_PREFIX + key);
  rawRemove(VERSION_KEY);
}
