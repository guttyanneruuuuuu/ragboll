// ============================================================
// logger.js — Lightweight tagged logger with severity filtering.
//
// We use this instead of bare `console.log` so we can:
//   1. silence noisy modules in production
//   2. forward warnings to the on-screen debug overlay
//   3. include timestamps and tags consistently
// ============================================================

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

const state = {
  level: 'info',
  tags: new Set(),
  history: [],
  maxHistory: 200,
  sinks: new Set(),
};

/** Configure the global log level (e.g. 'debug', 'info', 'warn'). */
export function setLevel(level) {
  if (LEVELS[level] !== undefined) state.level = level;
}

/** Allow specific tags through regardless of the global level. */
export function enableTags(...tags) {
  for (const t of tags) state.tags.add(t);
}

/** Disable previously enabled tags. */
export function disableTags(...tags) {
  for (const t of tags) state.tags.delete(t);
}

/** Add a sink (function) that receives every log entry. */
export function addSink(fn) {
  state.sinks.add(fn);
  return () => state.sinks.delete(fn);
}

function shouldLog(level, tag) {
  if (state.tags.has(tag)) return true;
  return LEVELS[level] >= LEVELS[state.level];
}

function record(level, tag, args) {
  const entry = { time: Date.now(), level, tag, message: args };
  state.history.push(entry);
  if (state.history.length > state.maxHistory) state.history.shift();
  for (const sink of state.sinks) {
    try { sink(entry); } catch (_err) { /* ignore */ }
  }
}

function format(tag) {
  const date = new Date();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `[${hh}:${mm}:${ss}.${ms}][${tag}]`;
}

/** Get a logger bound to a tag — `const log = logger('combat')`. */
export function logger(tag) {
  const prefix = () => format(tag);
  return {
    debug(...args) {
      if (!shouldLog('debug', tag)) return;
      record('debug', tag, args);
      console.debug(prefix(), ...args);
    },
    info(...args) {
      if (!shouldLog('info', tag)) return;
      record('info', tag, args);
      console.log(prefix(), ...args);
    },
    warn(...args) {
      if (!shouldLog('warn', tag)) return;
      record('warn', tag, args);
      console.warn(prefix(), ...args);
    },
    error(...args) {
      if (!shouldLog('error', tag)) return;
      record('error', tag, args);
      console.error(prefix(), ...args);
    },
    group(label) {
      if (!shouldLog('debug', tag)) return;
      if (console.group) console.group(prefix(), label);
    },
    groupEnd() {
      if (console.groupEnd) console.groupEnd();
    },
  };
}

/** Read the recent log entries — useful for in-game debug overlays. */
export function getHistory() { return state.history.slice(); }

/** Wipe the log history (called by the debug overlay's clear button). */
export function clearHistory() { state.history.length = 0; }

/** Internal convenience instance used by quick-and-dirty logs. */
export const log = logger('core');
