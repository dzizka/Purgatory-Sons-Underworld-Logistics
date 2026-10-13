import type { BuildingType } from '@/data/buildings';
import type { SinnerRole } from '@/data/careers';
import type { Item, ItemSlot } from '@/data/items';
import type { Resources } from '@/data/resources';
import type { TraitId } from '@/data/traits';

/** Celý stav hry – čisté dáta, serializovateľné do JSON (save vo Fáze 6). */
export interface GameState {
  readonly version: 1;
  /** Herný čas v ms od začiatku. */
  timeMs: number;
  resources: Resources;
  buildings: BuildingState[];
  sinners: SinnerState[];
  /** Sklad predmetov (aj tých, čo má manažér práve na sebe). */
  inventory: Item[];
  /** id predmetu v každom slote výbavy */
  equipment: Record<ItemSlot, string | null>;
  progress: ProgressState;
  /** Mená hriešnikov v dôchodku (dôchodkový fond = trvalý bonus výroby). */
  retirees: string[];
  rngSeed: number;
  nextId: number;
}

export type BuildingStatus = 'idle' | 'working' | 'blocked';

export interface BuildingState {
  readonly id: string;
  readonly type: BuildingType;
  readonly tx: number;
  readonly ty: number;
  /** Postup aktuálneho cyklu 0..1. */
  progress: number;
  status: BuildingStatus;
  cyclesDone: number;
}

export interface SinnerState {
  readonly id: string;
  readonly name: string;
  readonly sin: string;
  readonly traits: readonly TraitId[];
  /** Index vzhľadu (sprite sheet). */
  readonly look: number;
  xp: number;
  /** Radový pracovník, alebo vedúci budovy (nepracuje, budova je rýchlejšia). */
  role: SinnerRole;
  /** Únava 0..1; nad prahom bez kávy klesá výkon (vyhorenie). */
  fatigue: number;
  assignedTo: string | null;
}

export interface ProgressState {
  expeditionsWon: number;
  expeditionsLost: number;
  kills: number;
  /** Najhlbšie poschodie, z ktorého sa manažér vrátil živý (0 = ešte nikdy). */
  deepestFloor: number;
}
