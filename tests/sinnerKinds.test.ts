import { describe, expect, it } from 'vitest';
import { SINNER_TEXTURES } from '@/assets/manifest';
import { SINNER_KIND_DEFS, SINNER_KINDS, type SinnerKind } from '@/data/sinnerKinds';
import type { GameState, SinnerState } from '@/state/GameState';
import { createInitialState, GameStore } from '@/state/store';
import { tickFatigue } from '@/systems/base/production';
import { generateSinner, sinnerEfficiency, xpMultiplier } from '@/systems/staff/sinners';
import { Rng } from '@/core/rng';

function sinner(id: string, kind: SinnerKind): SinnerState {
  return { id, name: id, kind, sin: '-', traits: [], look: 0, xp: 0, role: 'worker', fatigue: 0, assignedTo: null };
}

function rich(progress: Partial<GameState['progress']> = {}): GameStore {
  const state = createInitialState(3);
  state.resources = { souls: 500, forms: 500, sulfur: 500, coffee: 50 };
  state.progress = { ...state.progress, ...progress };
  return new GameStore(state);
}

describe('typy hriešnikov', () => {
  it('každý typ má vzhľad, ktorý existuje, a vzhľady sa neprekrývajú', () => {
    const all = SINNER_KINDS.flatMap((k) => SINNER_KIND_DEFS[k].looks);
    expect(new Set(all).size).toBe(all.length);
    for (const l of all) expect(SINNER_TEXTURES[l]).toBeDefined();
  });

  it('generátor dá typu jeho vzhľad', () => {
    for (const k of SINNER_KINDS) {
      for (let seed = 0; seed < 20; seed++) {
        const s = generateSinner(new Rng(seed), 'x', k);
        expect(s.kind).toBe(k);
        expect(SINNER_KIND_DEFS[k].looks).toContain(s.look);
      }
    }
  });

  it('špecializácie merateľne menia výkon', () => {
    expect(sinnerEfficiency(sinner('a', 'accountant'), 'copier', [])).toBeCloseTo(1.5);
    expect(sinnerEfficiency(sinner('a', 'accountant'), 'coffee', [])).toBeCloseTo(0.9);
    expect(sinnerEfficiency(sinner('b', 'barista'), 'coffee', [])).toBeCloseTo(1.8);
    expect(sinnerEfficiency(sinner('l', 'lawyer'), 'torture', [])).toBeCloseTo(1.6);
    expect(sinnerEfficiency(sinner('c', 'clerk'), 'torture', [sinner('l', 'lawyer')])).toBeCloseTo(1.1);
    expect(sinnerEfficiency(sinner('i', 'intern'), 'intake', [])).toBeCloseTo(0.7);
    expect(xpMultiplier(sinner('i', 'intern'))).toBe(2);
  });

  it('barista sa unavuje o polovicu pomalšie', () => {
    const st = rich();
    st.state.resources.coffee = 0;
    st.build('coffee', 1, 1);
    st.build('intake', 2, 1);
    const b = sinner('b', 'barista');
    const c = sinner('c', 'clerk');
    st.state.sinners = [b, c];
    st.assign('b', st.buildingAt(1, 1)?.id ?? '');
    st.assign('c', st.buildingAt(2, 1)?.id ?? '');
    tickFatigue(st.state, 30_000);
    expect(b.fatigue).toBeCloseTo(c.fatigue / 2);
  });
});

describe('odomykanie a nábor', () => {
  it('na začiatku iba úradník; ďalšie typy podľa postupu', () => {
    const st = rich();
    expect(SINNER_KINDS.filter((k) => st.isKindUnlocked(k))).toEqual(['clerk']);
    expect(st.hire('intern').ok).toBe(false);
    const all = rich({ kills: 99, expeditionsWon: 9, deepestFloor: 9, bossesDefeated: 1 });
    expect(SINNER_KINDS.every((k) => all.isKindUnlocked(k))).toBe(true);
  });

  it('nábor stojí cenu typu a vytvorí hriešnika daného typu', () => {
    const st = rich({ bossesDefeated: 1 });
    const before = { ...st.state.resources };
    expect(st.hire('lawyer').ok).toBe(true);
    const s = st.state.sinners[st.state.sinners.length - 1];
    expect(s?.kind).toBe('lawyer');
    const cost = SINNER_KIND_DEFS.lawyer.hireCost;
    expect(st.state.resources.souls).toBe(before.souls - (cost.souls ?? 0));
    expect(st.state.resources.sulfur).toBe(before.sulfur - (cost.sulfur ?? 0));
  });

  it('porážka CEO sa zapíše len pri živom návrate a odomkne právnika s hláškou', () => {
    const st = rich();
    const notices: string[] = [];
    st.events.on('notice', (n) => notices.push(n.text));
    st.recordExpedition(false, 0, 5, 1);
    expect(st.state.progress.bossesDefeated).toBe(0);
    st.recordExpedition(true, 0, 5, 1);
    expect(st.state.progress.bossesDefeated).toBe(1);
    expect(st.isKindUnlocked('lawyer')).toBe(true);
    expect(notices.some((t) => t.includes('Firemný právnik'))).toBe(true);
  });
});
