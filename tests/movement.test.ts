import { describe, expect, it } from 'vitest';
import { worldToScreen } from '@/core/iso';
import { collides, inputToWorldVelocity, moveWithCollision } from '@/systems/movement/movement';
import { parseMap } from '@/world/TileGrid';

const { grid } = parseMap([
  '#######',
  '#.....#',
  '#..P..#',
  '#..@..#',
  '#######',
]);

describe('inputToWorldVelocity', () => {
  it('žiadny vstup = žiadny pohyb', () => {
    expect(inputToWorldVelocity(0, 0, 100)).toEqual({ x: 0, y: 0 });
  });

  it('„hore“ na obrazovke ide v izometrii po diagonále (-x, -y)', () => {
    const v = inputToWorldVelocity(0, -1, 100);
    expect(v.x).toBeLessThan(0);
    expect(v.x).toBeCloseTo(v.y, 10);
  });

  it('„doprava“ na obrazovke = (+x, -y)', () => {
    const v = inputToWorldVelocity(1, 0, 100);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeCloseTo(-v.x, 10);
  });

  it.each([
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
  ])('obrazovková rýchlosť je rovnaká vo všetkých smeroch (%i, %i)', (dx, dy) => {
    const v = inputToWorldVelocity(dx, dy, 100);
    const s = worldToScreen(v);
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(100, 6);
  });
});

describe('collides', () => {
  it('voľný stred dlaždice nekoliduje', () => {
    expect(collides(grid, 3, 3, 0.3)).toBe(false);
  });

  it('kruh zasahujúci do stĺpu koliduje', () => {
    expect(collides(grid, 3, 2.75, 0.3)).toBe(true);
  });

  it('dotyk rohu bez prekrytia nekoliduje', () => {
    // roh stĺpu je v (3.5, 2.5); bod je od neho vzdialený viac ako polomer
    expect(collides(grid, 3.75, 2.75, 0.3)).toBe(false);
  });
});

describe('moveWithCollision', () => {
  it('voľný pohyb prejde celý', () => {
    const p = moveWithCollision(grid, { x: 1, y: 1 }, { x: 1, y: 0 }, 0.3);
    expect(p.x).toBeCloseTo(2, 10);
    expect(p.y).toBe(1);
  });

  it('zastaví sa pred stenou', () => {
    const p = moveWithCollision(grid, { x: 4, y: 1 }, { x: 5, y: 0 }, 0.3);
    expect(p.x).toBeLessThanOrEqual(5.5 - 0.3);
    expect(p.x).toBeGreaterThan(5);
  });

  it('veľký krok (nízke FPS) neprepadne cez stenu', () => {
    const p = moveWithCollision(grid, { x: 1, y: 1 }, { x: 0, y: 50 }, 0.3);
    expect(p.y).toBeLessThan(3.5);
  });

  it('pri diagonálnom náraze do steny sa šmýka popri nej', () => {
    const p = moveWithCollision(grid, { x: 2, y: 1 }, { x: 1, y: -1 }, 0.3);
    expect(p.x).toBeCloseTo(3, 10);
    expect(p.y).toBeLessThan(1);
    expect(p.y).toBeGreaterThanOrEqual(0.5 + 0.3 - 1e-9);
  });
});
