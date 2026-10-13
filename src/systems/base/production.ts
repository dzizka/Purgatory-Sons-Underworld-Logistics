import { BUILDINGS } from '@/data/buildings';
import { canAfford, gain, spend, type ResourceAmounts } from '@/data/resources';
import type { BuildingState, GameState, SinnerState } from '@/state/GameState';
import { levelFromXp, sinnerEfficiency, xpMultiplier } from '@/systems/staff/sinners';

/** XP za každý dokončený cyklus pre každého pracovníka. */
export const WORK_XP = 5;

export interface CycleResult {
  readonly building: BuildingState;
  readonly produced: ResourceAmounts;
  readonly levelUps: readonly SinnerState[];
}

export function workersOf(state: GameState, buildingId: string): SinnerState[] {
  return state.sinners.filter((s) => s.assignedTo === buildingId);
}

/** Súčet efektivít pracovníkov = koľko „priemerných hriešnikov“ budova práve má. */
export function buildingRate(state: GameState, b: BuildingState): number {
  const workers = workersOf(state, b.id);
  return workers.reduce((sum, w) => sum + sinnerEfficiency(w, b.type, workers.filter((o) => o !== w)), 0);
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
        w.xp += (WORK_XP + (def.trainingXp ?? 0)) * xpMultiplier(w);
        if (levelFromXp(w.xp) > before) levelUps.push(w);
      }
      results.push({ building: b, produced: def.outputs, levelUps });
    }
    if (b.progress < 1) b.status = 'working';
  }
  return results;
}
