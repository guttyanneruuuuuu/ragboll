// ============================================================
// arenas/index.js — Factory that maps presets to builders.
// ============================================================

import { NeonArena }    from './neon.js';
import { RingOutArena } from './ringout.js';
import { HazardArena }  from './hazard.js';
import { MeadowArena }  from './meadow.js';
import { CastleArena }  from './castle.js';
import { FactoryArena } from './factory.js';

export function createArena(preset, world, scene) {
  let arena;
  switch (preset.id) {
    case 'ringout': arena = new RingOutArena(preset, world, scene); break;
    case 'hazard':  arena = new HazardArena(preset, world, scene); break;
    case 'meadow':  arena = new MeadowArena(preset, world, scene); break;
    case 'castle':  arena = new CastleArena(preset, world, scene); break;
    case 'factory': arena = new FactoryArena(preset, world, scene); break;
    case 'arena':
    default:        arena = new NeonArena(preset, world, scene); break;
  }
  arena.build();
  return arena;
}

export { NeonArena, RingOutArena, HazardArena, MeadowArena, CastleArena, FactoryArena };
