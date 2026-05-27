// ============================================================
// arenas.js — Stage / arena presets.
//
// Each preset declares geometry hints and gimmicks. The actual
// builders live in `src/game/arenas/*` and consume the preset
// at construction time, so designers can iterate on numbers here
// without touching rendering code.
// ============================================================

export const ARENAS = [
  {
    id: 'arena',
    name: { ja: 'ネオンアリーナ', en: 'Neon Arena' },
    type: 'platform',
    size: { x: 24, z: 24 },
    floor: { color: 0x101220, grid: 0x4455ff },
    ringOut: false,
    walls: true,
    hazards: [],
    sky: { color: 0x0a0a14, fogNear: 18, fogFar: 60 },
    spawnPoints: [
      { x: -3.5, z: 0 }, { x: 3.5, z: 0 },
      { x: 0,    z: -3.5 }, { x: 0, z: 3.5 },
    ],
    music: 'arena',
    description: { ja: 'ネオン照明が瞬く対戦用標準ステージ。', en: 'Default tournament arena bathed in neon light.' },
  },
  {
    id: 'ringout',
    name: { ja: 'リングアウト闘技場', en: 'Ringout Coliseum' },
    type: 'platform',
    size: { x: 18, z: 18 },
    floor: { color: 0x231a0a, grid: 0xff8844 },
    ringOut: true,
    walls: false,
    pit: { y: -10, killBelow: -4 },
    hazards: [],
    sky: { color: 0x18120a, fogNear: 24, fogFar: 80 },
    spawnPoints: [ { x: -4, z: 0 }, { x: 4, z: 0 } ],
    music: 'arena',
    description: { ja: '壁のない円形ステージ。場外で即死。', en: 'Wall-less platform — fall off and die instantly.' },
  },
  {
    id: 'hazard',
    name: { ja: '回転刃ハザード', en: 'Hazard Blades' },
    type: 'platform',
    size: { x: 20, z: 20 },
    floor: { color: 0x1a0a14, grid: 0xff3377 },
    ringOut: false,
    walls: true,
    hazards: [
      { type: 'blade', position: { x: 0, z: 0 }, radius: 3.2, speed: 2.4, damage: 90, height: 0.6 },
      { type: 'blade', position: { x: -6, z: -4 }, radius: 1.8, speed: 3.5, damage: 60, height: 0.5 },
      { type: 'blade', position: { x: 6, z: 4 },   radius: 1.8, speed: 3.5, damage: 60, height: 0.5 },
    ],
    sky: { color: 0x180a14, fogNear: 18, fogFar: 60 },
    spawnPoints: [ { x: -7, z: 6 }, { x: 7, z: -6 }, { x: -7, z: -6 }, { x: 7, z: 6 } ],
    music: 'hazard',
    description: { ja: '床に巨大な回転刃。触れたら関節がもげる。', en: 'Giant rotor blades crisscross the floor.' },
  },
  {
    id: 'meadow',
    name: { ja: '草原バレー', en: 'Meadow Valley' },
    type: 'open',
    size: { x: 32, z: 32 },
    floor: { color: 0x1a4422, grid: 0x66cc66, organic: true },
    ringOut: false,
    walls: false,
    softBoundary: { radius: 14, returnForce: 12 },
    hazards: [],
    sky: { color: 0xa6d8ff, fogNear: 30, fogFar: 100 },
    portraitCamera: true,
    spawnPoints: [
      { x: -3, z: 0 }, { x: 3, z: 0 },
      { x: -3, z: -3 }, { x: 3, z: 3 },
    ],
    music: 'meadow',
    description: { ja: '青空の下、果てしなく広がる草原。固定カメラで本家風味。', en: 'Endless grassland under a vivid sky — portrait camera evokes the mobile original.' },
  },
  {
    id: 'castle',
    name: { ja: '雪の城', en: 'Snowy Keep' },
    type: 'platform',
    size: { x: 22, z: 22 },
    floor: { color: 0xc7d8ee, grid: 0xffffff },
    ringOut: true,
    walls: false,
    pit: { y: -12, killBelow: -3 },
    hazards: [
      { type: 'icicle', position: { x: 0, z: 0 }, radius: 4, period: 4, damage: 70 },
    ],
    sky: { color: 0xb5cce0, fogNear: 14, fogFar: 50 },
    spawnPoints: [ { x: -4, z: 0 }, { x: 4, z: 0 } ],
    music: 'castle',
    description: { ja: '雪の舞う城壁の上。落雪と滑る床が脅威。', en: 'A snow-blasted keep rooftop where icicles fall and floors slip.' },
  },
  {
    id: 'factory',
    name: { ja: '工場ライン', en: 'Factory Line' },
    type: 'platform',
    size: { x: 26, z: 18 },
    floor: { color: 0x16161a, grid: 0xffaa33 },
    ringOut: false,
    walls: true,
    hazards: [
      { type: 'piston', position: { x: -5, z: 0 }, radius: 1.4, period: 2.2, damage: 80 },
      { type: 'piston', position: { x:  5, z: 0 }, radius: 1.4, period: 2.0, damage: 80 },
      { type: 'conveyor', position: { x: 0, z: -6 }, length: 16, width: 2, speed: 4 },
    ],
    sky: { color: 0x121419, fogNear: 22, fogFar: 70 },
    spawnPoints: [ { x: -8, z: 6 }, { x: 8, z: -6 } ],
    music: 'factory',
    description: { ja: '危険な機械が動く工場。ベルトコンベヤーとピストンに注意。', en: 'A working factory floor — beware pistons and conveyors.' },
  },
];

/** Lookup by id. */
const BY_ID = new Map(ARENAS.map(a => [a.id, a]));

export function getArena(id) {
  return BY_ID.get(id) || BY_ID.get('arena');
}

export function listArenas() {
  return ARENAS.slice();
}
