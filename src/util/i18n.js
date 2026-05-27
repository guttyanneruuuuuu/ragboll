// ============================================================
// i18n.js — Tiny string-table localisation helper.
//
// English / Japanese strings live in `src/data/locale.*.js` and
// register themselves through `register(locale, strings)`.
// ============================================================

import { bus, Channels } from './events.js';

const tables = new Map();
let currentLocale = 'ja';
let fallbackLocale = 'en';

/** Register an i18n table for a locale code (e.g. 'ja'). */
export function register(locale, strings) {
  tables.set(locale, Object.assign(tables.get(locale) || {}, strings));
}

/** Return the active locale string. */
export function getLocale() { return currentLocale; }

/** Change the active locale and broadcast on the global bus. */
export function setLocale(locale) {
  if (currentLocale === locale) return;
  currentLocale = locale;
  bus.emit(Channels.SETTINGS_CHANGE, { key: 'locale', value: locale });
}

/** List supported locales. */
export function locales() { return Array.from(tables.keys()); }

/**
 * Resolve a translation key. Returns the key itself when no
 * matching entry is found (so missing translations are obvious in
 * the UI without crashing).
 */
export function t(key, params) {
  let table = tables.get(currentLocale);
  let value = table ? table[key] : undefined;
  if (value === undefined) {
    table = tables.get(fallbackLocale);
    value = table ? table[key] : undefined;
  }
  if (value === undefined) value = key;
  if (params) {
    value = String(value).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
  }
  return value;
}

/** Set the fallback locale (defaults to 'en'). */
export function setFallback(locale) { fallbackLocale = locale; }

/** Detect the most appropriate locale from the browser. */
export function detect(supported = ['ja', 'en']) {
  const list = navigator.languages || [navigator.language || 'en'];
  for (const lang of list) {
    const short = String(lang).slice(0, 2).toLowerCase();
    if (supported.includes(short)) return short;
  }
  return supported[0] || 'en';
}

/** Tag string template helper — `tpl`Hello {name}`,{name:'..'}`. */
export function tpl(strings, ...values) {
  let out = '';
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) out += values[i] ?? '';
  });
  return out;
}
