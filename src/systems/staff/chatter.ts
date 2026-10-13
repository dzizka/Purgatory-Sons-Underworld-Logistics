import type { Rng } from '@/core/rng';
import type { BuildingType } from '@/data/buildings';
import { COFFEE_BREAK_AT } from '@/data/careers';
import {
  CHATTER_BUILDING,
  CHATTER_IDLE,
  CHATTER_KIND,
  CHATTER_LEAD,
  CHATTER_MAX_LEVEL,
  CHATTER_TIRED,
  CHATTER_TRAIT,
  CHATTER_WORKING,
  OFFICE_EVENTS,
  type OfficeEvent,
} from '@/data/chatter';
import type { SinnerState } from '@/state/GameState';
import { isMaxLevel } from '@/systems/staff/sinners';

/**
 * Čo hriešnik práve povie. Kontext určuje bazén replík; osobnosť (vlastnosti, typ) má
 * prednosť asi v tretine prípadov, aby sa postavy líšili.
 */
export function pickChatter(s: SinnerState, building: BuildingType | null, rng: Rng): string {
  if (s.fatigue > COFFEE_BREAK_AT + 0.15 && rng.chance(0.7)) return rng.pick(CHATTER_TIRED);
  const personal = [...s.traits.flatMap((t) => CHATTER_TRAIT[t] ?? []), ...(CHATTER_KIND[s.kind] ?? [])];
  if (personal.length > 0 && rng.chance(0.35)) return rng.pick(personal);
  if (s.role === 'lead') return rng.pick(CHATTER_LEAD);
  if (isMaxLevel(s) && rng.chance(0.4)) return rng.pick(CHATTER_MAX_LEVEL);
  if (building === null) return rng.pick(CHATTER_IDLE);
  const specific = CHATTER_BUILDING[building] ?? [];
  return rng.pick(specific.length > 0 && rng.chance(0.5) ? specific : CHATTER_WORKING);
}

/** Náhodná kancelárska udalosť, ktorá dáva zmysel pre postavené budovy. */
export function pickOfficeEvent(built: ReadonlySet<BuildingType>, rng: Rng, lastId: string | null): OfficeEvent {
  const pool = OFFICE_EVENTS.filter((e) => (e.needs === undefined || built.has(e.needs)) && e.id !== lastId);
  return rng.pick(pool.length > 0 ? pool : OFFICE_EVENTS);
}
