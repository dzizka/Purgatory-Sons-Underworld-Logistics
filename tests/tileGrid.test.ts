import { describe, expect, it } from 'vitest';
import { parseMap, TileGrid, tileVariant } from '@/world/TileGrid';

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
    expect(() => parseMap(['#@X'])).toThrow(/neznámy znak/);
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
