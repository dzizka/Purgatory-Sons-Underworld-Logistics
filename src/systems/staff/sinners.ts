import type { Rng } from '@/core/rng';
import type { BuildingType } from '@/data/buildings';
import { BURNOUT_MIN_MULT, COFFEE_BREAK_AT, MAX_LEVEL, PENSION_BONUS, PENSION_MAX } from '@/data/careers';
import { FIRST_NAMES, SINS, SURNAME_INITIALS } from '@/data/names';
import { TRAIT_IDS, TRAITS } from '@/data/traits';
import type { SinnerState } from '@/state/GameState';

/** Počet rôznych vzhľadov hriešnikov (sprite sheetov). */
export const SINNER_LOOKS = 4;

export function generateSinner(rng: Rng, id: string): SinnerState {
  const traitCount = rng.chance(0.35) ? 2 : 1;
  return {
    id,
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(SURNAME_INITIALS)}`,
    sin: rng.pick(SINS),
    traits: rng.sample(TRAIT_IDS, traitCount),
    look: rng.int(0, SINNER_LOOKS - 1),
    xp: 0,
    role: 'worker',
    fatigue: 0,
    assignedTo: null,
  };
}

/** XP potrebné na danú úroveň: 2 = 20, 3 = 80, 4 = 180 … */
export function xpForLevel(level: number): number {
  return 20 * (level - 1) ** 2;
}

/** XP na strope – viac sa nezbiera. */
export const MAX_XP = xpForLevel(MAX_LEVEL);

/** Úroveň z XP: 0 XP = 1, 20 = 2, 80 = 3, 180 = 4 … najviac `MAX_LEVEL`. */
export function levelFromXp(xp: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 20)));
}

export function isMaxLevel(s: SinnerState): boolean {
  return levelFromXp(s.xp) >= MAX_LEVEL;
}

/** +10 % za každú úroveň nad prvú. */
export function levelBonus(level: number): number {
  return 1 + 0.1 * (level - 1);
}

/** Násobok výkonu z únavy: do prahu kávovej prestávky 1, potom lineárne až na `BURNOUT_MIN_MULT`. */
export function burnoutMult(fatigue: number): number {
  const f = Math.min(1, Math.max(0, fatigue));
  if (f <= COFFEE_BREAK_AT) return 1;
  return 1 - ((f - COFFEE_BREAK_AT) / (1 - COFFEE_BREAK_AT)) * (1 - BURNOUT_MIN_MULT);
}

/** Bonus dôchodkového fondu pre celú výrobu. */
export function pensionMult(retirees: number): number {
  return 1 + PENSION_BONUS * Math.min(PENSION_MAX, Math.max(0, retirees));
}

/**
 * Efektivita hriešnika v budove (1.0 = priemer).
 * `coworkers` sú ostatní pracovníci tej istej budovy (bez neho).
 */
export function sinnerEfficiency(s: SinnerState, building: BuildingType, coworkers: readonly SinnerState[]): number {
  let e = levelBonus(levelFromXp(s.xp)) * burnoutMult(s.fatigue);
  for (const id of s.traits) {
    const t = TRAITS[id];
    e *= t.mult ?? 1;
    e *= t.buildingMult?.[building] ?? 1;
    e *= coworkers.length === 0 ? (t.aloneMult ?? 1) : (t.crowdMult ?? 1);
  }
  for (const c of coworkers) for (const id of c.traits) e *= TRAITS[id].auraForOthers ?? 1;
  return e;
}

export function xpMultiplier(s: SinnerState): number {
  return s.traits.reduce((m, id) => m * (TRAITS[id].xpMult ?? 1), 1);
}
