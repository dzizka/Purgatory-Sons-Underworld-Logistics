import type { BuildingType } from '@/data/buildings';
import type { ResourceAmounts } from '@/data/resources';

/** Typy hriešnikov – na nábor sa odomykajú postupom hry. Vlastnosti (traity) sa k nim pridávajú náhodne. */
export const SINNER_KINDS = ['clerk', 'intern', 'barista', 'accountant', 'lawyer'] as const;
export type SinnerKind = (typeof SINNER_KINDS)[number];

/** Podmienka odomknutia – všetky uvedené musia platiť. */
export interface KindUnlock {
  readonly kills?: number;
  readonly expeditionsWon?: number;
  readonly deepestFloor?: number;
  readonly bossesDefeated?: number;
  readonly hint: string;
}

export interface SinnerKindDef {
  readonly name: string;
  readonly description: string;
  readonly hireCost: ResourceAmounts;
  /** Indexy do `SINNER_TEXTURES`. */
  readonly looks: readonly number[];
  readonly mult?: number;
  readonly buildingMult?: Partial<Record<BuildingType, number>>;
  /** Násobok efektivity *ostatných* pracovníkov v tej istej budove. */
  readonly auraForOthers?: number;
  readonly xpMult?: number;
  /** Násobok rýchlosti únavy (0.5 = unaví sa o polovicu pomalšie). */
  readonly fatigueMult?: number;
  readonly unlock?: KindUnlock;
}

export const SINNER_KIND_DEFS: Readonly<Record<SinnerKind, SinnerKindDef>> = {
  clerk: {
    name: 'Úradník',
    description: 'Štandardný hriešnik. Pečiatkuje, trpí, neprotestuje.',
    hireCost: { souls: 3 },
    looks: [0, 1, 2, 3],
  },
  intern: {
    name: 'Stážista',
    description: 'Lacný (1 D), robí na 70 %, ale učí sa dvojnásobne. Platí ho „skúsenosť“.',
    hireCost: { souls: 1 },
    looks: [4],
    mult: 0.7,
    xpMult: 2,
    unlock: { kills: 5, hint: 'po 5 zabitiach' },
  },
  barista: {
    name: 'Barista',
    description: 'Kávovar +80 %. Sám sa unavuje o polovicu pomalšie (pije priamo zo zdroja).',
    hireCost: { souls: 5 },
    looks: [7],
    buildingMult: { coffee: 1.8 },
    fatigueMult: 0.5,
    unlock: { expeditionsWon: 3, hint: 'po 3 výpravách' },
  },
  accountant: {
    name: 'Účtovník',
    description: 'Podateľňa a kopírka +50 %, inde −10 %. Čísla sedia, duše tiež.',
    hireCost: { souls: 6, forms: 5 },
    looks: [5],
    mult: 0.9,
    buildingMult: { intake: 1.5 / 0.9, copier: 1.5 / 0.9 },
    unlock: { deepestFloor: 3, hint: 'po návrate z 3. poschodia' },
  },
  lawyer: {
    name: 'Firemný právnik',
    description: 'Mučiareň +60 % a kolegovia v budove +10 % („všetko je v zmluve“). Drahý.',
    hireCost: { souls: 10, forms: 10, sulfur: 10 },
    looks: [6],
    buildingMult: { torture: 1.6 },
    auraForOthers: 1.1,
    unlock: { bossesDefeated: 1, hint: 'po porážke CEO' },
  },
};
