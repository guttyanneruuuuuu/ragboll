// ============================================================
// ranks.js — ELO ladder buckets for cosmetic ranking displays.
// ============================================================

export const RANKS = [
  { id: 'wood',     name: { ja: 'ウッド',     en: 'Wood'      }, min:    0, color: 0x9c7d4a, icon: '🪵' },
  { id: 'bronze',   name: { ja: 'ブロンズ',   en: 'Bronze'    }, min:  800, color: 0xb87333, icon: '🥉' },
  { id: 'silver',   name: { ja: 'シルバー',   en: 'Silver'    }, min: 1000, color: 0xc0c0c0, icon: '🥈' },
  { id: 'gold',     name: { ja: 'ゴールド',   en: 'Gold'      }, min: 1200, color: 0xffd700, icon: '🥇' },
  { id: 'platinum', name: { ja: 'プラチナ',   en: 'Platinum'  }, min: 1400, color: 0x9be2ff, icon: '💎' },
  { id: 'diamond',  name: { ja: 'ダイヤ',     en: 'Diamond'   }, min: 1600, color: 0x33ffee, icon: '💠' },
  { id: 'master',   name: { ja: 'マスター',   en: 'Master'    }, min: 1800, color: 0xff66ff, icon: '👑' },
  { id: 'legend',   name: { ja: 'レジェンド', en: 'Legend'    }, min: 2100, color: 0xff3366, icon: '🔥' },
];

/** Find the rank for a given ELO. */
export function rankForElo(elo) {
  let current = RANKS[0];
  for (const r of RANKS) if (elo >= r.min) current = r;
  return current;
}

/**
 * Compute an ELO update for two players. `score` is 1 for win, 0
 * for loss, 0.5 for draw. K-factor escalates for lower ranks so
 * new players climb faster.
 */
export function updateElo(playerElo, opponentElo, score) {
  const k = playerElo < 1200 ? 40 : playerElo < 1800 ? 30 : 20;
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const next = Math.round(playerElo + k * (score - expected));
  return Math.max(0, next);
}

/** Determine the next rank threshold for progress bars. */
export function nextRank(currentRankId) {
  const idx = RANKS.findIndex(r => r.id === currentRankId);
  if (idx < 0 || idx >= RANKS.length - 1) return null;
  return RANKS[idx + 1];
}
