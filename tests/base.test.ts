import { describe, expect, it } from 'vitest';
import type { TraitId } from '@/data/traits';
import type { GameState, SinnerState } from '@/state/GameState';
import { createInitialState, GameStore, HIRE_COST } from '@/state/store';
import { tickProduction } from '@/systems/base/production';
import { generateSinner, levelFromXp, sinnerEfficiency } from '@/systems/staff/sinners';
import { Rng } from '@/core/rng';

function sinner(id: string, traits: TraitId[] = [], xp = 0): SinnerState {
  return { id, name: id, sin: '-', traits, look: 0, xp, assignedTo: null };
}

/** Prázdny stav s danými hriešnikmi a dostatkom surovín. */
function freshStore(sinners: SinnerState[] = []): GameStore {
  const state: GameState = {
    version: 1,
    timeMs: 0,
    resources: { souls: 50, forms: 50, sulfur: 500, coffee: 50 },
    buildings: [],
    sinners,
    rngSeed: 1,
    nextId: 100,
  };
  return new GameStore(state);
}

function buildAndStaff(store: GameStore, type: Parameters<GameStore['build']>[0], workerIds: string[]): string {
  expect(store.build(type, 0, 0).ok).toBe(true);
  const b = store.buildingAt(0, 0);
  if (b === undefined) throw new Error('budova chýba');
  for (const id of workerIds) expect(store.assign(id, b.id).ok).toBe(true);
  return b.id;
}

describe('produkcia', () => {
  it('budova bez pracovníkov nič nevyrobí', () => {
    const store = freshStore();
    store.build('intake', 0, 0);
    const before = store.state.resources.souls;
    store.tick(60_000);
    expect(store.state.resources.souls).toBe(before);
    expect(store.buildingAt(0, 0)?.status).toBe('idle');
  });

  it('podateľňa s jedným priemerným pracovníkom vyrobí 1 dušu za 6 s', () => {
    const store = freshStore([sinner('a')]);
    buildAndStaff(store, 'intake', ['a']);
    const before = store.state.resources.souls;
    store.tick(5_999);
    expect(store.state.resources.souls).toBe(before);
    store.tick(1);
    expect(store.state.resources.souls).toBe(before + 1);
  });

  it('veľké dt spracuje viac cyklov naraz (offline progres)', () => {
    const store = freshStore([sinner('a')]);
    buildAndStaff(store, 'intake', ['a']);
    const before = store.state.resources.souls;
    store.tick(60_000);
    expect(store.state.resources.souls).toBe(before + 10);
  });

  it('bez vstupov sa budova zablokuje a nič nespotrebuje', () => {
    const store = freshStore([sinner('a')]);
    buildAndStaff(store, 'copier', ['a']);
    store.state.resources.souls = 0;
    const forms = store.state.resources.forms;
    store.tick(20_000);
    const b = store.buildingAt(0, 0);
    expect(b?.status).toBe('blocked');
    expect(store.state.resources.forms).toBe(forms);
    store.state.resources.souls = 1;
    store.tick(1);
    expect(store.state.resources.forms).toBe(forms + 3);
    expect(store.state.resources.souls).toBe(0);
  });

  it('dvaja pracovníci pracujú dvakrát rýchlejšie', () => {
    const store = freshStore([sinner('a'), sinner('b')]);
    buildAndStaff(store, 'intake', ['a', 'b']);
    const before = store.state.resources.souls;
    store.tick(6_000);
    expect(store.state.resources.souls).toBe(before + 2);
  });

  it('školiaca miestnosť dáva XP navyše a míňa kávu', () => {
    const store = freshStore([sinner('a')]);
    buildAndStaff(store, 'training', ['a']);
    const coffee = store.state.resources.coffee;
    store.tick(12_000);
    expect(store.sinner('a')?.xp).toBe(20);
    expect(store.state.resources.coffee).toBe(coffee - 1);
  });

  it('dosiahnutie úrovne vyvolá levelUp event', () => {
    const store = freshStore([sinner('a', [], 19)]);
    buildAndStaff(store, 'intake', ['a']);
    const ups: string[] = [];
    store.events.on('levelUp', (s) => ups.push(s.id));
    store.tick(6_000);
    expect(ups).toEqual(['a']);
  });
});

describe('vlastnosti hriešnikov', () => {
  const eff = (traits: TraitId[], building: Parameters<typeof sinnerEfficiency>[1] = 'intake', coworkers: SinnerState[] = []) =>
    sinnerEfficiency(sinner('x', traits), building, coworkers);

  it('workoholik je rýchlejší, prokrastinátor pomalší', () => {
    expect(eff(['workaholic'])).toBeCloseTo(1.3);
    expect(eff(['procrastinator'])).toBeCloseTo(0.6);
  });

  it('„Odpovedá všetkým“ exceluje v kopírke, inde zaostáva', () => {
    expect(eff(['reply_all'], 'copier')).toBeCloseTo(1.4);
    expect(eff(['reply_all'], 'intake')).toBeCloseTo(0.9);
  });

  it('závislý na káve v kávovare kávu vypije', () => {
    expect(eff(['caffeine'], 'coffee')).toBeCloseTo(0.5);
    expect(eff(['caffeine'], 'torture')).toBeCloseTo(1.2);
  });

  it('introvert: sám lepší, v kolektíve horší', () => {
    expect(eff(['introvert'])).toBeCloseTo(1.25);
    expect(eff(['introvert'], 'intake', [sinner('y')])).toBeCloseTo(0.85);
  });

  it('mikromanažér zrýchli kolegov, vegán ich spomalí', () => {
    expect(eff([], 'intake', [sinner('m', ['micromanager'])])).toBeCloseTo(1.15);
    expect(eff([], 'intake', [sinner('v', ['vegan'])])).toBeCloseTo(0.95);
  });

  it('úroveň zvyšuje výkon o 10 % za level', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(20)).toBe(2);
    expect(levelFromXp(80)).toBe(3);
    expect(sinnerEfficiency(sinner('x', [], 80), 'intake', [])).toBeCloseTo(1.2);
  });

  it('vlastnosti merateľne menia produkciu v hre', () => {
    const fast = freshStore([sinner('a', ['workaholic'])]);
    const slow = freshStore([sinner('a', ['procrastinator'])]);
    buildAndStaff(fast, 'intake', ['a']);
    buildAndStaff(slow, 'intake', ['a']);
    fast.tick(60_000);
    slow.tick(60_000);
    expect(fast.state.resources.souls - 50).toBe(13);
    expect(slow.state.resources.souls - 50).toBe(6);
  });
});

describe('generátor hriešnikov', () => {
  it('je deterministický a dáva 1–2 rôzne vlastnosti', () => {
    const a = generateSinner(new Rng(9), 's1');
    const b = generateSinner(new Rng(9), 's1');
    expect(a).toEqual(b);
    for (let seed = 0; seed < 50; seed++) {
      const s = generateSinner(new Rng(seed), 'x');
      expect(s.traits.length).toBeGreaterThanOrEqual(1);
      expect(s.traits.length).toBeLessThanOrEqual(2);
      expect(new Set(s.traits).size).toBe(s.traits.length);
    }
  });
});

describe('GameStore príkazy', () => {
  it('stavba stojí suroviny; bez rozpočtu zlyhá', () => {
    const store = freshStore();
    store.state.resources.sulfur = 10;
    expect(store.build('intake', 1, 1).ok).toBe(true);
    expect(store.state.resources.sulfur).toBe(0);
    const r = store.build('coffee', 2, 2);
    expect(r.ok).toBe(false);
    expect(store.state.buildings).toHaveLength(1);
  });

  it('na obsadené miesto sa stavať nedá', () => {
    const store = freshStore();
    store.build('intake', 1, 1);
    expect(store.build('coffee', 1, 1).ok).toBe(false);
  });

  it('nábor stojí duše a pridá hriešnika s unikátnym id', () => {
    const store = freshStore();
    const souls = store.state.resources.souls;
    expect(store.hire().ok).toBe(true);
    expect(store.hire().ok).toBe(true);
    expect(store.state.resources.souls).toBe(souls - 2 * HIRE_COST.souls);
    expect(new Set(store.state.sinners.map((s) => s.id)).size).toBe(2);
  });

  it('kapacita budovy sa dodržiava, preradenie a uvoľnenie funguje', () => {
    const store = freshStore([sinner('a'), sinner('b'), sinner('c')]);
    store.build('coffee', 0, 0);
    store.build('intake', 1, 0);
    const coffee = store.buildingAt(0, 0)?.id ?? '';
    const intake = store.buildingAt(1, 0)?.id ?? '';
    expect(store.assign('a', coffee).ok).toBe(true);
    expect(store.assign('b', coffee).ok).toBe(false);
    expect(store.assign('a', intake).ok).toBe(true);
    expect(store.assign('b', coffee).ok).toBe(true);
    expect(store.assign('a', null).ok).toBe(true);
    expect(store.sinner('a')?.assignedTo).toBeNull();
  });

  it('počiatočný stav má 2 hriešnikov a je deterministický', () => {
    expect(createInitialState(5)).toEqual(createInitialState(5));
    expect(createInitialState(5).sinners).toHaveLength(2);
  });

  it('tickProduction posúva herný čas', () => {
    const s = createInitialState(1);
    tickProduction(s, 1234);
    expect(s.timeMs).toBe(1234);
  });
});

describe('GameStore.grant', () => {
  it('pripíše suroviny a ohlási zmenu', () => {
    const store = freshStore();
    let calls = 0;
    store.events.on('resourcesChanged', () => calls++);
    store.grant({ souls: 2, sulfur: 15 });
    expect(store.state.resources.souls).toBe(52);
    expect(store.state.resources.sulfur).toBe(515);
    expect(calls).toBe(1);
  });
});
