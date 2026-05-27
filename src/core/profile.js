// ============================================================
// profile.js — Persistent player profile (name, cosmetics, elo,
// statistics, achievements). All data is local-only.
// ============================================================

import { loadJSON, saveJSON } from '../util/storage.js';
import { bus, Channels } from '../util/events.js';
import { rankForElo, updateElo } from '../data/ranks.js';

const PROFILE_KEY = 'profile';
const COSMETICS_KEY = 'cosmetics';

const DEFAULT_PROFILE = {
  playerName: 'RAGDOLLER',
  avatarHue: 210,
  elo: 1000,
  wins: 0,
  losses: 0,
  draws: 0,
  currentStreak: 0,
  bestStreak: 0,
  playtimeSec: 0,
  achievements: [],
  weaponsUsed: [],
  arenasCleared: [],
  onlineWins: 0,
  seasonsCleared: 0,
  matchesPlayed: 0,
  damageDealt: 0,
  damageTaken: 0,
  jointsBroken: 0,
  parries: 0,
  dodges: 0,
  fatalities: 0,
  ringOuts: 0,
  hazardKills: 0,
  comebackWins: 0,
  speedWins: 0,
  flawlessWins: 0,
  titles: [],
  unlocks: ['classic'],
  lastWeapon: 'katana',
  lastArena: 'arena',
  lastCards: [],
  seenOnboarding: false,
  createdAt: Date.now(),
};

const DEFAULT_COSMETICS = {
  bodyColor: '#ff4455',
  accentColor: '#ffcc33',
  trailColor: '#ff66aa',
  skinId: 'classic',
  emoteIds: ['cheer', 'taunt'],
  unlocked: ['classic'],
};

/** Active profile object — mutated through `updateProfile()`. */
export const profile = Object.assign({}, DEFAULT_PROFILE);

/** Active cosmetics object. */
export const cosmetics = Object.assign({}, DEFAULT_COSMETICS);

/** Load persisted profile / cosmetics. */
export function loadProfile() {
  const p = loadJSON(PROFILE_KEY, null);
  if (p && typeof p === 'object') {
    for (const key of Object.keys(DEFAULT_PROFILE)) {
      if (p[key] !== undefined) profile[key] = p[key];
    }
  }
  const c = loadJSON(COSMETICS_KEY, null);
  if (c && typeof c === 'object') {
    for (const key of Object.keys(DEFAULT_COSMETICS)) {
      if (c[key] !== undefined) cosmetics[key] = c[key];
    }
  }
}

/** Persist profile + cosmetics atomically. */
export function saveProfile() {
  saveJSON(PROFILE_KEY, profile);
  saveJSON(COSMETICS_KEY, cosmetics);
}

/** Mutate a profile field and broadcast the change. */
export function updateProfile(patch) {
  if (!patch || typeof patch !== 'object') return false;
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_PROFILE)) continue;
    if (profile[key] === value) continue;
    profile[key] = value;
    changed = true;
  }
  if (changed) {
    saveProfile();
    bus.emit(Channels.PROFILE_UPDATE, { profile });
  }
  return changed;
}

/** Mutate cosmetics. */
export function updateCosmetics(patch) {
  if (!patch || typeof patch !== 'object') return false;
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_COSMETICS)) continue;
    if (cosmetics[key] === value) continue;
    cosmetics[key] = value;
    changed = true;
  }
  if (changed) {
    saveProfile();
    bus.emit(Channels.PROFILE_UPDATE, { cosmetics });
  }
  return changed;
}

/** Record a single match result and update derived stats. */
export function recordMatch(result) {
  const isWin  = result.winner === 'self';
  const isLoss = result.winner === 'opponent';
  const isDraw = !isWin && !isLoss;
  profile.matchesPlayed += 1;
  profile.playtimeSec   += Math.max(0, result.durationSec || 0);
  profile.damageDealt   += Math.max(0, result.damageDealt || 0);
  profile.damageTaken   += Math.max(0, result.damageTaken || 0);
  profile.jointsBroken  += Math.max(0, result.jointsBroken || 0);
  profile.parries       += Math.max(0, result.parries || 0);
  profile.dodges        += Math.max(0, result.dodges || 0);
  if (isWin) {
    profile.wins += 1;
    profile.currentStreak += 1;
    if (profile.currentStreak > profile.bestStreak) profile.bestStreak = profile.currentStreak;
    if (result.lastBlow === 'fatality') profile.fatalities += 1;
    if (result.lastBlow === 'ringout')  profile.ringOuts   += 1;
    if (result.lastBlow === 'hazard')   profile.hazardKills += 1;
    if ((result.damageTaken || 0) === 0) profile.flawlessWins += 1;
    if ((result.durationSec || 999) < 15) profile.speedWins += 1;
    if ((result.lowHp || 1) <= 0.1) profile.comebackWins += 1;
    if (result.online) profile.onlineWins += 1;
    if (result.arena && !profile.arenasCleared.includes(result.arena)) {
      profile.arenasCleared = [...profile.arenasCleared, result.arena];
    }
    if (result.weapon && !profile.weaponsUsed.includes(result.weapon)) {
      profile.weaponsUsed = [...profile.weaponsUsed, result.weapon];
    }
  } else if (isLoss) {
    profile.losses += 1;
    profile.currentStreak = 0;
  } else if (isDraw) {
    profile.draws += 1;
    profile.currentStreak = 0;
  }
  if (result.opponentElo) {
    profile.elo = updateElo(profile.elo, result.opponentElo, isWin ? 1 : isDraw ? 0.5 : 0);
  }
  profile.lastWeapon = result.weapon || profile.lastWeapon;
  profile.lastArena  = result.arena  || profile.lastArena;
  profile.lastCards  = result.cards  || profile.lastCards;
  saveProfile();
  bus.emit(Channels.PROFILE_UPDATE, { profile });
}

/** Unlock a skin / emote / etc. */
export function unlock(id) {
  if (!profile.unlocks.includes(id)) {
    profile.unlocks = [...profile.unlocks, id];
    saveProfile();
    return true;
  }
  return false;
}

/** Compute the current rank object for display. */
export function currentRank() {
  return rankForElo(profile.elo);
}

/** Win rate as a 0..1 fraction. */
export function winRate() {
  const total = profile.matchesPlayed || 1;
  return profile.wins / total;
}

/** Deep clone of profile + cosmetics — used by the share image. */
export function snapshot() {
  return {
    profile: { ...profile, achievements: [...profile.achievements] },
    cosmetics: { ...cosmetics, emoteIds: [...cosmetics.emoteIds] },
  };
}
