import { RESOURCE_IDS, type ResourceAmounts } from '@/data/resources';
import type { GameState } from '@/state/GameState';
import { tickBase } from '@/systems/base/production';

/** Najviac koľko času sa dopočíta (aby týždeň mimo hry nerozbil ekonomiku). */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
/**
 * Krok simulácie. Malé kroky sú dôležité: výrobné reťazce (podateľňa → kopírka)
 * potrebujú, aby sa vstupy priebežne dopĺňali, nie raz za osem hodín.
 */
const STEP_MS = 1000;

export interface OfflineReport {
  /** Skutočne dopočítaný čas (po orezaní na strop). */
  readonly simulatedMs: number;
  readonly capped: boolean;
  readonly produced: ResourceAmounts;
  readonly cycles: number;
}

/** Dopočíta výrobu za čas mimo hry. Mutuje `state`. */
export function applyOffline(state: GameState, elapsedMs: number): OfflineReport {
  const safe = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const simulatedMs = Math.min(safe, OFFLINE_CAP_MS);
  const before = { ...state.resources };
  let cycles = 0;
  for (let t = 0; t < simulatedMs; t += STEP_MS) cycles += tickBase(state, Math.min(STEP_MS, simulatedMs - t)).cycles.length;
  const produced: ResourceAmounts = {};
  for (const id of RESOURCE_IDS) {
    const d = Math.floor(state.resources[id]) - Math.floor(before[id]);
    if (d > 0) produced[id] = d;
  }
  return { simulatedMs, capped: safe > OFFLINE_CAP_MS, produced, cycles };
}

/** „1 h 12 min“ */
export function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
