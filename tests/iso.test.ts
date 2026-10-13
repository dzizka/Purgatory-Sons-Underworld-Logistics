import { describe, expect, it } from 'vitest';
import { TILE_HEIGHT, TILE_WIDTH } from '@/config/constants';
import { isoDepth, screenToWorld, worldToScreen } from '@/core/iso';

describe('worldToScreen', () => {
  it('pôvod sveta je pôvod obrazovky', () => {
    expect(worldToScreen({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('krok po osi x ide doprava-dole, po osi y doľava-dole (2:1)', () => {
    expect(worldToScreen({ x: 1, y: 0 })).toEqual({ x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
    expect(worldToScreen({ x: 0, y: 1 })).toEqual({ x: -TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
  });

  it('výška z posúva bod nahor', () => {
    expect(worldToScreen({ x: 2, y: 3, z: 10 }).y).toBe(worldToScreen({ x: 2, y: 3 }).y - 10);
  });
});

describe('screenToWorld', () => {
  it.each([
    [0, 0],
    [3, 7],
    [-2.5, 4.25],
    [12.3, -0.7],
  ])('je inverzia worldToScreen pre (%f, %f)', (x, y) => {
    const back = screenToWorld(worldToScreen({ x, y }));
    expect(back.x).toBeCloseTo(x, 10);
    expect(back.y).toBeCloseTo(y, 10);
  });
});

describe('isoDepth', () => {
  it('objekt bližšie ku kamere (väčšie x + y) má väčšiu hĺbku', () => {
    expect(isoDepth({ x: 5, y: 5 })).toBeGreaterThan(isoDepth({ x: 5, y: 4 }));
    expect(isoDepth({ x: 1, y: 9 })).toBeGreaterThan(isoDepth({ x: 4, y: 5.5 }));
  });

  it('postava tesne pred stĺpom je nad ním, tesne za ním pod ním', () => {
    const pillar = isoDepth({ x: 3, y: 3 });
    expect(isoDepth({ x: 3.6, y: 3.6 })).toBeGreaterThan(pillar);
    expect(isoDepth({ x: 2.4, y: 2.4 })).toBeLessThan(pillar);
  });

  it('výška z neprebije rozdiel jednej dlaždice', () => {
    expect(isoDepth({ x: 2, y: 2, z: 500 })).toBeLessThan(isoDepth({ x: 3, y: 2 }));
  });
});
