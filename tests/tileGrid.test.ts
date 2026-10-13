import { describe, expect, it } from 'vitest';
import { BASE_ELEVATOR_ARRIVAL, PROCESSING_OFFICE } from '@/world/maps';
import { isVisibleTile, parseMap, TileGrid, tileVariant } from '@/world/TileGrid';

const MAP = ['####', '#@P#', '#.D#', '####'];

describe('parseMap', () => {
  it('nájde spawn, rozmery a rekvizity', () => {
    const m = parseMap(MAP);
    expect(m.spawn).toEqual({ x: 1, y: 1 });
    expect(m.grid.width).toBe(4);
    expect(m.grid.height).toBe(4);
    expect(m.props.filter((p) => p.kind === 'wall')).toHaveLength(12);
    expect(m.props).toContainEqual({ kind: 'pillar', tx: 2, ty: 1 });
    expect(m.props).toContainEqual({ kind: 'desk', tx: 2, ty: 2 });
  });

  it('kratšie riadky doplní prázdnom', () => {
    const m = parseMap(['#@#', '#']);
    expect(m.grid.get(2, 1)).toBe('void');
  });

  it('odmietne mapu bez spawnu a neznáme znaky', () => {
    expect(() => parseMap(['###'])).toThrow(/spawn/);
    expect(() => parseMap(['#@?'])).toThrow(/neznámy znak/);
    expect(parseMap(['#@vL#']).stairs).toEqual([{ tx: 2, ty: 0 }]);
    expect(parseMap(['#@vL#']).lootSpots).toEqual([{ tx: 3, ty: 0 }]);
  });
});

describe('TileGrid', () => {
  const { grid } = parseMap(MAP);

  it('podlaha je priechodná, steny a nábytok nie', () => {
    expect(grid.isBlocked(1, 1)).toBe(false);
    expect(grid.isBlocked(1, 2)).toBe(false);
    expect(grid.isBlocked(0, 0)).toBe(true);
    expect(grid.isBlocked(2, 1)).toBe(true);
    expect(grid.isBlocked(2, 2)).toBe(true);
  });

  it('mimo mapy je všetko nepriechodné', () => {
    expect(grid.isBlocked(-1, 1)).toBe(true);
    expect(grid.isBlocked(99, 1)).toBe(true);
    expect(grid.get(1.5, 1)).toBe('void');
  });

  it('tileAt zaokrúhľuje na stred dlaždice', () => {
    expect(TileGrid.tileAt(1.49, 2.51)).toEqual({ tx: 1, ty: 3 });
  });
});

describe('tileVariant', () => {
  it('je deterministický a v rozsahu', () => {
    for (let i = 0; i < 200; i++) {
      const v = tileVariant(i % 17, Math.floor(i / 17), 4);
      expect(v).toBe(tileVariant(i % 17, Math.floor(i / 17), 4));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }
  });

  it('použije všetky varianty (žiadna viditeľná šachovnica)', () => {
    const seen = new Set<number>();
    for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) seen.add(tileVariant(x, y, 4));
    expect(seen.size).toBe(4);
  });

  it('jeden variant = vždy 0', () => {
    expect(tileVariant(5, 9, 1)).toBe(0);
  });
});

describe('parseMap – expedičné značky', () => {
  it('nájde výťahy a nepriateľov; obe sú priechodné', () => {
    const m = parseMap(['#####', '#@aX#', '#c..#', '#####']);
    expect(m.elevators).toEqual([{ tx: 3, ty: 1 }]);
    expect(m.enemies).toEqual([
      { kind: 'auditor', tx: 2, ty: 1 },
      { kind: 'compliance', tx: 1, ty: 2 },
    ]);
    expect(m.grid.isBlocked(3, 1)).toBe(false);
    expect(m.grid.get(2, 1)).toBe('floor');
    expect(m.grid.get(3, 1)).toBe('elevator');
  });
});

describe('herné mapy', () => {
  it.each([['PROCESSING_OFFICE', PROCESSING_OFFICE]])('%s: každá priechodná dlaždica je dosiahnuteľná zo spawnu a výťah existuje', (_name, rows) => {
    const m = parseMap(rows);
    expect(m.elevators.length).toBeGreaterThan(0);
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
    for (let y = 0; y < m.grid.height; y++)
      for (let x = 0; x < m.grid.width; x++)
        if (!m.grid.isBlocked(x, y)) expect(seen.has(`${x},${y}`), `(${x}, ${y}) je odrezaná`).toBe(true);
  });

  it.each([['PROCESSING_OFFICE', PROCESSING_OFFICE]])('%s: výťah nie je schovaný za stenou', (_name, rows) => {
    const m = parseMap(rows);
    for (const e of m.elevators) expect(isVisibleTile(m.grid, e.tx, e.ty), `výťah (${e.tx}, ${e.ty})`).toBe(true);
  });

  it('isVisibleTile: stena „pred“ dlaždicou ju zakryje, stena za ňou nie', () => {
    const { grid } = parseMap(['######', '#@...#', '#....#', '#.#..#', '######']);
    expect(isVisibleTile(grid, 1, 1)).toBe(true); // steny sú iba za ňou
    expect(isVisibleTile(grid, 1, 2)).toBe(false); // stĺp (2,3) je pred ňou
    expect(isVisibleTile(grid, 4, 3)).toBe(false); // pravá stena
  });

  it('návrat z expedície pristane na priechodnej dlaždici', () => {
    const { grid } = parseMap(PROCESSING_OFFICE);
    expect(grid.isBlocked(BASE_ELEVATOR_ARRIVAL.x, BASE_ELEVATOR_ARRIVAL.y)).toBe(false);
  });
});

describe('dekorácie kancelárie', () => {
  it('stoja na podlahe, nie v ceste k výťahu ani na miestach v čakárni', async () => {
    const { BASE_DECOR, BASE_ELEVATOR_ARRIVAL, LOUNGE_SPOTS, PROCESSING_OFFICE } = await import('@/world/maps');
    const m = parseMap(PROCESSING_OFFICE);
    const keys = new Set(BASE_DECOR.map((d) => `${d.tx},${d.ty}`));
    expect(keys.size).toBe(BASE_DECOR.length);
    for (const d of BASE_DECOR) {
      expect(m.grid.get(d.tx, d.ty), `${d.kind} (${d.tx}, ${d.ty})`).toBe('floor');
      expect(Math.hypot(d.tx - m.spawn.x, d.ty - m.spawn.y)).toBeGreaterThan(1.5);
    }
    for (const e of m.elevators) expect(keys.has(`${e.tx},${e.ty}`)).toBe(false);
    expect(keys.has(`${BASE_ELEVATOR_ARRIVAL.x},${BASE_ELEVATOR_ARRIVAL.y}`)).toBe(false);
    for (const s of LOUNGE_SPOTS) expect(keys.has(`${Math.round(s.x)},${Math.round(s.y)}`)).toBe(false);
  });
});
