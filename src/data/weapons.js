// ============================================================
// weapons.js — Master weapon catalogue.
//
// Each entry describes the geometry, balance numbers and effects
// used by the sword / weapon system. The numbers are tuned for
// the cannon-es ragdoll setup but stay relatable in real-world
// units (metres, kilograms, m/s).
//
// Properties:
//   id            stable string id
//   name          display name (Japanese + English)
//   category      blade | blunt | polearm | exotic
//   length        full length in metres (handle + blade)
//   blade         length of the cutting region in metres
//   width         max blade width in metres (rendering hint)
//   mass          kilograms (used for inertia and impact)
//   reach         logical reach in metres (AI / hitbox)
//   swingSpeed    base swing time multiplier (1 = neutral)
//   swingForce    multiplier applied to swipe-derived impulse
//   guardBreak    chance 0..1 of bypassing a parry on direct hit
//   crit          critical hit chance 0..1
//   jointBreak    multiplier applied to joint lock checks
//   bleed         ms of additional joint disable per hit
//   trail         trail colour 0xRRGGBB
//   spark         spark colour 0xRRGGBB
//   sfx           sfx prefix to play on swing / impact
//   model         hint for the procedural geometry generator
//   description   free-form lore string
//   tags          gameplay tags (string[])
// ============================================================

import { hsl2hex } from '../util/math.js';

/** @type {Array<object>} */
export const WEAPONS = [
  {
    id: 'katana',
    name: { ja: '刀', en: 'Katana' },
    category: 'blade',
    length: 1.05, blade: 0.78, width: 0.045,
    mass: 1.1,
    reach: 1.4,
    swingSpeed: 1.05,
    swingForce: 1.0,
    guardBreak: 0.05,
    crit: 0.12,
    jointBreak: 1.05,
    bleed: 250,
    trail: 0xff5577,
    spark: 0xffcc66,
    sfx: 'sword',
    model: { type: 'katana' },
    description: { ja: '繊細な弧を描く片刃。素早い斬撃と低い重量が魅力。', en: 'A graceful single-edged blade prized for swift cuts.' },
    tags: ['starter', 'agile', 'cut'],
  },
  {
    id: 'greatsword',
    name: { ja: '大剣', en: 'Greatsword' },
    category: 'blade',
    length: 1.65, blade: 1.20, width: 0.09,
    mass: 3.4,
    reach: 1.9,
    swingSpeed: 0.7,
    swingForce: 1.6,
    guardBreak: 0.35,
    crit: 0.08,
    jointBreak: 1.4,
    bleed: 350,
    trail: 0xff7733,
    spark: 0xffee88,
    sfx: 'heavy',
    model: { type: 'greatsword' },
    description: { ja: '一撃で関節を粉砕する両手剣。ガードごと吹き飛ばす。', en: 'A two-handed slab that shrugs through guard like paper.' },
    tags: ['heavy', 'guardbreak'],
  },
  {
    id: 'rapier',
    name: { ja: 'レイピア', en: 'Rapier' },
    category: 'blade',
    length: 1.10, blade: 0.92, width: 0.025,
    mass: 0.7,
    reach: 1.5,
    swingSpeed: 1.35,
    swingForce: 0.75,
    guardBreak: 0.10,
    crit: 0.28,
    jointBreak: 0.9,
    bleed: 200,
    trail: 0x99e0ff,
    spark: 0xccffff,
    sfx: 'rapier',
    model: { type: 'rapier' },
    description: { ja: '突きに特化した細身の剣。クリティカル率が高い。', en: 'Slender thrust-focused blade; critical-prone.' },
    tags: ['agile', 'crit'],
  },
  {
    id: 'twin',
    name: { ja: '双剣', en: 'Twin Blades' },
    category: 'blade',
    length: 0.85, blade: 0.62, width: 0.04,
    mass: 0.9,
    reach: 1.25,
    swingSpeed: 1.45,
    swingForce: 0.7,
    guardBreak: 0.04,
    crit: 0.15,
    jointBreak: 0.95,
    bleed: 220,
    trail: 0xff99aa,
    spark: 0xffe2ff,
    sfx: 'twin',
    model: { type: 'twin' },
    description: { ja: '二刀流。手数で関節を削り倒す爽快コンボ向け。', en: 'Dual-wield combos shred joints with raw tempo.' },
    tags: ['agile', 'combo'],
  },
  {
    id: 'axe',
    name: { ja: '斧', en: 'War Axe' },
    category: 'blunt',
    length: 1.30, blade: 0.40, width: 0.20,
    mass: 2.8,
    reach: 1.55,
    swingSpeed: 0.78,
    swingForce: 1.35,
    guardBreak: 0.40,
    crit: 0.10,
    jointBreak: 1.5,
    bleed: 280,
    trail: 0xff5544,
    spark: 0xffaa66,
    sfx: 'axe',
    model: { type: 'axe' },
    description: { ja: '断ち割る一撃。ガードを引き剥がす重量級。', en: 'Cleaving blows rip guards apart.' },
    tags: ['heavy', 'guardbreak'],
  },
  {
    id: 'spear',
    name: { ja: '槍', en: 'Spear' },
    category: 'polearm',
    length: 2.45, blade: 0.45, width: 0.05,
    mass: 1.8,
    reach: 2.4,
    swingSpeed: 0.95,
    swingForce: 1.0,
    guardBreak: 0.15,
    crit: 0.18,
    jointBreak: 1.05,
    bleed: 240,
    trail: 0xaaffd2,
    spark: 0xeaffd2,
    sfx: 'spear',
    model: { type: 'spear' },
    description: { ja: '圧倒的なリーチ。先端の突きが関節を一閃。', en: 'Long reach thrusts pin opponents at range.' },
    tags: ['reach', 'thrust'],
  },
  {
    id: 'scythe',
    name: { ja: '大鎌', en: 'Scythe' },
    category: 'polearm',
    length: 2.10, blade: 0.85, width: 0.07,
    mass: 2.2,
    reach: 2.05,
    swingSpeed: 0.85,
    swingForce: 1.2,
    guardBreak: 0.18,
    crit: 0.22,
    jointBreak: 1.25,
    bleed: 360,
    trail: 0xc28cff,
    spark: 0xefd8ff,
    sfx: 'scythe',
    model: { type: 'scythe' },
    description: { ja: '湾曲した刃で広い弧を描く。複数の関節を同時に狙える。', en: 'A curved sweep that catches multiple joints at once.' },
    tags: ['sweep', 'crit'],
  },
  {
    id: 'hammer',
    name: { ja: 'ハンマー', en: 'War Hammer' },
    category: 'blunt',
    length: 1.20, blade: 0.30, width: 0.22,
    mass: 4.5,
    reach: 1.45,
    swingSpeed: 0.6,
    swingForce: 1.85,
    guardBreak: 0.55,
    crit: 0.05,
    jointBreak: 1.6,
    bleed: 100,
    trail: 0x88aaff,
    spark: 0xccddff,
    sfx: 'hammer',
    model: { type: 'hammer' },
    description: { ja: '叩き潰す重撃。直撃すれば一撃で関節をぶち抜く。', en: 'Crushing blows can shatter a joint in one strike.' },
    tags: ['heavy', 'stagger'],
  },
  {
    id: 'naginata',
    name: { ja: '薙刀', en: 'Naginata' },
    category: 'polearm',
    length: 2.00, blade: 0.62, width: 0.06,
    mass: 2.0,
    reach: 2.15,
    swingSpeed: 0.9,
    swingForce: 1.1,
    guardBreak: 0.12,
    crit: 0.15,
    jointBreak: 1.15,
    bleed: 290,
    trail: 0xfff599,
    spark: 0xffffd9,
    sfx: 'naginata',
    model: { type: 'naginata' },
    description: { ja: '長柄に湾刀。リーチと斬撃力のバランスが秀逸。', en: 'Curved blade on a long shaft — clean balance of reach and cut.' },
    tags: ['reach', 'sweep'],
  },
  {
    id: 'shortsword',
    name: { ja: 'ショートソード', en: 'Short Sword' },
    category: 'blade',
    length: 0.78, blade: 0.55, width: 0.05,
    mass: 0.9,
    reach: 1.15,
    swingSpeed: 1.25,
    swingForce: 0.85,
    guardBreak: 0.08,
    crit: 0.14,
    jointBreak: 0.95,
    bleed: 220,
    trail: 0xffcc66,
    spark: 0xffe8aa,
    sfx: 'short',
    model: { type: 'short' },
    description: { ja: '汎用的な片手剣。安定したダメージを叩き出す。', en: 'A balanced one-handed blade for any situation.' },
    tags: ['agile'],
  },
  {
    id: 'estoc',
    name: { ja: 'エストック', en: 'Estoc' },
    category: 'blade',
    length: 1.45, blade: 1.15, width: 0.03,
    mass: 1.7,
    reach: 1.75,
    swingSpeed: 1.0,
    swingForce: 0.95,
    guardBreak: 0.30,
    crit: 0.25,
    jointBreak: 1.1,
    bleed: 200,
    trail: 0xb6c8ff,
    spark: 0xffffff,
    sfx: 'estoc',
    model: { type: 'estoc' },
    description: { ja: '突き専用の鋭利な細剣。ガード貫通力と長リーチを両立。', en: 'A thrust-only spike that pierces shields and joints alike.' },
    tags: ['thrust', 'guardbreak'],
  },
  {
    id: 'plasma',
    name: { ja: 'プラズマブレード', en: 'Plasma Blade' },
    category: 'exotic',
    length: 1.10, blade: 0.85, width: 0.06,
    mass: 1.2,
    reach: 1.45,
    swingSpeed: 1.15,
    swingForce: 1.2,
    guardBreak: 0.45,
    crit: 0.20,
    jointBreak: 1.3,
    bleed: 100,
    trail: 0x33ffff,
    spark: 0x99ffff,
    sfx: 'plasma',
    model: { type: 'plasma' },
    description: { ja: '発光する刀身でガードを焼き切るオーバーテック武器。', en: 'A glowing edge that burns straight through shields.' },
    tags: ['exotic', 'guardbreak'],
  },
];

/** Fast lookup by id. */
const BY_ID = new Map(WEAPONS.map(w => [w.id, w]));

/** Return a weapon by id, falling back to katana. */
export function getWeapon(id) {
  return BY_ID.get(id) || BY_ID.get('katana');
}

/** Iterate all weapons in declaration order. */
export function listWeapons() {
  return WEAPONS.slice();
}

/** Filter by category. */
export function weaponsByCategory(category) {
  return WEAPONS.filter(w => w.category === category);
}

/** Convert weapon mass to a damage multiplier used by the swing system. */
export function massToImpact(mass) {
  return Math.sqrt(mass) * 1.05;
}

/** Convert weapon length to logical reach used by AI and hitbox. */
export function reachFor(weapon) {
  return weapon.reach || (weapon.length * 1.05);
}

/** Derive a neutral hue value for the swing trail (when overridden). */
export function trailHueFor(weapon, fallback = 0) {
  return weapon.trail || hsl2hex(fallback / 360, 0.9, 0.55);
}

/** A handy list of unlock-able weapons for the cosmetic shop. */
export const UNLOCKABLE_WEAPONS = WEAPONS
  .filter(w => !w.tags.includes('starter'))
  .map(w => w.id);
