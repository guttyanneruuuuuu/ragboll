// ============================================================
// settings.js — Live game settings with persistence.
//
// We keep the settings object reactive so that UI components can
// subscribe to changes through the global event bus.
// ============================================================

import { bus, Channels } from '../util/events.js';
import { loadJSON, saveJSON, migrate } from '../util/storage.js';
import { clamp } from '../util/math.js';

export const DEFAULT_SETTINGS = Object.freeze({
  sfxVolume: 0.8,
  bgmVolume: 0.5,
  haptics: true,
  quality: 'medium',          // low | medium | high
  sensitivity: 1.0,           // 0.2 .. 2.0
  weapon: 'katana',
  arena: 'arena',
  camera: 'portrait',         // portrait | dynamic
  controls: 'dualstick',      // dualstick | onehand | gamepad
  locale: 'ja',
  bloodEffects: 'on',         // on | stardust
  showFps: false,
  highContrast: false,
  reduceMotion: false,
  invertY: false,
  showJointHud: true,
  cinematicKills: true,
  voiceChat: false,
  tutorialDone: false,
});

const SETTINGS_KEY = 'settings';

/** The active settings object — mutated through `update()`. */
export const settings = Object.assign({}, DEFAULT_SETTINGS);

/** Load persisted settings from localStorage and merge them in. */
export function loadSettings() {
  migrate();
  const stored = loadJSON(SETTINGS_KEY, null);
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (stored[key] !== undefined) settings[key] = stored[key];
    }
  }
  return settings;
}

/** Persist current settings synchronously. */
export function saveSettings() {
  saveJSON(SETTINGS_KEY, settings);
}

/**
 * Update one or many settings entries and broadcast every change
 * through the global bus so the audio engine / renderer / UI can
 * react. `key` may also be an object literal — `{ a: 1, b: 2 }`.
 */
export function update(keyOrObject, value) {
  const map = typeof keyOrObject === 'object'
    ? keyOrObject
    : { [keyOrObject]: value };
  let changed = false;
  for (const [key, raw] of Object.entries(map)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    const normalized = normalize(key, raw);
    if (settings[key] === normalized) continue;
    settings[key] = normalized;
    bus.emit(Channels.SETTINGS_CHANGE, { key, value: normalized });
    changed = true;
  }
  if (changed) saveSettings();
  return changed;
}

/** Reset to factory defaults. */
export function resetSettings() {
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    settings[key] = DEFAULT_SETTINGS[key];
  }
  saveSettings();
  bus.emit(Channels.SETTINGS_CHANGE, { key: '*', value: null });
}

/** Coerce numeric values, clamp ranges, validate enums. */
function normalize(key, value) {
  switch (key) {
    case 'sfxVolume':
    case 'bgmVolume':   return clamp(Number(value), 0, 1);
    case 'sensitivity': return clamp(Number(value), 0.2, 2.0);
    case 'haptics':
    case 'showFps':
    case 'highContrast':
    case 'reduceMotion':
    case 'invertY':
    case 'showJointHud':
    case 'cinematicKills':
    case 'voiceChat':
    case 'tutorialDone':
      return !!value;
    case 'quality':
      return ['low','medium','high'].includes(value) ? value : 'medium';
    case 'camera':
      return value === 'dynamic' ? 'dynamic' : 'portrait';
    case 'controls':
      return ['dualstick','onehand','gamepad'].includes(value) ? value : 'dualstick';
    case 'bloodEffects':
      return value === 'stardust' ? 'stardust' : 'on';
    case 'locale':
      return ['ja','en'].includes(value) ? value : 'ja';
    case 'weapon':
    case 'arena':
      return String(value || '').slice(0, 32);
    default:
      return value;
  }
}

/** Expose current settings as a shallow copy. */
export function snapshot() { return { ...settings }; }

/** Subscribe shortcut. Returns an unsubscribe function. */
export function onChange(handler) {
  return bus.on(Channels.SETTINGS_CHANGE, handler);
}
