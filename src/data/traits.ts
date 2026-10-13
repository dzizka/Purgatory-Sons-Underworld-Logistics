import type { BuildingType } from '@/data/buildings';

export const TRAIT_IDS = [
  'workaholic',
  'procrastinator',
  'micromanager',
  'reply_all',
  'bureaucrat',
  'introvert',
  'caffeine',
  'vegan',
] as const;
export type TraitId = (typeof TRAIT_IDS)[number];

export interface TraitDef {
  readonly name: string;
  readonly description: string;
  /** Násobok vlastnej efektivity všade. */
  readonly mult?: number;
  /** Násobok vlastnej efektivity v konkrétnych budovách. */
  readonly buildingMult?: Partial<Record<BuildingType, number>>;
  /** Násobok, keď v budove pracuje sám / s ostatnými. */
  readonly aloneMult?: number;
  readonly crowdMult?: number;
  /** Násobok efektivity *ostatných* pracovníkov v tej istej budove. */
  readonly auraForOthers?: number;
  readonly xpMult?: number;
}

export const TRAITS: Readonly<Record<TraitId, TraitDef>> = {
  workaholic: { name: 'Workoholik', description: 'Pracuje aj po smrti. Hlavne po smrti. +30 % výkon.', mult: 1.3 },
  procrastinator: {
    name: 'Prokrastinátor',
    description: 'Začne zajtra. −40 % výkon, ale z každej výhovorky sa poučí (+50 % XP).',
    mult: 0.6,
    xpMult: 1.5,
  },
  micromanager: {
    name: 'Mikromanažér',
    description: 'Sám robí menej (−20 %), ale kolegov sleduje tak, že zrýchlia (+15 %).',
    mult: 0.8,
    auraForOthers: 1.15,
  },
  reply_all: {
    name: 'Odpovedá všetkým',
    description: 'Rodený na kopírku (+40 %). Inde otravuje (−10 %).',
    mult: 0.9,
    buildingMult: { copier: 1.4 / 0.9 },
  },
  bureaucrat: { name: 'Rodený byrokrat', description: 'Pečiatka je predĺžená ruka. +30 % v podateľni a kopírke.', buildingMult: { intake: 1.3, copier: 1.3 } },
  introvert: { name: 'Introvert', description: 'Sám +25 %, v kolektíve −15 %.', aloneMult: 1.25, crowdMult: 0.85 },
  caffeine: {
    name: 'Závislý na káve',
    description: 'Všade +20 %. V kávovare −50 %, lebo to vypije.',
    mult: 1.2,
    buildingMult: { coffee: 0.5 / 1.2 },
  },
  vegan: { name: 'Vegán v pekle', description: 'Neustále to spomína. −5 % všetkým okolo.', auraForOthers: 0.95 },
};
