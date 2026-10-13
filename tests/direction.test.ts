import { describe, expect, it } from 'vitest';
import { facingFromScreen, facingRow } from '@/systems/movement/direction';

describe('facingFromScreen', () => {
  it.each([
    [0, 1, 'S'],
    [1, 1, 'SE'],
    [1, 0, 'E'],
    [1, -1, 'NE'],
    [0, -1, 'N'],
    [-1, -1, 'NW'],
    [-1, 0, 'W'],
    [-1, 1, 'SW'],
  ] as const)('(%i, %i) → %s', (dx, dy, expected) => {
    expect(facingFromScreen(dx, dy)).toBe(expected);
  });

  it('bez vstupu nemá smer', () => {
    expect(facingFromScreen(0, 0)).toBeNull();
  });

  it('poradie riadkov zodpovedá sheetu Puny Characters (S=0, E=2, N=4, W=6)', () => {
    expect([facingRow('S'), facingRow('E'), facingRow('N'), facingRow('W')]).toEqual([0, 2, 4, 6]);
  });
});
