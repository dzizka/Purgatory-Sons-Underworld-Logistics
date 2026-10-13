import { describe, expect, it } from 'vitest';
import type { GameState, SinnerState } from '@/state/GameState';
import { applyOffline, formatDuration, OFFLINE_CAP_MS } from '@/systems/base/offline';

const worker = (id: string, assignedTo: string): SinnerState => ({ id, name: id, sin: '-', traits: [], look: 0, xp: 0, assignedTo });

function chainState(): GameState {
  return {
    version: 1,
    timeMs: 0,
    resources: { souls: 0, forms: 0, sulfur: 0, coffee: 0 },
    buildings: [
      { id: 'b1', type: 'intake', tx: 1, ty: 1, progress: 0, status: 'idle', cyclesDone: 0 },
      { id: 'b2', type: 'copier', tx: 2, ty: 1, progress: 0, status: 'idle', cyclesDone: 0 },
    ],
    sinners: [worker('a', 'b1'), worker('b', 'b2')],
    inventory: [],
    equipment: { melee: null, ranged: null, trinket: null },
    progress: { expeditionsWon: 0, expeditionsLost: 0, kills: 0, deepestFloor: 0 },
    rngSeed: 1,
    nextId: 10,
  };
}

describe('offline progres', () => {
  it('za hodinu vyrobí podateľňa duše a kopírka z nich formuláre (reťazec funguje)', () => {
    const s = chainState();
    const r = applyOffline(s, 60 * 60 * 1000);
    // podateľňa: 1 duša / 6 s = 600 duší; kopírka: 1 duša → 3 F za 7 s ≈ 514 cyklov
    expect(r.produced.forms).toBeGreaterThan(1400);
    expect(s.resources.souls).toBeGreaterThan(0);
    expect(r.capped).toBe(false);
    expect(r.cycles).toBeGreaterThan(1000);
  });

  it('strop 8 hodín', () => {
    const s = chainState();
    const r = applyOffline(s, 30 * 24 * 60 * 60 * 1000);
    expect(r.simulatedMs).toBe(OFFLINE_CAP_MS);
    expect(r.capped).toBe(true);
  });

  it('záporný alebo nezmyselný čas (posunuté hodiny) nič nespraví', () => {
    for (const bad of [-5000, Number.NaN, Number.POSITIVE_INFINITY]) {
      const s = chainState();
      const r = applyOffline(s, bad);
      expect(r.simulatedMs).toBe(0);
      expect(s.resources.souls).toBe(0);
    }
  });

  it('formatDuration', () => {
    expect(formatDuration(5 * 60_000)).toBe('5 min');
    expect(formatDuration(60 * 60_000)).toBe('1 h');
    expect(formatDuration(72 * 60_000)).toBe('1 h 12 min');
  });
});
