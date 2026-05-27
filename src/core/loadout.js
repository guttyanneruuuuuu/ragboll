// ============================================================
// loadout.js — Pre-match loadout (weapon, cards, arena, skin).
// ============================================================

import { loadJSON, saveJSON } from '../util/storage.js';
import { bus, Channels } from '../util/events.js';
import { MAX_LOADOUT, combineCards, getCard } from '../data/cards.js';
import { getWeapon } from '../data/weapons.js';
import { getArena } from '../data/arenas.js';
import { getSkin } from '../data/skins.js';

const LOADOUT_KEY = 'loadout';

const DEFAULT_LOADOUT = {
  weaponId: 'katana',
  arenaId: 'arena',
  skinId: 'classic',
  cardIds: [],
};

export const loadout = Object.assign({}, DEFAULT_LOADOUT);

/** Load persisted loadout. */
export function loadLoadout() {
  const stored = loadJSON(LOADOUT_KEY, null);
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(DEFAULT_LOADOUT)) {
      if (stored[key] !== undefined) loadout[key] = stored[key];
    }
  }
  return loadout;
}

export function saveLoadout() { saveJSON(LOADOUT_KEY, loadout); }

/** Replace the current loadout (with normalisation). */
export function setLoadout(patch) {
  if (patch.weaponId) loadout.weaponId = patch.weaponId;
  if (patch.arenaId)  loadout.arenaId  = patch.arenaId;
  if (patch.skinId)   loadout.skinId   = patch.skinId;
  if (Array.isArray(patch.cardIds)) {
    loadout.cardIds = patch.cardIds.slice(0, MAX_LOADOUT).filter(id => !!getCard(id));
  }
  saveLoadout();
  bus.emit(Channels.SETTINGS_CHANGE, { key: 'loadout', value: { ...loadout } });
}

/** Toggle a card on/off (respecting MAX_LOADOUT). */
export function toggleCard(cardId) {
  const idx = loadout.cardIds.indexOf(cardId);
  if (idx >= 0) {
    loadout.cardIds.splice(idx, 1);
  } else if (loadout.cardIds.length < MAX_LOADOUT) {
    loadout.cardIds.push(cardId);
  } else {
    return false;
  }
  saveLoadout();
  bus.emit(Channels.SETTINGS_CHANGE, { key: 'loadout', value: { ...loadout } });
  return true;
}

/** Build the snapshot consumed by the gameplay layer. */
export function buildSnapshot() {
  return {
    weapon: getWeapon(loadout.weaponId),
    arena:  getArena(loadout.arenaId),
    skin:   getSkin(loadout.skinId),
    cards:  loadout.cardIds.slice(),
    effects: combineCards(loadout.cardIds),
  };
}
