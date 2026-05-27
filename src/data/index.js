// ============================================================
// data/index.js — Single entry point so other modules can do
// `import { weapons, arenas, ... } from '../data/index.js'`.
// ============================================================

export * as weapons     from './weapons.js';
export * as arenas      from './arenas.js';
export * as skins       from './skins.js';
export * as cards       from './cards.js';
export * as achievements from './achievements.js';
export * as emotes      from './emotes.js';
export * as ranks       from './ranks.js';
import './locale.ja.js';
import './locale.en.js';
