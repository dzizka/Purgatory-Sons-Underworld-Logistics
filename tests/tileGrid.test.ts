import { describe, expect, it } from 'vitest';
import { parseMap, TileGrid } from '@/world/TileGrid';

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
