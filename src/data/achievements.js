// ============================================================
// achievements.js — Long-tail meta progression.
//
// Each achievement is matched against the live `profile` and
// optional in-match event stream. Triggers happen at match end
// or on specific event channels.
// ============================================================

export const ACHIEVEMENTS = [
  {
    id: 'first-blood',
    name: { ja: '初陣', en: 'First Blood' },
    description: { ja: '初めて勝利を収める。', en: 'Win your very first match.' },
    icon: '🏆', xp: 50,
    test: ({ profile, result }) => result?.winner === 'self' && (profile.wins || 0) <= 1,
  },
  {
    id: 'flawless',
    name: { ja: '無傷', en: 'Flawless' },
    description: { ja: '1試合を無傷で勝利する。', en: 'Win a match without taking damage.' },
    icon: '✨', xp: 200,
    test: ({ result }) => result?.winner === 'self' && (result?.damageTaken || 0) === 0,
  },
  {
    id: 'dodger',
    name: { ja: '紙一重', en: 'Slippery' },
    description: { ja: '1試合で20回回避を成功させる。', en: 'Dodge 20 attacks in one match.' },
    icon: '💨', xp: 80,
    test: ({ result }) => (result?.dodges || 0) >= 20,
  },
  {
    id: 'butcher',
    name: { ja: '解体屋', en: 'Butcher' },
    description: { ja: '1試合で6箇所の関節を破壊する。', en: 'Break 6 enemy joints in one match.' },
    icon: '🩻', xp: 120,
    test: ({ result }) => (result?.jointsBroken || 0) >= 6,
  },
  {
    id: 'long-shot',
    name: { ja: 'ロングショット', en: 'Long Shot' },
    description: { ja: '槍系で5kg/sを超える初撃を当てる。', en: 'Land a 5+ kg·s impact with a polearm.' },
    icon: '🏹', xp: 80,
    test: ({ event }) => event?.type === 'hit' && event.category === 'polearm' && event.impact > 5,
  },
  {
    id: 'streak-5',
    name: { ja: '5連勝', en: 'Hot Streak' },
    description: { ja: '5連勝する。', en: 'Win 5 matches in a row.' },
    icon: '🔥', xp: 200,
    test: ({ profile }) => (profile?.currentStreak || 0) >= 5,
  },
  {
    id: 'globetrotter',
    name: { ja: '世界遍歴', en: 'Globetrotter' },
    description: { ja: '全アリーナで勝利する。', en: 'Win on every arena.' },
    icon: '🗺', xp: 300,
    test: ({ profile }) => (profile?.arenasCleared || []).length >= 6,
  },
  {
    id: 'collector',
    name: { ja: '武器コレクター', en: 'Weapon Collector' },
    description: { ja: '全武器で勝利する。', en: 'Win with every weapon at least once.' },
    icon: '🗡', xp: 300,
    test: ({ profile }) => (profile?.weaponsUsed || []).length >= 12,
  },
  {
    id: 'parry-king',
    name: { ja: 'パリィ王', en: 'Parry King' },
    description: { ja: '1試合で10回パリィに成功する。', en: 'Parry 10 attacks in a match.' },
    icon: '🛡', xp: 120,
    test: ({ result }) => (result?.parries || 0) >= 10,
  },
  {
    id: 'environmentalist',
    name: { ja: '環境利用者', en: 'Environmentalist' },
    description: { ja: '環境ダメージで勝利する。', en: 'Win using environmental damage.' },
    icon: '🌋', xp: 150,
    test: ({ result }) => result?.winner === 'self' && result?.lastBlow === 'hazard',
  },
  {
    id: 'speedrunner',
    name: { ja: '電光石火', en: 'Speedrunner' },
    description: { ja: '15秒以内で勝利する。', en: 'Win a match in under 15 seconds.' },
    icon: '⏱', xp: 150,
    test: ({ result }) => result?.winner === 'self' && (result?.durationSec || 999) < 15,
  },
  {
    id: 'comeback',
    name: { ja: '逆転劇', en: 'Comeback Kid' },
    description: { ja: '関節耐久10%以下から勝利する。', en: 'Win after dropping below 10% joint HP.' },
    icon: '🔄', xp: 200,
    test: ({ result }) => result?.winner === 'self' && (result?.lowHp || 1) <= 0.1,
  },
  {
    id: 'social-butterfly',
    name: { ja: '社交家', en: 'Social Butterfly' },
    description: { ja: 'オンラインで10勝する。', en: 'Win 10 online matches.' },
    icon: '🌐', xp: 250,
    test: ({ profile }) => (profile?.onlineWins || 0) >= 10,
  },
  {
    id: 'duelist',
    name: { ja: '決闘者', en: 'Duelist' },
    description: { ja: '通算100戦を達成する。', en: 'Play 100 matches in total.' },
    icon: '⚔', xp: 200,
    test: ({ profile }) => ((profile?.wins || 0) + (profile?.losses || 0) + (profile?.draws || 0)) >= 100,
  },
];

const BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

export function getAchievement(id) { return BY_ID.get(id); }
export function listAchievements() { return ACHIEVEMENTS.slice(); }

/**
 * Evaluate which achievements should be unlocked given the live
 * profile and an optional event object emitted by the combat
 * system (`{ type, ... }`).
 */
export function evaluate({ profile, result = null, event = null }) {
  const unlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if ((profile?.achievements || []).includes(ach.id)) continue;
    try {
      if (ach.test({ profile, result, event })) unlocked.push(ach.id);
    } catch (_err) { /* ignore broken predicates */ }
  }
  return unlocked;
}
