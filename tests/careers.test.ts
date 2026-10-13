import { describe, expect, it } from 'vitest';
import { COFFEE_BREAK_AT, FATIGUE_MS, LEAD_BONUS, MAX_LEVEL, PENSION_MAX } from '@/data/careers';
import type { GameState, SinnerState } from '@/state/GameState';
import { GameStore } from '@/state/store';
import { buildingRate, tickFatigue } from '@/systems/base/production';
import { burnoutMult, levelFromXp, MAX_XP, pensionMult, sinnerEfficiency } from '@/systems/staff/sinners';

function sinner(id: string, xp = 0, extra: Partial<SinnerState> = {}): SinnerState {
  return { id, name: id, kind: 'clerk', sin: '-', traits: [], look: 0, xp, role: 'worker', fatigue: 0, assignedTo: null, ...extra };
}

function store(sinners: SinnerState[], coffee = 50): GameStore {
  const state: GameState = {
    version: 1,
    timeMs: 0,
    resources: { souls: 50, forms: 50, sulfur: 500, coffee },
    buildings: [],
    sinners,
    inventory: [],
    equipment: { melee: null, ranged: null, trinket: null },
    progress: { expeditionsWon: 99, expeditionsLost: 0, kills: 999, deepestFloor: 0, bossesDefeated: 0 },
    retirees: [],
    rngSeed: 1,
    nextId: 100,
  };
  return new GameStore(state);
}

function intake(st: GameStore, x = 0): string {
  expect(st.build('intake', x, 0).ok).toBe(true);
  return st.buildingAt(x, 0)?.id ?? '';
}

describe('strop úrovne', () => {
  it(`úroveň nikdy neprekročí ${MAX_LEVEL} a XP sa ďalej nezbierajú`, () => {
    expect(levelFromXp(MAX_XP)).toBe(MAX_LEVEL);
    expect(levelFromXp(1e9)).toBe(MAX_LEVEL);
    const st = store([sinner('a', MAX_XP - 1)]);
    const b = intake(st);
    st.assign('a', b);
    const notices: string[] = [];
    st.events.on('notice', (n) => notices.push(n.text));
    st.tick(60_000);
    expect(st.sinner('a')?.xp).toBe(MAX_XP);
    expect(notices.some((t) => t.includes('strop'))).toBe(true);
  });
});

describe('vedúci', () => {
  it('povýšiť sa dá len na strope; vedúci nepracuje, ale budova ide o 25 % rýchlejšie', () => {
    const st = store([sinner('a'), sinner('boss', MAX_XP)]);
    const b = intake(st);
    st.assign('a', b);
    const building = st.building(b);
    if (building === undefined) throw new Error('budova chýba');
    expect(st.promote('a').ok).toBe(false);
    const base = buildingRate(st.state, building);
    expect(st.promote('boss').ok).toBe(true);
    expect(st.assign('boss', b).ok).toBe(true);
    expect(buildingRate(st.state, building)).toBeCloseTo(base * LEAD_BONUS);
  });

  it('vedúci nezaberá miesto pracovníka, ale v budove môže byť len jeden', () => {
    const st = store([sinner('w1'), sinner('w2'), sinner('l1', MAX_XP), sinner('l2', MAX_XP)]);
    const b = intake(st);
    st.promote('l1');
    st.promote('l2');
    expect(st.assign('w1', b).ok).toBe(true);
    expect(st.assign('w2', b).ok).toBe(true); // podateľňa má 2 miesta
    expect(st.assign('l1', b).ok).toBe(true);
    expect(st.assign('l2', b).ok).toBe(false);
  });

  it('vedúci bez pracovníkov nevyrobí nič', () => {
    const st = store([sinner('l', MAX_XP)]);
    const b = intake(st);
    st.promote('l');
    st.assign('l', b);
    const souls = st.state.resources.souls;
    st.tick(60_000);
    expect(st.state.resources.souls).toBe(souls);
  });

  it('povýšenie v budove, ktorá už vedúceho má, pošle nového do čakárne', () => {
    const st = store([sinner('l1', MAX_XP), sinner('l2', MAX_XP)]);
    const b = intake(st);
    st.promote('l1');
    st.assign('l1', b);
    st.assign('l2', b);
    expect(st.promote('l2').ok).toBe(true);
    expect(st.sinner('l2')?.assignedTo).toBeNull();
  });
});

describe('dôchodok', () => {
  it('odíde z personálu a celá výroba je trvalo rýchlejšia, najviac do stropu fondu', () => {
    const st = store([sinner('a'), sinner('old', MAX_XP)]);
    const b = intake(st);
    st.assign('a', b);
    st.assign('old', b);
    const building = st.building(b);
    if (building === undefined) throw new Error('budova chýba');
    expect(st.retire('a').ok).toBe(false);
    expect(st.retire('old').ok).toBe(true);
    expect(st.sinner('old')).toBeUndefined();
    expect(st.state.retirees).toEqual(['old']);
    expect(buildingRate(st.state, building)).toBeCloseTo(sinnerEfficiency(sinner('a'), 'intake', []) * pensionMult(1));
    expect(pensionMult(PENSION_MAX + 5)).toBe(pensionMult(PENSION_MAX));
  });
});

describe('vyhorenie', () => {
  it('únava nad prahom znižuje výkon až na polovicu', () => {
    expect(burnoutMult(0)).toBe(1);
    expect(burnoutMult(COFFEE_BREAK_AT)).toBe(1);
    expect(burnoutMult(1)).toBeCloseTo(0.5);
  });

  it('s kávou si pracovník dá prestávku, bez nej vyhorí; v čakárni sa zotaví', () => {
    const st = store([sinner('a'), sinner('idle', 0, { fatigue: 1 })], 1);
    const b = intake(st);
    st.assign('a', b);
    const r1 = tickFatigue(st.state, FATIGUE_MS * COFFEE_BREAK_AT);
    expect(r1.coffeeBreaks).toBe(1);
    expect(st.state.resources.coffee).toBe(0);
    expect(st.sinner('a')?.fatigue).toBe(0);
    const r2 = tickFatigue(st.state, FATIGUE_MS);
    expect(r2.burnedOut.map((s) => s.id)).toEqual(['a']);
    expect(st.sinner('idle')?.fatigue).toBe(0);
  });

  it('vyhorenie ohlási varovanie', () => {
    const st = store([sinner('a')], 0);
    st.assign('a', intake(st));
    const warns: string[] = [];
    st.events.on('notice', (n) => n.tone === 'warn' && warns.push(n.text));
    st.tick(FATIGUE_MS);
    expect(warns.some((t) => t.includes('vyhorel'))).toBe(true);
  });
});
