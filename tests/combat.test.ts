import { describe, expect, it } from 'vitest';
import { CLEAR_BONUS, ENEMIES } from '@/data/enemies';
import { PLAYER } from '@/data/player';
import { WEAPONS } from '@/data/weapons';
import { applyHit, inArc, type Fighter } from '@/systems/combat/combat';
import {
  createExpedition,
  type ExpeditionEvent,
  type ExpeditionInput,
  type ExpeditionState,
  leaveExpedition,
  stepExpedition,
} from '@/systems/combat/expedition';
import { parseMap } from '@/world/TileGrid';

// otvorená aréna 14×7 so stenami okolo
const ARENA = parseMap([
  '##############',
  '#............#',
  '#............#',
  '#.@..........#',
  '#............#',
  '#............#',
  '##############',
]).grid;

const idle = (aimAt = { x: 10, y: 3 }): ExpeditionInput => ({ move: { x: 0, y: 0 }, aimAt, melee: false, ranged: false, dash: false });

/** Odsimuluje `ms` po 16 ms krokoch, vráti všetky udalosti. */
function run(s: ExpeditionState, ms: number, input: (t: number) => ExpeditionInput = () => idle()): ExpeditionEvent[] {
  const out: ExpeditionEvent[] = [];
  for (let t = 0; t < ms; t += 16) out.push(...stepExpedition(s, input(t), 16, ARENA));
  return out;
}

const types = (ev: ExpeditionEvent[]): string[] => ev.map((e) => e.type);

describe('combat primitívy', () => {
  it('inArc: pred útočníkom áno, za ním nie, mimo dosahu nie', () => {
    const o = { x: 0, y: 0 };
    const aim = { x: 1, y: 0 };
    expect(inArc(o, aim, 1, Math.PI / 3, { x: 0.9, y: 0 }, 0.2)).toBe(true);
    expect(inArc(o, aim, 1, Math.PI / 3, { x: -0.9, y: 0 }, 0.2)).toBe(false);
    expect(inArc(o, aim, 1, Math.PI / 3, { x: 2, y: 0 }, 0.2)).toBe(false);
    expect(inArc(o, aim, 1, Math.PI / 3, { x: 0.1, y: 0.1 }, 0.3)).toBe(true); // prekrytie
  });

  it('applyHit rešpektuje nezraniteľnosť a odhadzuje smerom od útočníka', () => {
    const f: Fighter = { pos: { x: 1, y: 0 }, hp: 10, maxHp: 10, radius: 0.3, invulnMs: 0, knock: { x: 0, y: 0 } };
    expect(applyHit(f, 4, { x: 0, y: 0 }, 2, 100)).toBe(true);
    expect(f.hp).toBe(6);
    expect(f.knock.x).toBeGreaterThan(0);
    expect(applyHit(f, 4, { x: 0, y: 0 }, 2, 100)).toBe(false);
    expect(f.hp).toBe(6);
  });
});

describe('expedícia – hráč', () => {
  it('dierovačka zabije audítora na 3 zásahy a pripíše odmenu', () => {
    const s = createExpedition({ x: 3, y: 3 }, [{ kind: 'auditor', tx: 4, ty: 3 }]);
    const hits = Math.ceil(ENEMIES.auditor.maxHp / WEAPONS.puncher.damage);
    expect(hits).toBe(3);
    // stále drží útok a mieri na nepriateľa
    const ev = run(s, 3000, () => ({ ...idle(s.enemies[0]?.pos ?? { x: 4, y: 3 }), melee: true }));
    expect(types(ev).filter((t) => t === 'enemyKilled')).toHaveLength(1);
    expect(s.kills).toBe(1);
    expect(s.rewards.souls).toBe(ENEMIES.auditor.reward.souls);
  });

  it('úder mimo výseku nezasiahne', () => {
    const s = createExpedition({ x: 3, y: 3 }, [{ kind: 'compliance', tx: 4, ty: 3 }]);
    const ev = stepExpedition(s, { ...idle({ x: 1, y: 3 }), melee: true }, 16, ARENA);
    expect(types(ev)).toContain('swing');
    expect(types(ev)).not.toContain('enemyHit');
  });

  it('sponka letí, zasiahne nepriateľa a zmizne; o stenu sa zastaví', () => {
    const s = createExpedition({ x: 3, y: 3 }, [{ kind: 'compliance', tx: 8, ty: 3 }]);
    let ev = run(s, 50, () => ({ ...idle({ x: 8, y: 3 }), ranged: true }));
    expect(types(ev)).toContain('shot');
    ev = run(s, 1000);
    expect(types(ev)).toContain('enemyHit');
    expect(s.projectiles).toHaveLength(0);

    const wall = createExpedition({ x: 3, y: 3 }, []);
    run(wall, 16, () => ({ ...idle({ x: 3, y: 0 }), ranged: true }));
    expect(types(run(wall, 600))).toContain('projectileGone');
    expect(wall.projectiles).toHaveLength(0);
  });

  it('úskok je rýchlejší než chôdza a dáva nezraniteľnosť', () => {
    const walk = createExpedition({ x: 3, y: 3 }, []);
    const dash = createExpedition({ x: 3, y: 3 }, []);
    const right = { x: 1, y: 0 };
    run(walk, PLAYER.dash.durationMs, () => ({ ...idle(), move: right }));
    stepExpedition(dash, { ...idle(), move: right, dash: true }, 16, ARENA);
    expect(dash.player.invulnMs).toBeGreaterThan(0);
    run(dash, PLAYER.dash.durationMs - 16, () => ({ ...idle(), move: right }));
    const moved = (s: ExpeditionState): number => Math.hypot(s.player.pos.x - 3, s.player.pos.y - 3);
    expect(moved(dash)).toBeGreaterThan(moved(walk) * 2);
  });
});

describe('expedícia – nepriatelia', () => {
  it('audítor si hráča všimne, dobehne, telegrafuje úder a až potom udrie', () => {
    const s = createExpedition({ x: 3, y: 3 }, [{ kind: 'auditor', tx: 8, ty: 3 }]);
    const ev = run(s, 5000);
    const t = types(ev);
    const windup = t.indexOf('windup');
    const hit = t.indexOf('playerHit');
    expect(windup).toBeGreaterThanOrEqual(0);
    expect(hit).toBeGreaterThan(windup);
    expect(s.player.hp).toBeLessThan(PLAYER.maxHp);
  });

  it('úskok počas nápriahu = žiadne zranenie', () => {
    const s = createExpedition({ x: 3, y: 3 }, [{ kind: 'compliance', tx: 4, ty: 3 }]);
    let dashed = false;
    const ev: ExpeditionEvent[] = [];
    for (let t = 0; t < 3000; t += 16) {
      const e = s.enemies[0];
      const dodge = e?.phase === 'windup' && e.phaseMs < 150 && !dashed;
      if (dodge) dashed = true;
      ev.push(...stepExpedition(s, { ...idle(), move: { x: -1, y: 0 }, dash: dodge }, 16, ARENA));
      if (dashed && types(ev).includes('enemyStrike')) break;
    }
    expect(dashed).toBe(true);
    expect(types(ev)).toContain('enemyStrike');
    expect(types(ev)).not.toContain('playerHit');
  });

  it('nepriatelia za hranicou aggra stoja', () => {
    const s = createExpedition({ x: 1, y: 1 }, [{ kind: 'compliance', tx: 12, ty: 5 }]);
    run(s, 2000);
    expect(s.enemies[0]?.phase).toBe('idle');
  });

  it('nepriatelia sa nestohujú do jedného bodu', () => {
    const spawns = Array.from({ length: 6 }, () => ({ kind: 'auditor' as const, tx: 10, ty: 3 }));
    const s = createExpedition({ x: 3, y: 3 }, spawns);
    run(s, 1500);
    const ps = s.enemies.map((e) => e.pos);
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        if (a && b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.3);
      }
  });
});

describe('expedícia – priebeh', () => {
  it('vybavenie všetkých nepriateľov = cleared + bonus', () => {
    const s = createExpedition({ x: 3, y: 3 }, [{ kind: 'auditor', tx: 4, ty: 3 }]);
    const e = s.enemies[0];
    if (e) e.hp = 1;
    const ev = stepExpedition(s, { ...idle({ x: 4, y: 3 }), melee: true }, 16, ARENA);
    expect(types(ev)).toContain('cleared');
    expect(s.rewards.sulfur).toBe(CLEAR_BONUS.sulfur);
    expect(s.status).toBe('active');
    leaveExpedition(s);
    expect(s.status).toBe('won');
  });

  it('smrť hráča ukončí expedíciu', () => {
    const s = createExpedition({ x: 3, y: 3 }, [{ kind: 'compliance', tx: 4, ty: 3 }]);
    s.player.hp = 1;
    const ev = run(s, 4000);
    expect(types(ev)).toContain('playerDied');
    expect(s.status).toBe('lost');
    expect(stepExpedition(s, idle(), 16, ARENA)).toEqual([]);
  });

  it('výkon: 60 nepriateľov × 600 krokov', () => {
    const spawns = Array.from({ length: 60 }, (_, i) => ({ kind: 'auditor' as const, tx: 1 + (i % 12), ty: 1 + Math.floor(i / 12) }));
    const s = createExpedition({ x: 6, y: 3 }, spawns);
    s.player.hp = 1e9; // nech prežije celé meranie
    const t0 = performance.now();
    run(s, 600 * 16);
    const perStep = (performance.now() - t0) / 600;
    // 60 FPS = 16,6 ms na snímku; simulácia musí byť zlomok
    expect(perStep).toBeLessThan(4);
  });
});
