import type { ResourceAmounts } from '@/data/resources';

export const BUILDING_TYPES = ['intake', 'coffee', 'copier', 'torture', 'training'] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export interface BuildingDef {
  readonly name: string;
  readonly flavor: string;
  readonly cost: ResourceAmounts;
  /** Dĺžka cyklu pri efektivite 1.0 (jeden priemerný hriešnik). */
  readonly cycleMs: number;
  readonly inputs: ResourceAmounts;
  readonly outputs: ResourceAmounts;
  /** XP pre každého pracovníka za cyklus (okrem bežných XP za prácu). */
  readonly trainingXp?: number;
  readonly maxWorkers: number;
  /** Podmienka odomknutia (bez nej je budova dostupná od začiatku). */
  readonly unlock?: { readonly expeditionsWon?: number; readonly kills?: number; readonly hint: string };
}

export const BUILDINGS: Readonly<Record<BuildingType, BuildingDef>> = {
  intake: {
    name: 'Podateľňa',
    flavor: 'Prijíma duše. Aj tie, ktoré sa nehlásili.',
    cost: { sulfur: 10 },
    cycleMs: 6000,
    inputs: {},
    outputs: { souls: 1 },
    maxWorkers: 2,
  },
  coffee: {
    name: 'Kávovar',
    flavor: 'Jediné zariadenie s vlastným odborovým zväzom.',
    cost: { sulfur: 8 },
    cycleMs: 8000,
    inputs: {},
    outputs: { coffee: 1 },
    maxWorkers: 1,
  },
  copier: {
    name: 'Kopírka utrpenia',
    flavor: 'Z jednej duše tri formuláre. Papier sa zasekáva zámerne.',
    cost: { sulfur: 15, forms: 5 },
    cycleMs: 7000,
    inputs: { souls: 1 },
    outputs: { forms: 3 },
    maxWorkers: 2,
  },
  torture: {
    name: 'Open-space mučiareň',
    flavor: 'Žiadne steny, žiadne súkromie, žiadna klimatizácia.',
    cost: { sulfur: 20, forms: 10 },
    cycleMs: 10000,
    inputs: { souls: 1, forms: 2, coffee: 1 },
    outputs: { sulfur: 6 },
    maxWorkers: 3,
    unlock: { expeditionsWon: 1, hint: 'po 1. výprave' },
  },
  training: {
    name: 'Školiaca miestnosť',
    flavor: 'Povinné školenie o povinných školeniach.',
    cost: { sulfur: 25 },
    cycleMs: 12000,
    inputs: { coffee: 1 },
    outputs: {},
    trainingXp: 15,
    maxWorkers: 3,
    unlock: { kills: 10, hint: 'po 10 zabitiach' },
  },
};
