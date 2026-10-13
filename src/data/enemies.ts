import type { ResourceAmounts } from '@/data/resources';

export type EnemyKind = 'auditor' | 'compliance' | 'slime' | 'slimelet' | 'counsel' | 'ceo';

/** Schopnosti bossa navyše k bežnému nápriahu a úderu. */
export interface BossDef {
  /** Každých toľko ms (keď už o manažérovi vie) zvolá poradu: privolá posily. */
  readonly summonEveryMs: number;
  readonly summonKind: Exclude<EnemyKind, 'ceo'>;
  readonly summonCount: number;
  /** Viac privolaných naraz nažive nebude – porada má kapacitu zasadačky. */
  readonly maxMinions: number;
  /** Pod týmto podielom zdravia sa rozzúri. */
  readonly enrageAt: number;
  readonly enrageSpeedMult: number;
  readonly enrageWindupMult: number;
}

export interface EnemyDef {
  readonly name: string;
  readonly flavor: string;
  readonly maxHp: number;
  /** dlaždice/s */
  readonly speed: number;
  readonly radius: number;
  readonly damage: number;
  /** Dosah úderu od okraja tela. */
  readonly reach: number;
  /** Telegrafovanie úderu – čas, kedy sa dá uskočiť. */
  readonly windupMs: number;
  readonly recoverMs: number;
  /** Vzdialenosť, z ktorej si hráča všimne. */
  readonly aggro: number;
  /** 0 = odhodenie neúčinkuje, 1 = plné. */
  readonly knockbackTaken: number;
  /** Zásah počas nápriahu ho preruší. */
  readonly staggerable: boolean;
  readonly reward: ResourceAmounts;
  /** Šanca, že po smrti nechá predmet. */
  readonly lootChance: number;
  /** Šťastie navyše pri jeho drope (boss = lepšia rarita). */
  readonly lootLuck?: number;
  readonly boss?: BossDef;
  /** Útočí na diaľku: drží si odstup a hádže projektily (namiesto úderu). */
  readonly ranged?: RangedDef;
  /** Po smrti sa rozdelí na menšie kusy. */
  readonly splitInto?: { readonly kind: EnemyKind; readonly count: number };
}

export interface RangedDef {
  /** Bližšie ako toto ustupuje, ďalej ako `preferMax` sa približuje. */
  readonly preferMin: number;
  readonly preferMax: number;
  /** Strieľa, len keď je manažér bližšie ako toto. */
  readonly range: number;
  /** dlaždice/s */
  readonly projectileSpeed: number;
  /** Ako ďaleko projektil doletí. */
  readonly projectileRange: number;
}

export const ENEMIES: Readonly<Record<EnemyKind, EnemyDef>> = {
  auditor: {
    name: 'Externý audítor',
    flavor: 'Nájde chybu. Ak žiadna nie je, vytvorí ju.',
    maxHp: 30,
    speed: 1.8,
    radius: 0.3,
    damage: 12,
    reach: 0.55,
    windupMs: 520,
    recoverMs: 650,
    aggro: 7,
    knockbackTaken: 1,
    staggerable: true,
    reward: { souls: 1 },
    lootChance: 0.2,
  },
  compliance: {
    name: 'Compliance officer',
    flavor: 'Má smernicu na všetko. Aj na vaše nadýchnutie.',
    maxHp: 70,
    speed: 1.15,
    radius: 0.36,
    damage: 24,
    reach: 0.75,
    windupMs: 800,
    recoverMs: 900,
    aggro: 6,
    knockbackTaken: 0.35,
    staggerable: false,
    reward: { souls: 2, forms: 3 },
    lootChance: 0.5,
  },
  slime: {
    name: 'Byrokratický sliz',
    flavor: 'Lepí sa na všetko. Po zásahu sa rozmnoží – v dvoch vyhotoveniach.',
    maxHp: 45,
    speed: 1.0,
    radius: 0.32,
    damage: 10,
    reach: 0.4,
    windupMs: 600,
    recoverMs: 700,
    aggro: 6,
    knockbackTaken: 0.6,
    staggerable: true,
    reward: { souls: 1, forms: 1 },
    lootChance: 0.15,
    splitInto: { kind: 'slimelet', count: 2 },
  },
  slimelet: {
    name: 'Kópia slizu',
    flavor: 'Overená kópia. Rovnako lepkavá, menej trpezlivá.',
    maxHp: 14,
    speed: 1.7,
    radius: 0.2,
    damage: 6,
    reach: 0.3,
    windupMs: 420,
    recoverMs: 500,
    aggro: 8,
    knockbackTaken: 1,
    staggerable: true,
    reward: { forms: 1 },
    lootChance: 0,
  },
  counsel: {
    name: 'Právnik protistrany',
    flavor: 'Nikdy nepríde blízko. Hádže predvolania z bezpečnej vzdialenosti.',
    maxHp: 35,
    speed: 1.5,
    radius: 0.3,
    damage: 14,
    reach: 0.4,
    windupMs: 750,
    recoverMs: 1100,
    aggro: 8,
    knockbackTaken: 1,
    staggerable: true,
    reward: { souls: 1, forms: 2 },
    lootChance: 0.3,
    ranged: { preferMin: 3, preferMax: 5.5, range: 7, projectileSpeed: 6, projectileRange: 8 },
  },
  ceo: {
    name: 'CEO',
    flavor: 'Generálny riaditeľ pekla. Nikdy nič neurobil sám – až doteraz.',
    maxHp: 260,
    speed: 1.3,
    radius: 0.45,
    damage: 30,
    reach: 0.9,
    windupMs: 950,
    recoverMs: 800,
    aggro: 8,
    knockbackTaken: 0.1,
    staggerable: false,
    reward: { souls: 15, forms: 20, sulfur: 40 },
    lootChance: 1,
    lootLuck: 3,
    boss: {
      summonEveryMs: 9000,
      summonKind: 'auditor',
      summonCount: 2,
      maxMinions: 4,
      enrageAt: 0.5,
      enrageSpeedMult: 1.4,
      enrageWindupMult: 0.7,
    },
  },
};

/** Odmena za vybavenie všetkých reklamácií na mape. */
export const CLEAR_BONUS: ResourceAmounts = { sulfur: 15, coffee: 1 };
