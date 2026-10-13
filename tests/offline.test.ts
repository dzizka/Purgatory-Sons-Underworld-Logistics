import { describe, expect, it } from 'vitest';
import type { GameState, SinnerState } from '@/state/GameState';
import { MAX_LEVEL } from '@/data/careers';
import { applyOffline, formatDuration, OFFLINE_CAP_MS } from '@/systems/base/offline';
import { levelFromXp } from '@/systems/staff/sinners';

const worker = (id: string, assignedTo: string): SinnerState => ({
  id,
  name: id,
  kind: 'clerk',
  sin: '-',
  traits: [],
  look: 0,
  xp: 0,
  role: 'worker',
  fatigue: 0,
  assignedTo,
});

/** Podateľňa → kopírka, plus kávovar, aby nikto nevyhorel. */
function chainState(withCoffee = true): GameState {
  return {
    version: 1,
    timeMs: 0,
    resources: { souls: 0, forms: 0, sulfur: 0, coffee: 0 },
    buildings: [
      { id: 'b1', type: 'intake', tx: 1, ty: 1, progress: 0, status: 'idle', cyclesDone: 0 },
      { id: 'b2', type: 'copier', tx: 2, ty: 1, progress: 0, status: 'idle', cyclesDone: 0 },
      { id: 'b3', type: 'coffee', tx: 3, ty: 1, progress: 0, status: 'idle', cyclesDone: 0 },
    ],
    sinners: [worker('a', 'b1'), worker('b', 'b2'), ...(withCoffee ? [worker('c', 'b3')] : [])],
    inventory: [],
    equipment: { melee: null, ranged: null, trinket: null },
    progress: { expeditionsWon: 0, expeditionsLost: 0, kills: 0, deepestFloor: 0, bossesDefeated: 0 },
    retirees: [],
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

  it('bez kávy pracovníci vyhoria a reťazec ide zhruba na polovicu', () => {
    const rested = applyOffline(chainState(true), 60 * 60 * 1000).produced.forms ?? 0;
    const burnt = applyOffline(chainState(false), 60 * 60 * 1000).produced.forms ?? 0;
    expect(burnt).toBeLessThan(rested * 0.6);
    expect(burnt).toBeGreaterThan(rested * 0.4);
  });

  it('ani 8 hodín offline neprekročí strop úrovne', () => {
    const s = chainState();
    applyOffline(s, OFFLINE_CAP_MS);
    for (const w of s.sinners) expect(levelFromXp(w.xp)).toBeLessThanOrEqual(MAX_LEVEL);
    expect(s.sinners.some((w) => levelFromXp(w.xp) === MAX_LEVEL)).toBe(true);
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
