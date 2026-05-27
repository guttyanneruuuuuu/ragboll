// ============================================================
// cards.js — Build / loadout cards.
//
// Cards are pre-match modifiers selected in the lobby. Up to
// `MAX_LOADOUT` cards can be equipped at once. The combat layer
// reads `card.effects` (a plain object) and merges them with the
// fighter's base stats.
// ============================================================

export const MAX_LOADOUT = 3;

export const CARDS = [
  {
    id: 'iron-grip',
    name: { ja: '鉄の握り', en: 'Iron Grip' },
    rarity: 'common',
    effects: { weaponMass: 0.15, swingForce: 0.10 },
    description: { ja: '武器を強く握ることで斬撃の威力+10%。', en: 'Tightens your grip for +10% swing power.' },
    icon: '⚒',
  },
  {
    id: 'feather-step',
    name: { ja: '羽の歩み', en: 'Feather Step' },
    rarity: 'common',
    effects: { moveSpeed: 0.15, dodgeWindow: 0.1 },
    description: { ja: '軽い体さばきで移動速度+15%、回避猶予+0.1秒。', en: 'Move 15% faster and gain an extra 0.1s dodge window.' },
    icon: '🌬',
  },
  {
    id: 'iron-bones',
    name: { ja: '鉄の骨', en: 'Iron Bones' },
    rarity: 'uncommon',
    effects: { jointHp: 30, dmgReduction: 0.05 },
    description: { ja: '関節耐久+30、被ダメージ-5%。', en: '+30 joint HP and -5% incoming damage.' },
    icon: '🦴',
  },
  {
    id: 'thrillseeker',
    name: { ja: 'スリル中毒', en: 'Thrillseeker' },
    rarity: 'uncommon',
    effects: { critChance: 0.10, critDamage: 0.20 },
    description: { ja: 'クリティカル率+10%、クリティカル威力+20%。', en: '+10% crit chance, +20% crit damage.' },
    icon: '🎯',
  },
  {
    id: 'cleaver',
    name: { ja: '骨断ち', en: 'Cleaver' },
    rarity: 'uncommon',
    effects: { jointBreak: 0.2 },
    description: { ja: '関節破壊力+20%。腕や脚を狙え！', en: '+20% joint break for limb-focused fighters.' },
    icon: '🪓',
  },
  {
    id: 'parry-master',
    name: { ja: 'パリィの達人', en: 'Parry Master' },
    rarity: 'rare',
    effects: { parryWindow: 0.15, parryDamage: 0.40 },
    description: { ja: 'パリィ猶予+0.15秒、パリィ後の反撃威力+40%。', en: 'Bigger parry window, +40% riposte damage.' },
    icon: '🛡',
  },
  {
    id: 'berserker',
    name: { ja: '狂戦士', en: 'Berserker' },
    rarity: 'rare',
    effects: { lowHpBonus: 0.6, swingForce: 0.2, jointHp: -20 },
    description: { ja: 'HP低いほど大ダメージ。ただし関節は脆くなる。', en: 'Massive damage at low HP — but joints become brittle.' },
    icon: '🔥',
  },
  {
    id: 'vampire',
    name: { ja: '吸血', en: 'Vampire' },
    rarity: 'rare',
    effects: { lifesteal: 0.10 },
    description: { ja: '与ダメージの10%を関節回復に変換。', en: 'Heal 10% of damage dealt back into joints.' },
    icon: '🩸',
  },
  {
    id: 'dasher',
    name: { ja: '神速', en: 'God Speed' },
    rarity: 'rare',
    effects: { dashCharges: 1, dashCooldown: -0.5 },
    description: { ja: 'ダッシュチャージ+1、クールダウン-0.5秒。', en: 'Extra dash charge and -0.5s cooldown.' },
    icon: '⚡',
  },
  {
    id: 'reach',
    name: { ja: 'ロングリーチ', en: 'Long Reach' },
    rarity: 'common',
    effects: { weaponLength: 0.15 },
    description: { ja: '武器のリーチ+15%。槍系と相性◎。', en: 'Adds 15% extra reach to your weapon.' },
    icon: '➡',
  },
  {
    id: 'titan',
    name: { ja: '巨人', en: 'Titan' },
    rarity: 'rare',
    effects: { scale: 0.2, jointHp: 50, moveSpeed: -0.1 },
    description: { ja: '体格20%増。耐久に優れるが少し鈍重。', en: '+20% scale and durability, slightly slower.' },
    icon: '🗿',
  },
  {
    id: 'phoenix',
    name: { ja: '不死鳥', en: 'Phoenix' },
    rarity: 'legendary',
    effects: { revive: 1, reviveHp: 0.4 },
    description: { ja: '1度倒れても40%の関節体力で復活。', en: 'Revive once at 40% joint HP.' },
    icon: '🦅',
  },
  {
    id: 'glass-cannon',
    name: { ja: 'ガラスの大砲', en: 'Glass Cannon' },
    rarity: 'legendary',
    effects: { swingForce: 0.5, jointHp: -30 },
    description: { ja: '威力+50%、関節体力-30。割り切った高火力ビルド。', en: '+50% damage at the cost of fragile joints.' },
    icon: '💥',
  },
  {
    id: 'comet',
    name: { ja: '彗星', en: 'Comet' },
    rarity: 'epic',
    effects: { swingSpeed: 0.18, trailLength: 0.5 },
    description: { ja: '振りの速さ+18%。彗星のような長い軌跡。', en: '+18% swing speed with a sweeping comet trail.' },
    icon: '☄',
  },
  {
    id: 'echo',
    name: { ja: '残響', en: 'Echo' },
    rarity: 'epic',
    effects: { echoStrike: 0.35, echoDelay: 0.18 },
    description: { ja: '斬撃の0.18秒後に35%威力の追撃。', en: 'Each swing echoes 0.18s later for 35% damage.' },
    icon: '🌀',
  },
];

const BY_ID = new Map(CARDS.map(c => [c.id, c]));

export function getCard(id) { return BY_ID.get(id); }
export function listCards() { return CARDS.slice(); }

/**
 * Combine an array of card ids into a single effect map.
 * Multiple cards stacking the same effect are added together.
 */
export function combineCards(ids = []) {
  const total = {};
  for (const id of ids) {
    const card = BY_ID.get(id);
    if (!card) continue;
    for (const [key, value] of Object.entries(card.effects)) {
      total[key] = (total[key] || 0) + value;
    }
  }
  return total;
}

/** Group cards by rarity for the lobby UI. */
export function cardsByRarity() {
  const groups = { common: [], uncommon: [], rare: [], epic: [], legendary: [] };
  for (const c of CARDS) groups[c.rarity]?.push(c);
  return groups;
}

/** Filter cards based on a search term applied to localized names. */
export function searchCards(query, locale = 'ja') {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return CARDS.slice();
  return CARDS.filter(c => {
    const name = (c.name[locale] || c.name.en || '').toLowerCase();
    return name.includes(q) || c.id.includes(q);
  });
}
