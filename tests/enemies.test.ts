import { describe, expect, it } from 'vitest';
import { ENEMIES } from '@/data/enemies';
import { createExpedition, type ExpeditionEvent, type ExpeditionInput, type ExpeditionState, stepExpedition } from '@/systems/combat/expedition';
import { generateFloor } from '@/systems/dungeon/generate';
import { parseMap } from '@/world/TileGrid';

const ARENA = parseMap([
  '##################',
  '#................#',
  '#................#',
  '#.@..............#',
  '#................#',
  '#................#',
  '##################',
]).grid;

// za stenou: projektil musí zastaviť
const WALLED = parseMap([
  '###########',
  '#....#....#',
  '#.@..#....#',
  '#....#....#',
  '###########',
]).grid;

const idle = (aimAt = { x: 10, y: 3 }): ExpeditionInput => ({ move: { x: 0, y: 0 }, aimAt, melee: false, ranged: false, dash: false });

function run(s: ExpeditionState, ms: number, input: () => ExpeditionInput = () => idle(), grid = ARENA): ExpeditionEvent[] {
  const out: ExpeditionEvent[] = [];
  for (let t = 0; t < ms && s.status === 'active'; t += 16) out.push(...stepExpedition(s, input(), 16, grid));
  return out;
}

describe('byrokratický sliz', () => {
  it('po smrti sa rozdelí na dve kópie, kópie sa už nedelia; poschodie sa vybaví až po všetkých', () => {
    const s = createExpedition({ x: 2, y: 3 }, [{ kind: 'slime', tx: 3, ty: 3 }]);
    const slime = s.enemies[0];
    if (slime === undefined) throw new Error('sliz chýba');
    slime.hp = 1;
    const ev = run(s, 100, () => ({ ...idle(slime.pos), melee: true }));
    const split = ev.find((e) => e.type === 'split');
    expect(split?.type === 'split' && split.spawned).toHaveLength(2);
    const kids = s.enemies.filter((e) => e.kind === 'slimelet');
    expect(kids).toHaveLength(2);
    expect(s.cleared).toBe(false);
    for (const k of kids) {
      k.hp = 1;
      k.invulnMs = 0;
    }
    const ev2 = run(s, 2000, () => {
      const target = s.enemies.find((e) => e.phase !== 'dead');
      if (target !== undefined) {
        s.player.pos.x = target.pos.x - 0.5;
        s.player.pos.y = target.pos.y;
      }
      return { ...idle(target?.pos ?? { x: 5, y: 3 }), melee: true };
    });
    expect(ev2.filter((e) => e.type === 'split')).toHaveLength(0);
    expect(s.cleared).toBe(true);
  });
});

describe('právnik protistrany', () => {
  it('keď je manažér príliš blízko, ustúpi', () => {
    const s = createExpedition({ x: 2, y: 3 }, [{ kind: 'counsel', tx: 3, ty: 3 }]);
    const c = s.enemies[0];
    if (c === undefined) throw new Error('právnik chýba');
    c.phase = 'chase';
    const before = Math.hypot(c.pos.x - 2, c.pos.y - 3);
    run(s, 400);
    expect(Math.hypot(c.pos.x - s.player.pos.x, c.pos.y - s.player.pos.y)).toBeGreaterThan(before);
  });

  it('na dostrel zamieri a hodí predvolanie, ktoré zraní; úskok ním prejde', () => {
    const s = createExpedition({ x: 2, y: 3 }, [{ kind: 'counsel', tx: 7, ty: 3 }]);
    const ev = run(s, 2500);
    expect(ev.some((e) => e.type === 'windup')).toBe(true);
    expect(ev.some((e) => e.type === 'enemyShot')).toBe(true);
    expect(ev.some((e) => e.type === 'playerHit')).toBe(true);
    expect(s.player.hp).toBeLessThan(s.player.maxHp);

    const dodge = createExpedition({ x: 2, y: 3 }, [{ kind: 'counsel', tx: 7, ty: 3 }]);
    for (let t = 0; t < 2500; t += 16) {
      dodge.player.invulnMs = 1000; // stále v úskoku
      stepExpedition(dodge, idle(), 16, ARENA);
    }
    expect(dodge.player.hp).toBe(dodge.player.maxHp);
  });

  it('stena predvolanie zastaví', () => {
    const s = createExpedition({ x: 2, y: 2 }, [{ kind: 'counsel', tx: 7, ty: 2 }]);
    run(s, 4000, () => idle(), WALLED);
    expect(s.player.hp).toBe(s.player.maxHp);
  });
});

describe('výskyt nových nepriateľov', () => {
  const kinds = (depth: number): Set<string> => {
    const out = new Set<string>();
    for (let seed = 0; seed < 40; seed++) for (const e of parseMap(generateFloor(seed, depth).rows).enemies) out.add(e.kind);
    return out;
  };

  it('na 1. poschodí iba audítori a compliance', () => {
    expect([...kinds(1)].sort()).toEqual(['auditor', 'compliance']);
  });

  it('od 2. poschodia slizy, od 3. aj právnici', () => {
    expect(kinds(2).has('slime')).toBe(true);
    expect(kinds(2).has('counsel')).toBe(false);
    const deep = kinds(4);
    expect(deep.has('slime')).toBe(true);
    expect(deep.has('counsel')).toBe(true);
  });

  it('kópie slizu nenesú korisť', () => {
    expect(ENEMIES.slimelet.lootChance).toBe(0);
  });
});
