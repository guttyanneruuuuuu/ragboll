// ============================================================
// combat.js — Adjudicates swing-vs-ragdoll collisions.
//
// The combat layer is intentionally decoupled from the renderer
// so we can run it deterministically inside the replay system.
// It produces a stream of high-level events ("hit", "parry",
// "fatality", "ringout") that the UI / audio / FX layers can
// subscribe to.
// ============================================================

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { clamp, lerp, hitForce } from '../util/math.js';
import { bus, Channels } from '../util/events.js';
import { logger } from '../util/logger.js';
import { distToSegmentSq2D } from '../util/spatial.js';

const log = logger('combat');

/**
 * Settings shared across the entire combat module.
 */
const TUNING = Object.freeze({
  HIT_COOLDOWN_MS: 220,
  MIN_TIP_SPEED:   3.0,
  PARRY_WINDOW_MS: 160,
  GUARD_REDUCTION: 0.55,
  CRIT_MULT:       2.0,
  FATALITY_HP_FRACTION: 0.0,
  RING_OUT_Y:      -3.5,
});

export class CombatSystem {
  constructor({ world, scene, players, arena, settings, replay = null }) {
    this.world = world;
    this.scene = scene;
    this.players = players;       // [Ragdoll, Ragdoll, ...]
    this.arena = arena;
    this.settings = settings;
    this.replay = replay;
    this.events = [];
    this._lastHit = new Map();    // sword -> { time }
    this._lastGuard = new Map();  // ragdoll -> { time }
    this._lastSwingAt = new Map();// ragdoll -> ms
    this._parryWindows = new WeakMap();
    this.stats = new Map(players.map(p => [p, {
      damageDealt: 0,
      damageTaken: 0,
      jointsBroken: 0,
      parries: 0,
      dodges: 0,
      hits: 0,
      maxCombo: 0,
      currentCombo: 0,
      lastHitAt: 0,
      lowHp: 1,
    }]));
  }

  /** Mark a player as guarding (within the parry window). */
  setGuarding(ragdoll, guarding) {
    if (guarding) {
      this._lastGuard.set(ragdoll, performance.now());
    } else {
      this._lastGuard.delete(ragdoll);
    }
  }

  /** Mark a player as having just swung — opens a parry window. */
  registerSwing(ragdoll, swingInfo) {
    this._lastSwingAt.set(ragdoll, performance.now());
    bus.emit(Channels.COMBAT_SWING, { ragdoll, swing: swingInfo });
    if (this.replay) this.replay.record({ t: performance.now(), type: 'swing', player: ragdoll.name, swing: swingInfo });
  }

  /** Run hit detection over all combinations of (sword, ragdoll). */
  step(dt) {
    void dt;
    for (const attacker of this.players) {
      if (!attacker.sword || attacker.sword.dropped) continue;
      for (const target of this.players) {
        if (target === attacker) continue;
        if (target.defeated) continue;
        this._tryHit(attacker, target);
      }
    }
    this._checkRingOut();
    this._checkHazards();
    this._decayCombos();
  }

  _tryHit(attacker, target) {
    const sword = attacker.sword;
    const tipVel = sword.tipVelocity();
    const speed  = Math.hypot(tipVel.x, tipVel.y, tipVel.z);
    if (speed < TUNING.MIN_TIP_SPEED) return;
    const tip  = sword.tipPosition();
    const base = sword.basePosition();
    let bestHit = null;
    let bestDist = Infinity;
    for (const [bodyKey, body] of target.bodies) {
      const px = body.position.x, py = body.position.y, pz = body.position.z;
      const dx = px - tip.x;
      const dy = py - tip.y;
      const dz = pz - tip.z;
      const dSq = dx*dx + dy*dy + dz*dz;
      const radius = (this._bodyRadius(body) + 0.18);
      if (dSq <= radius * radius) {
        if (dSq < bestDist) {
          bestDist = dSq;
          bestHit = { bodyKey, body };
        }
        continue;
      }
      // segment test for fast swings
      const segSq = distToSegmentSq2D(px, pz, tip.x, tip.z, base.x, base.z);
      if (segSq <= radius * radius && Math.abs(py - tip.y) < radius + 0.4) {
        if (segSq < bestDist) {
          bestDist = segSq;
          bestHit = { bodyKey, body };
        }
      }
    }
    if (!bestHit) return;
    this._applyHit(attacker, target, bestHit.bodyKey, bestHit.body, speed, tip);
  }

  _bodyRadius(body) {
    let r = 0.2;
    if (body.shapes && body.shapes.length) {
      const s = body.shapes[0];
      if (s.radius) r = s.radius;
      else if (s.halfExtents) r = (s.halfExtents.x + s.halfExtents.y + s.halfExtents.z) / 3;
    }
    return r;
  }

  _applyHit(attacker, target, bodyKey, body, tipSpeed, tipPos) {
    const sword = attacker.sword;
    const lastInfo = this._lastHit.get(sword);
    const now = performance.now();
    if (lastInfo && now - lastInfo.time < TUNING.HIT_COOLDOWN_MS) return;

    const stats = this.stats.get(attacker);
    const targetStats = this.stats.get(target);

    // parry check
    const guardTs = this._lastGuard.get(target);
    if (guardTs && now - guardTs < TUNING.PARRY_WINDOW_MS) {
      this._registerParry(target, attacker);
      this._lastHit.set(sword, { time: now });
      return;
    }
    // pure guard (not within the parry window but still raising)
    let damageMultiplier = 1;
    let isGuard = false;
    if (guardTs) {
      damageMultiplier *= (1 - TUNING.GUARD_REDUCTION);
      isGuard = true;
      // chance to bypass guard based on weapon profile
      if (Math.random() < sword.guardBreak) {
        damageMultiplier = 1; // ignore guard
        isGuard = false;
        bus.emit(Channels.UI_FLASH, { type: 'guard-break', target });
      }
    }

    // crit check
    const isCrit = Math.random() < sword.crit;
    if (isCrit) damageMultiplier *= TUNING.CRIT_MULT;

    // headshot bonus
    if (bodyKey === 'head') damageMultiplier *= 1.4;

    // joint-break multiplier
    damageMultiplier *= sword.jointBreak;

    const baseDamage = clamp(tipSpeed * 1.4, 8, 80) * (sword.swingForceScale || 1);
    const damage = baseDamage * damageMultiplier;
    const dealt = target.damageBodyKey(bodyKey, damage);

    stats.damageDealt += dealt;
    targetStats.damageTaken += dealt;
    stats.hits += 1;
    stats.currentCombo += 1;
    stats.lastHitAt = now;
    if (stats.currentCombo > stats.maxCombo) stats.maxCombo = stats.currentCombo;
    targetStats.currentCombo = 0;

    const force = hitForce(tipSpeed, sword.mass, Math.random);
    const dir = { x: tipPos.x - body.position.x, y: 0.2, z: tipPos.z - body.position.z };
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    dir.x = -dir.x / len * 8;
    dir.y = 6 * force;
    dir.z = -dir.z / len * 8;
    target.applyHitImpulse(bodyKey, dir, tipPos);

    // joint locking event
    if (target.lockedJoints.size > 0) {
      stats.jointsBroken = target.lockedJoints.size;
    }

    const hpFrac = target.hpFraction();
    targetStats.lowHp = Math.min(targetStats.lowHp, hpFrac);

    this._lastHit.set(sword, { time: now });
    const event = {
      t: now,
      type: 'hit',
      attacker: attacker.name,
      target:   target.name,
      bodyKey,
      damage:   dealt,
      tipSpeed,
      crit:     isCrit,
      guarded:  isGuard,
      tip:      { x: tipPos.x, y: tipPos.y, z: tipPos.z },
      category: sword.weapon.category,
      impact:   tipSpeed * sword.mass / 10,
    };
    this.events.push(event);
    bus.emit(Channels.COMBAT_HIT, event);
    if (this.replay) this.replay.record(event);

    // bleed: delayed extra damage
    if (sword.bleed > 0) {
      setTimeout(() => {
        if (!target.defeated) {
          const extra = target.damageBodyKey(bodyKey, 10);
          stats.damageDealt += extra;
        }
      }, sword.bleed);
    }

    if (hpFrac <= TUNING.FATALITY_HP_FRACTION || target.isKnockedOut()) {
      this._defeat(target, attacker, 'fatality');
    }
  }

  _registerParry(defender, attacker) {
    const stats = this.stats.get(defender);
    stats.parries += 1;
    const evt = { t: performance.now(), type: 'parry', attacker: attacker.name, defender: defender.name };
    this.events.push(evt);
    bus.emit(Channels.COMBAT_PARRY, evt);
    if (this.replay) this.replay.record(evt);
    // ranged riposte: shove the attacker's sword away
    if (attacker.sword) {
      attacker.sword.body.applyImpulse(
        new CANNON.Vec3((Math.random() - 0.5) * 4, 6, (Math.random() - 0.5) * 4),
        new CANNON.Vec3(0, 0, 0),
      );
    }
  }

  _decayCombos() {
    const now = performance.now();
    for (const stats of this.stats.values()) {
      if (stats.currentCombo > 0 && now - stats.lastHitAt > 1500) {
        stats.currentCombo = 0;
      }
    }
  }

  _checkRingOut() {
    if (!this.arena?.preset?.ringOut) return;
    const killBelow = this.arena.preset.pit?.killBelow ?? -3;
    for (const player of this.players) {
      if (player.defeated) continue;
      const com = player.centerOfMass();
      if (com.y < killBelow) {
        this._defeat(player, this._lastAttackerOf(player), 'ringout');
      }
    }
  }

  _checkHazards() {
    if (!this.arena) return;
    const hazards = this.arena.activeHazards();
    if (!hazards || !hazards.length) return;
    const now = performance.now();
    for (const player of this.players) {
      if (player.defeated) continue;
      const com = player.centerOfMass();
      for (const h of hazards) {
        const dx = com.x - h.position.x;
        const dz = com.z - h.position.z;
        const dSq = dx*dx + dz*dz;
        if (dSq <= (h.radius || 1) * (h.radius || 1)) {
          if (!player._lastHazardAt || now - player._lastHazardAt > 600) {
            player._lastHazardAt = now;
            const dmg = h.damage || 60;
            // spread damage across all joints
            for (const key of player.jointHealth.keys()) {
              player.damageJoint(key, dmg / 6);
            }
            const evt = { t: now, type: 'hazard', target: player.name, hazard: h.type, damage: dmg };
            this.events.push(evt);
            bus.emit(Channels.COMBAT_HAZARD, evt);
            if (this.replay) this.replay.record(evt);
            if (player.isKnockedOut()) this._defeat(player, this._lastAttackerOf(player), 'hazard');
          }
        }
      }
    }
  }

  _lastAttackerOf(player) {
    let best = null;
    let bestT = 0;
    for (const ev of this.events) {
      if (ev.type === 'hit' && ev.target === player.name && ev.t > bestT) {
        bestT = ev.t;
        best = this.players.find(p => p.name === ev.attacker);
      }
    }
    return best;
  }

  _defeat(target, attacker, mode) {
    if (target.defeated) return;
    target.defeated = true;
    const evt = {
      t: performance.now(),
      type: 'defeat',
      target: target.name,
      attacker: attacker?.name ?? '—',
      mode,
    };
    this.events.push(evt);
    bus.emit(Channels.COMBAT_DEATH, evt);
    if (this.replay) this.replay.record(evt);
    if (mode === 'fatality')   bus.emit(Channels.COMBAT_FATALITY, evt);
    if (mode === 'ringout')    bus.emit(Channels.COMBAT_RING_OUT, evt);
    log.info('Defeat', target.name, 'by', attacker?.name, mode);
  }

  /** Generate the per-player summary used by the result screen. */
  summarize(self) {
    const stats = this.stats.get(self);
    return {
      damageDealt: stats.damageDealt,
      damageTaken: stats.damageTaken,
      jointsBroken: stats.jointsBroken,
      parries: stats.parries,
      dodges: stats.dodges,
      hits: stats.hits,
      maxCombo: stats.maxCombo,
      lowHp: stats.lowHp,
    };
  }
}
