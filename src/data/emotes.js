// ============================================================
// emotes.js — Post-match and in-game emotes.
// ============================================================

export const EMOTES = [
  { id: 'cheer',  name: { ja: '万歳', en: 'Cheer' },   icon: '🙌', animation: 'cheer'  },
  { id: 'taunt',  name: { ja: '挑発', en: 'Taunt' },   icon: '😈', animation: 'taunt'  },
  { id: 'bow',    name: { ja: 'お辞儀', en: 'Bow' },   icon: '🙇', animation: 'bow'    },
  { id: 'dance',  name: { ja: 'ダンス', en: 'Dance' }, icon: '💃', animation: 'dance'  },
  { id: 'cry',    name: { ja: '号泣', en: 'Cry' },     icon: '😭', animation: 'cry'    },
  { id: 'gg',     name: { ja: 'GG',   en: 'GG' },      icon: '🤝', animation: 'wave'   },
  { id: 'laugh',  name: { ja: '爆笑', en: 'Laugh' },   icon: '😂', animation: 'laugh'  },
  { id: 'angry',  name: { ja: '激怒', en: 'Angry' },   icon: '😡', animation: 'stomp'  },
];

const BY_ID = new Map(EMOTES.map(e => [e.id, e]));

export function getEmote(id) { return BY_ID.get(id); }
export function listEmotes() { return EMOTES.slice(); }
