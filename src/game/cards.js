// Card system: lightweight build customization for matches.
export const CARD_LIBRARY = [
  { id: 'iron_grip', name: 'Iron Grip', rarity: 'common', desc: 'Swing stability +12%', mod: { swingStability: 0.12 } },
  { id: 'swift_wrist', name: 'Swift Wrist', rarity: 'common', desc: 'Swing speed +10%', mod: { swingSpeed: 0.10 } },
  { id: 'heavy_edge', name: 'Heavy Edge', rarity: 'rare', desc: 'Slash damage +15%', mod: { damageMul: 0.15 } },
  { id: 'counter_flux', name: 'Counter Flux', rarity: 'rare', desc: 'Parry window +80ms', mod: { parryMs: 80 } },
  { id: 'joint_sniper', name: 'Joint Sniper', rarity: 'epic', desc: 'Joint lock chance +14%', mod: { lockChance: 0.14 } },
  { id: 'ring_runner', name: 'Ring Runner', rarity: 'common', desc: 'Move speed +8%', mod: { moveSpeed: 0.08 } },
  { id: 'last_stand', name: 'Last Stand', rarity: 'epic', desc: 'Below 30% HP, damage +20%', mod: { lowHpDamage: 0.2 } },
  { id: 'titan_knee', name: 'Titan Knee', rarity: 'rare', desc: 'Knockback resistance +12%', mod: { kbResist: 0.12 } },
  { id: 'spark_rain', name: 'Spark Rain', rarity: 'common', desc: 'Hit spark count +30%', mod: { sparkMul: 0.3 } },
  { id: 'vibe_burst', name: 'Vibe Burst', rarity: 'common', desc: 'Haptic amplitude +20%', mod: { vibeMul: 0.2 } },
  { id: 'aerial_fang', name: 'Aerial Fang', rarity: 'rare', desc: 'Airborne slash +18%', mod: { airDamage: 0.18 } },
  { id: 'clean_cut', name: 'Clean Cut', rarity: 'rare', desc: 'Critical on fast swipes +12%', mod: { critChance: 0.12 } },
  { id: 'safety_boots', name: 'Safety Boots', rarity: 'common', desc: 'Ringout threshold +0.6m', mod: { ringoutBonus: 0.6 } },
  { id: 'hazard_blood', name: 'Hazard Blood', rarity: 'epic', desc: 'Hazard damage taken -18%', mod: { hazardResist: 0.18 } },
  { id: 'echo_guard', name: 'Echo Guard', rarity: 'rare', desc: 'Short guard after hit', mod: { postHitGuardMs: 320 } },
  { id: 'phoenix_tendon', name: 'Phoenix Tendon', rarity: 'legend', desc: 'One-time joint unlock', mod: { reviveJoint: 1 } },
  { id: 'arena_reader', name: 'Arena Reader', rarity: 'common', desc: 'Camera drift reduction', mod: { cameraStability: 0.22 } },
  { id: 'grit_core', name: 'Grit Core', rarity: 'common', desc: 'HP +8%', mod: { hpMul: 0.08 } },
  { id: 'tempo_driver', name: 'Tempo Driver', rarity: 'rare', desc: 'Combo decay slower', mod: { comboDecay: 0.25 } },
  { id: 'royal_arc', name: 'Royal Arc', rarity: 'legend', desc: 'Final hit slowmo extension', mod: { koSlowmoMs: 450 } },
];

export function getStarterDeck() {
  return ['iron_grip', 'heavy_edge', 'ring_runner'];
}

export function summarizeDeck(ids = []) {
  const out = { swingStability: 0, swingSpeed: 0, damageMul: 0, parryMs: 0, lockChance: 0, moveSpeed: 0, lowHpDamage: 0, kbResist: 0, sparkMul: 0, vibeMul: 0, airDamage: 0, critChance: 0, ringoutBonus: 0, hazardResist: 0, postHitGuardMs: 0, reviveJoint: 0, cameraStability: 0, hpMul: 0, comboDecay: 0, koSlowmoMs: 0 };
  const map = new Map(CARD_LIBRARY.map(c => [c.id, c]));
  ids.forEach(id => {
    const c = map.get(id);
    if (!c) return;
    Object.entries(c.mod).forEach(([k, v]) => { out[k] += v; });
  });
  return out;
}
