import { describe, expect, it } from 'vitest';
import { workerSlots } from '@/systems/base/slots';
import { parseMap, TileGrid } from '@/world/TileGrid';

describe('workerSlots', () => {
  // budova v (2,1) tesne pri stene dole a vpravo
  const { grid } = parseMap(['#####', '#...#', '#.@.#', '#####']);
  const isFree = (tx: number, ty: number): boolean => !grid.isBlocked(tx, ty) && !(tx === 2 && ty === 1);

  it('pracovník nikdy nestojí v stene', () => {
    for (const s of workerSlots(2, 1, 3, isFree)) {
      const { tx, ty } = TileGrid.tileAt(s.x, s.y);
      expect(isFree(tx, ty), `(${s.x}, ${s.y})`).toBe(true);
    }
  });

  it('uprednostní miesto pred budovou, ak je voľné', () => {
    const open = (): boolean => true;
    const [first] = workerSlots(5, 5, 1, open);
    expect(first?.x).toBeGreaterThan(5.5);
    expect(first?.y).toBeGreaterThan(5.5);
  });

  it('rôzni pracovníci dostanú rôzne miesta', () => {
    const slots = workerSlots(2, 1, 3, isFree);
    expect(new Set(slots.map((s) => `${s.x},${s.y}`)).size).toBe(3);
  });
});
