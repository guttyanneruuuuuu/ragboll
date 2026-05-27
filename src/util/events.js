// ============================================================
// events.js — Tiny zero-dependency event emitter used as the
// glue between gameplay, UI and networking layers.
// ============================================================

/**
 * Minimal Node-style event emitter. Listener errors are caught so
 * that one buggy module cannot stop the entire game loop.
 */
export class EventEmitter {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
    /** @type {Map<string, Set<Function>>} */
    this._once = new Map();
    this._anyHandlers = new Set();
  }

  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    if (!this._once.has(event)) this._once.set(event, new Set());
    this._once.get(event).add(handler);
    return () => {
      const set = this._once.get(event);
      if (set) set.delete(handler);
    };
  }

  off(event, handler) {
    const set = this._handlers.get(event);
    if (set) set.delete(handler);
    const once = this._once.get(event);
    if (once) once.delete(handler);
  }

  onAny(handler) {
    this._anyHandlers.add(handler);
    return () => this._anyHandlers.delete(handler);
  }

  emit(event, payload) {
    const set = this._handlers.get(event);
    if (set) {
      for (const fn of set) {
        try { fn(payload, event); }
        catch (err) { console.error(`[EventEmitter:${event}]`, err); }
      }
    }
    const once = this._once.get(event);
    if (once && once.size) {
      const arr = Array.from(once);
      once.clear();
      for (const fn of arr) {
        try { fn(payload, event); }
        catch (err) { console.error(`[EventEmitter:${event}]`, err); }
      }
    }
    if (this._anyHandlers.size) {
      for (const fn of this._anyHandlers) {
        try { fn(event, payload); }
        catch (err) { console.error('[EventEmitter:any]', err); }
      }
    }
  }

  /** Remove every listener — primarily used in tests. */
  clear() {
    this._handlers.clear();
    this._once.clear();
    this._anyHandlers.clear();
  }

  /** Count listeners for a given event (or total). */
  listenerCount(event) {
    if (event === undefined) {
      let total = this._anyHandlers.size;
      for (const set of this._handlers.values()) total += set.size;
      for (const set of this._once.values())     total += set.size;
      return total;
    }
    return (this._handlers.get(event)?.size || 0)
         + (this._once.get(event)?.size || 0);
  }
}

/**
 * Global event-bus shared by all subsystems. The bus avoids deep
 * dependencies (UI ↔ Game ↔ Audio ↔ Net) while keeping the code
 * straight forward to debug because every subscription registers
 * onto the same instance.
 */
export const bus = new EventEmitter();

/** Channel names used by RAGBLADE — kept in one place for searchability. */
export const Channels = Object.freeze({
  // global lifecycle
  GAME_INIT:         'game/init',
  GAME_START:        'game/start',
  GAME_PAUSE:        'game/pause',
  GAME_RESUME:       'game/resume',
  GAME_END:          'game/end',
  GAME_TICK:         'game/tick',

  // combat
  COMBAT_HIT:        'combat/hit',
  COMBAT_PARRY:      'combat/parry',
  COMBAT_DEATH:      'combat/death',
  COMBAT_JOINT_LOCK: 'combat/joint-lock',
  COMBAT_FATALITY:   'combat/fatality',
  COMBAT_SWING:      'combat/swing',
  COMBAT_BLOCK:      'combat/block',
  COMBAT_DODGE:      'combat/dodge',
  COMBAT_RING_OUT:   'combat/ring-out',
  COMBAT_HAZARD:     'combat/hazard',

  // ui
  UI_SCREEN:         'ui/screen',
  UI_TOAST:          'ui/toast',
  UI_HUD:            'ui/hud',
  UI_FLASH:          'ui/flash',
  UI_VIBRATE:        'ui/vibrate',
  UI_NAV:            'ui/nav',

  // network
  NET_CONNECTED:     'net/connected',
  NET_DISCONNECTED:  'net/disconnected',
  NET_MESSAGE:       'net/message',
  NET_LATENCY:       'net/latency',
  NET_ROOM:          'net/room',

  // audio
  AUDIO_PLAY:        'audio/play',
  AUDIO_BGM:         'audio/bgm',
  AUDIO_DUCK:        'audio/duck',

  // meta
  SETTINGS_CHANGE:   'settings/change',
  PROFILE_UPDATE:    'profile/update',
  REPLAY_REC:        'replay/recording',
  REPLAY_END:        'replay/end',
  ACHIEVEMENT:       'meta/achievement',
});
