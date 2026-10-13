import { BUILDINGS } from '@/data/buildings';
import { COFFEE_BREAK_AT, FATIGUE_MS, LEAD_BONUS, RECOVER_MS } from '@/data/careers';
import { canAfford, gain, spend, type ResourceAmounts } from '@/data/resources';
import type { BuildingState, GameState, SinnerState } from '@/state/GameState';
import { fatigueMultiplier, levelFromXp, MAX_XP, pensionMult, sinnerEfficiency, xpMultiplier } from '@/systems/staff/sinners';

/** XP za každý dokončený cyklus pre každého pracovníka. */
export const WORK_XP = 5;

export interface CycleResult {
  readonly building: BuildingState;
  readonly produced: ResourceAmounts;
  readonly levelUps: readonly SinnerState[];
}

export interface FatigueResult {
  /** Koľko šálok sa vypilo. */
  readonly coffeeBreaks: number;
  /** Kto si práve dal kávu (pre animáciu prestávky). */
  readonly drinkers: readonly SinnerState[];
  /** Kto práve dosiahol 100 % únavy. */
  readonly burnedOut: readonly SinnerState[];
}

export interface BaseTickResult {
  readonly cycles: readonly CycleResult[];
  readonly fatigue: FatigueResult;
}

/** Radoví pracovníci budovy (bez vedúceho). */
export function workersOf(state: GameState, buildingId: string): SinnerState[] {
  return state.sinners.filter((s) => s.assignedTo === buildingId && s.role === 'worker');
}

export function leadOf(state: GameState, buildingId: string): SinnerState | undefined {
  return state.sinners.find((s) => s.assignedTo === buildingId && s.role === 'lead');
}

/**
 * Koľko „priemerných hriešnikov“ budova práve má: súčet efektivít pracovníkov,
 * × vedúci, × dôchodkový fond. Vedúci bez pracovníkov nevyrobí nič.
 */
export function buildingRate(state: GameState, b: BuildingState): number {
  const workers = workersOf(state, b.id);
  const sum = workers.reduce((acc, w) => acc + sinnerEfficiency(w, b.type, workers.filter((o) => o !== w)), 0);
  const lead = leadOf(state, b.id) === undefined ? 1 : LEAD_BONUS;
  return sum * lead * pensionMult(state.retirees.length);
}

/**
 * Únava: pracovníci sa unavujú, nad prahom si dajú kávu zo skladu (ak je), inak vyhoria.
 * V čakárni (a vedúci, ktorí len delegujú) sa zotavujú. Mutuje `state`.
 */
export function tickFatigue(state: GameState, dtMs: number): FatigueResult {
  let coffeeBreaks = 0;
  const burnedOut: SinnerState[] = [];
  const drinkers: SinnerState[] = [];
  const buildingIds = new Set(state.buildings.map((b) => b.id));
  for (const s of state.sinners) {
    const working = s.role === 'worker' && s.assignedTo !== null && buildingIds.has(s.assignedTo);
    if (!working) {
      s.fatigue = Math.max(0, s.fatigue - dtMs / RECOVER_MS);
      continue;
    }
    const before = s.fatigue;
    s.fatigue = Math.min(1, s.fatigue + (dtMs / FATIGUE_MS) * fatigueMultiplier(s));
    if (s.fatigue >= COFFEE_BREAK_AT && state.resources.coffee >= 1) {
      state.resources.coffee -= 1;
      s.fatigue = 0;
      coffeeBreaks += 1;
      drinkers.push(s);
    } else if (before < 1 && s.fatigue >= 1) {
      burnedOut.push(s);
    }
  }
  return { coffeeBreaks, burnedOut, drinkers };
}

/**
 * Posunie produkciu o `dtMs`. Mutuje `state`, vráti dokončené cykly.
 * Zvláda aj veľké `dt` (viac cyklov naraz) – pripravené na offline progres.
 */
export function tickProduction(state: GameState, dtMs: number): CycleResult[] {
  const results: CycleResult[] = [];
  state.timeMs += dtMs;

  for (const b of state.buildings) {
    const def = BUILDINGS[b.type];
    const workers = workersOf(state, b.id);
    if (workers.length === 0) {
      b.status = 'idle';
      continue;
    }
    b.progress += (dtMs / def.cycleMs) * buildingRate(state, b);

    while (b.progress >= 1) {
      if (!canAfford(state.resources, def.inputs)) {
        b.progress = 1;
        b.status = 'blocked';
        break;
      }
      spend(state.resources, def.inputs);
      gain(state.resources, def.outputs);
      b.progress -= 1;
      b.cyclesDone += 1;

      const levelUps: SinnerState[] = [];
      for (const w of workers) {
        const before = levelFromXp(w.xp);
        w.xp = Math.min(MAX_XP, w.xp + (WORK_XP + (def.trainingXp ?? 0)) * xpMultiplier(w));
        if (levelFromXp(w.xp) > before) levelUps.push(w);
      }
      results.push({ building: b, produced: def.outputs, levelUps });
    }
    if (b.progress < 1) b.status = 'working';
  }
  return results;
}

/** Jeden krok základne: najprv únava a kávové prestávky, potom výroba. */
export function tickBase(state: GameState, dtMs: number): BaseTickResult {
  const fatigue = tickFatigue(state, dtMs);
  return { fatigue, cycles: tickProduction(state, dtMs) };
}
