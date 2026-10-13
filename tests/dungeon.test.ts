import { describe, expect, it } from 'vitest';
import { canDescend, carryOf, createExpedition, stepExpedition } from '@/systems/combat/expedition';
import { depthScaling, floorName, floorTheme } from '@/data/dungeon';
import { generateFloor } from '@/systems/dungeon/generate';
import { isVisibleTile, parseMap } from '@/world/TileGrid';

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7919 + 13);

function reachable(rows: string[]): { all: boolean; spawnTo: (x: number, y: number) => boolean } {
  const m = parseMap(rows);
  const seen = new Set<string>([`${m.spawn.x},${m.spawn.y}`]);
  const queue = [m.spawn];
  while (queue.length > 0) {
    const c = queue.pop();
    if (c === undefined) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = `${n.x},${n.y}`;
      if (!seen.has(k) && !m.grid.isBlocked(n.x, n.y)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  let all = true;
  for (let y = 0; y < m.grid.height; y++) for (let x = 0; x < m.grid.width; x++) if (!m.grid.isBlocked(x, y) && !seen.has(`${x},${y}`)) all = false;
  return { all, spawnTo: (x, y) => seen.has(`${x},${y}`) };
}

describe('generátor poschodí', () => {
  it('je deterministický', () => {
    expect(generateFloor(42, 3).rows).toEqual(generateFloor(42, 3).rows);
    expect(generateFloor(42, 3).rows).not.toEqual(generateFloor(43, 3).rows);
    expect(generateFloor(42, 3).rows).not.toEqual(generateFloor(42, 4).rows);
  });

  it.each([1, 2, 4, 7])('hĺbka %i: 150 seedov – všetko dosiahnuteľné, výťah a schodisko viditeľné, nepriatelia ďaleko', (depth) => {
    for (const seed of SEEDS) {
      const f = generateFloor(seed, depth);
      const m = parseMap(f.rows);
      const r = reachable(f.rows);
      const id = `seed ${seed}`;
      expect(r.all, `${id}: odrezaná podlaha`).toBe(true);
      expect(m.elevators, id).toHaveLength(1);
      expect(m.stairs, id).toHaveLength(1);
      for (const e of [...m.elevators, ...m.stairs]) {
        expect(r.spawnTo(e.tx, e.ty), `${id}: nedosiahnuteľné`).toBe(true);
        expect(isVisibleTile(m.grid, e.tx, e.ty), `${id}: schované za stenou (${e.tx}, ${e.ty})`).toBe(true);
      }
      for (const l of m.lootSpots) expect(r.spawnTo(l.tx, l.ty), `${id}: korisť mimo`).toBe(true);
      for (const e of m.enemies) expect(Math.hypot(e.tx - m.spawn.x, e.ty - m.spawn.y), `${id}: nepriateľ pri štarte`).toBeGreaterThan(7);
      expect(m.enemies.length, id).toBeGreaterThan(depthScaling(depth).enemyCount * 0.6);
    }
  });

  it('schodisko je ďaleko od štartu (vo vzdialenej miestnosti)', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const m = parseMap(generateFloor(seed, 2).rows);
      const s = m.stairs[0];
      if (s === undefined) throw new Error('chýba schodisko');
      expect(Math.hypot(s.tx - m.spawn.x, s.ty - m.spawn.y)).toBeGreaterThan(8);
    }
  });
});

describe('hĺbka', () => {
  it('ťažšie a štedrejšie s hĺbkou', () => {
    const a = depthScaling(1);
    const b = depthScaling(4);
    expect(a.enemyHp).toBe(1);
    expect(b.enemyHp).toBeGreaterThan(a.enemyHp);
    expect(b.enemyDamage).toBeGreaterThan(a.enemyDamage);
    expect(b.reward).toBeGreaterThan(a.reward);
    expect(b.luck).toBeGreaterThan(a.luck);
    expect(b.enemyCount).toBeGreaterThan(a.enemyCount);
  });

  it('názvy a témy poschodí', () => {
    expect(floorName(1)).toBe('Oddelenie reklamácií');
    expect(floorName(6)).toBe('Kancelária vedenia, suterén −2');
    expect(floorTheme(1)).toBe('complaints');
    expect(floorTheme(9)).toBe('board');
  });
});

describe('hĺbka v simulácii', () => {
  const arena = parseMap(['########', '#.@a...#', '########']).grid;
  const idle = { move: { x: 0, y: 0 }, aimAt: { x: 3, y: 1 }, melee: false, ranged: false, dash: false };

  it('hlbšie: nepriatelia majú viac zdravia a udierajú silnejšie', () => {
    const top = createExpedition({ x: 2, y: 1 }, [{ kind: 'auditor', tx: 3, ty: 1 }], { depth: 1 });
    const deep = createExpedition({ x: 2, y: 1 }, [{ kind: 'auditor', tx: 3, ty: 1 }], { depth: 5 });
    expect(deep.enemies[0]?.maxHp ?? 0).toBeGreaterThan(top.enemies[0]?.maxHp ?? 0);
    const hitFor = (s: ReturnType<typeof createExpedition>): number => {
      for (let t = 0; t < 5000; t += 16) {
        const ev = stepExpedition(s, idle, 16, arena);
        const hit = ev.find((e) => e.type === 'playerHit');
        if (hit && hit.type === 'playerHit') return hit.amount;
      }
      return 0;
    };
    expect(hitFor(deep)).toBeGreaterThan(hitFor(top));
  });

  it('korisť, suroviny, zabitia a zdravie sa prenášajú na ďalšie poschodie', () => {
    const first = createExpedition({ x: 2, y: 1 }, [{ kind: 'auditor', tx: 3, ty: 1 }], { seed: 2 });
    const e = first.enemies[0];
    if (e) e.hp = 1;
    first.player.hp = 55;
    stepExpedition(first, { ...idle, melee: true }, 16, arena);
    expect(canDescend(first)).toBe(true);
    const carry = carryOf(first);
    const second = createExpedition({ x: 2, y: 1 }, [], { depth: 2, carry });
    expect(second.player.hp).toBe(55);
    expect(second.kills).toBe(1);
    expect(second.rewards).toEqual(first.rewards);
  });

  it('schodisko je zamknuté, kým žije nepriateľ', () => {
    const s = createExpedition({ x: 2, y: 1 }, [{ kind: 'auditor', tx: 6, ty: 1 }]);
    expect(canDescend(s)).toBe(false);
  });

  it('sklad: korisť leží na zemi od začiatku', () => {
    const s = createExpedition({ x: 2, y: 1 }, [], { lootSpots: [{ tx: 5, ty: 1 }], seed: 9 });
    expect(s.drops).toHaveLength(1);
    expect(s.drops[0]?.pos).toEqual({ x: 5, y: 1 });
  });

  it('odmena za zabitie rastie s hĺbkou', () => {
    const kill = (depth: number): number => {
      const s = createExpedition({ x: 2, y: 1 }, [{ kind: 'compliance', tx: 3, ty: 1 }, { kind: 'compliance', tx: 6, ty: 1 }], { depth });
      const e = s.enemies[0];
      if (e) e.hp = 1;
      stepExpedition(s, { ...idle, melee: true }, 16, arena);
      return s.rewards.souls;
    };
    expect(kill(5)).toBeGreaterThan(kill(1));
  });
});
