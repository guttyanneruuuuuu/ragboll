// ============================================================
// skins.js — Cosmetic skins and palette presets.
// ============================================================

export const SKINS = [
  {
    id: 'classic',
    name: { ja: 'クラシック', en: 'Classic' },
    body: 0xff4455, accent: 0xffcc33, trail: 0xff66aa,
    description: { ja: '本家リスペクトの黄＋赤コンビ。', en: 'Mobile original red/gold homage.' },
    unlock: 'starter',
  },
  {
    id: 'cyber',
    name: { ja: 'サイバー', en: 'Cyber' },
    body: 0x33aaff, accent: 0x33ffee, trail: 0x66ffff,
    description: { ja: 'ネオン光るサイバー戦士。', en: 'Cyber warrior with neon highlights.' },
    unlock: 'level:5',
  },
  {
    id: 'jade',
    name: { ja: '翡翠', en: 'Jade' },
    body: 0x33dd77, accent: 0xffeeaa, trail: 0xaaffcc,
    description: { ja: '緑の翡翠を纏った戦士。', en: 'A warrior wrapped in pale jade.' },
    unlock: 'level:10',
  },
  {
    id: 'royal',
    name: { ja: '王権', en: 'Royal' },
    body: 0x6633cc, accent: 0xffd700, trail: 0xeebbff,
    description: { ja: '紫と金。王者の風格。', en: 'Purple and gold worn by champions.' },
    unlock: 'win:25',
  },
  {
    id: 'inferno',
    name: { ja: '業火', en: 'Inferno' },
    body: 0xff3300, accent: 0xff9900, trail: 0xffd700,
    description: { ja: '炎をまとった闘士。', en: 'A warrior wreathed in flame.' },
    unlock: 'streak:5',
  },
  {
    id: 'ghost',
    name: { ja: '幻影', en: 'Ghost' },
    body: 0x223344, accent: 0xaabbcc, trail: 0xffffff,
    description: { ja: '影のように動く幻影スキン。', en: 'Move like a shadow.' },
    unlock: 'achievement:dodger',
  },
  {
    id: 'sakura',
    name: { ja: '桜', en: 'Sakura' },
    body: 0xffaacc, accent: 0xff77aa, trail: 0xffd0e3,
    description: { ja: '春の桜舞う桃色スキン。', en: 'Spring sakura pink.' },
    unlock: 'season:1',
  },
  {
    id: 'gold',
    name: { ja: '黄金', en: 'Gold' },
    body: 0xffd233, accent: 0xff9933, trail: 0xfff0a0,
    description: { ja: '純金製の伝説のラグドール。', en: 'Pure gold legendary ragdoll.' },
    unlock: 'champion',
  },
];

const BY_ID = new Map(SKINS.map(s => [s.id, s]));

export function getSkin(id) {
  return BY_ID.get(id) || BY_ID.get('classic');
}

export function listSkins() {
  return SKINS.slice();
}

/** Determine whether the player owns the unlock token. */
export function skinUnlocked(skin, profile) {
  if (!skin || !skin.unlock) return true;
  if (skin.unlock === 'starter') return true;
  if (!profile) return false;
  const [kind, value] = skin.unlock.split(':');
  switch (kind) {
    case 'level':       return (profile.level || 1) >= parseInt(value, 10);
    case 'win':         return (profile.wins || 0) >= parseInt(value, 10);
    case 'streak':      return (profile.bestStreak || 0) >= parseInt(value, 10);
    case 'achievement': return (profile.achievements || []).includes(value);
    case 'season':      return (profile.seasonsCleared || 0) >= parseInt(value, 10);
    case 'champion':    return (profile.titles || []).includes('champion');
    default:            return (profile.unlocks || []).includes(skin.id);
  }
}
