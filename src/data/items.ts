/**
 * Predmety: základy (zbrane a talizmany), rarity a afixy. Iba dáta – logika je v `systems/loot`.
 * Slovenčina má rody, preto prívlastky (prefixy) majú tvar pre každý rod.
 */

export type ItemSlot = 'melee' | 'ranged' | 'trinket';
export type Gender = 'm' | 'f' | 'n';

export interface MeleeStats {
  readonly damage: number;
  readonly cooldownMs: number;
  readonly range: number;
  /** Polovičný uhol výseku v stupňoch. */
  readonly halfArcDeg: number;
  /** Rýchlosť odhodenia zasiahnutého (dlaždice/s). */
  readonly knockback: number;
}

export interface RangedStats {
  readonly damage: number;
  readonly cooldownMs: number;
  /** dlaždice/s */
  readonly speed: number;
  readonly range: number;
  readonly knockback: number;
}

/** Násobky a bonusy, ktoré dávajú afixy a talizmany. Chýbajúca hodnota = bez zmeny. */
export interface StatMods {
  readonly damageMult?: number;
  readonly cooldownMult?: number;
  readonly rangeMult?: number;
  readonly knockbackMult?: number;
  readonly maxHpBonus?: number;
  readonly speedMult?: number;
  readonly dashCooldownMult?: number;
}

interface BaseItemCommon {
  readonly name: string;
  readonly gender: Gender;
  readonly flavor: string;
}

export type BaseItemDef =
  | (BaseItemCommon & { readonly slot: 'melee'; readonly stats: MeleeStats })
  | (BaseItemCommon & { readonly slot: 'ranged'; readonly stats: RangedStats })
  | (BaseItemCommon & { readonly slot: 'trinket'; readonly mods: StatMods });

export const BASE_ITEMS = {
  puncher: {
    slot: 'melee',
    name: 'Dierovačka',
    gender: 'f',
    flavor: 'Dve dierky do každého spisu. A do každého audítora.',
    stats: { damage: 12, cooldownMs: 380, range: 1.15, halfArcDeg: 60, knockback: 4 },
  },
  ruler: {
    slot: 'melee',
    name: 'Kovové pravítko',
    gender: 'n',
    flavor: 'Meria presne. Hlavne vzdialenosť k ďalšiemu úderu.',
    stats: { damage: 8, cooldownMs: 240, range: 1.35, halfArcDeg: 40, knockback: 2.5 },
  },
  heavy_stapler: {
    slot: 'melee',
    name: 'Priemyselná zošívačka',
    gender: 'f',
    flavor: 'Na zošívanie zmlúv s osudom. Ťažká ako pondelok.',
    stats: { damage: 22, cooldownMs: 650, range: 1.0, halfArcDeg: 75, knockback: 6 },
  },
  stapler: {
    slot: 'ranged',
    name: 'Sponkovačka',
    gender: 'f',
    flavor: 'Zošije čokoľvek. Aj ústa sťažovateľom.',
    stats: { damage: 7, cooldownMs: 320, speed: 9, range: 7, knockback: 1.5 },
  },
  rubber_band: {
    slot: 'ranged',
    name: 'Gumičkomet',
    gender: 'm',
    flavor: 'Zakázaný smernicou 12/b. Preto funguje.',
    stats: { damage: 4, cooldownMs: 160, speed: 12, range: 6, knockback: 0.8 },
  },
  pen: {
    slot: 'ranged',
    name: 'Vrhacie pero',
    gender: 'n',
    flavor: 'Firemné. Nikto ho nechce späť.',
    stats: { damage: 13, cooldownMs: 600, speed: 8, range: 8, knockback: 2.5 },
  },
  lanyard: {
    slot: 'trinket',
    name: 'Visačka s menom',
    gender: 'f',
    flavor: 'Aby vás pri pitve identifikovali.',
    mods: { maxHpBonus: 15 },
  },
  mug: {
    slot: 'trinket',
    name: 'Hrnček „Najlepší šéf“',
    gender: 'm',
    flavor: 'Kúpený vlastnými peniazmi.',
    mods: { speedMult: 1.1 },
  },
  stress_ball: {
    slot: 'trinket',
    name: 'Stresová loptička',
    gender: 'f',
    flavor: 'Stláčaná do tvaru výpovede.',
    mods: { dashCooldownMult: 0.8 },
  },
} as const satisfies Record<string, BaseItemDef>;

export type BaseItemId = keyof typeof BASE_ITEMS;
export const BASE_ITEM_IDS = Object.keys(BASE_ITEMS) as BaseItemId[];

export const RARITIES = ['common', 'bureaucratic', 'legendary', 'cursed'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface RarityDef {
  readonly name: string;
  /** Relatívna váha pri drope. */
  readonly weight: number;
  readonly goodAffixes: number;
  readonly curses: number;
  readonly color: string;
  readonly tint: number;
  /** Koľko formulárov dá skartovanie. */
  readonly shredValue: number;
}

export const RARITY: Readonly<Record<Rarity, RarityDef>> = {
  common: { name: 'Bežné', weight: 60, goodAffixes: 0, curses: 0, color: '#c9c9c9', tint: 0xc9c9c9, shredValue: 1 },
  bureaucratic: { name: 'Byrokratické', weight: 28, goodAffixes: 1, curses: 0, color: '#6fa8ff', tint: 0x6fa8ff, shredValue: 2 },
  legendary: { name: 'Legendárne', weight: 9, goodAffixes: 2, curses: 0, color: '#ffb040', tint: 0xffb040, shredValue: 5 },
  cursed: { name: 'Prekliate', weight: 3, goodAffixes: 1, curses: 1, color: '#c070ff', tint: 0xc070ff, shredValue: 4 },
};

export interface AffixDef {
  readonly position: 'prefix' | 'suffix';
  /** Prefix: tvar podľa rodu. Suffix: jeden tvar. */
  readonly label: Readonly<Record<Gender, string>> | string;
  readonly mods: StatMods;
  readonly curse: boolean;
  /** Na ktoré sloty sa hodí (talizman nemá útok, nedáva zmysel „+poškodenie“). */
  readonly slots: readonly ItemSlot[];
}

const WEAPON: readonly ItemSlot[] = ['melee', 'ranged'];
const ANY: readonly ItemSlot[] = ['melee', 'ranged', 'trinket'];

export const AFFIXES = {
  procrastinating: {
    position: 'prefix',
    label: { m: 'Prokrastinujúci', f: 'Prokrastinujúca', n: 'Prokrastinujúce' },
    mods: { damageMult: 1.5, cooldownMult: 1.35 },
    curse: false,
    slots: WEAPON,
  },
  urgent: {
    position: 'prefix',
    label: { m: 'Urgentný', f: 'Urgentná', n: 'Urgentné' },
    mods: { cooldownMult: 0.75, damageMult: 0.9 },
    curse: false,
    slots: WEAPON,
  },
  certified: {
    position: 'prefix',
    label: { m: 'Certifikovaný', f: 'Certifikovaná', n: 'Certifikované' },
    mods: { damageMult: 1.2 },
    curse: false,
    slots: WEAPON,
  },
  ergonomic: {
    position: 'prefix',
    label: { m: 'Ergonomický', f: 'Ergonomická', n: 'Ergonomické' },
    mods: { speedMult: 1.1 },
    curse: false,
    slots: ANY,
  },
  laminated: {
    position: 'prefix',
    label: { m: 'Laminovaný', f: 'Laminovaná', n: 'Laminované' },
    mods: { maxHpBonus: 20 },
    curse: false,
    slots: ANY,
  },
  employee_of_month: {
    position: 'suffix',
    label: 'zamestnanca mesiaca (posmrtne)',
    mods: { damageMult: 1.15, maxHpBonus: 10 },
    curse: false,
    slots: ANY,
  },
  meeting: {
    position: 'suffix',
    label: 'z porady, ktorá mohla byť e-mail',
    mods: { rangeMult: 1.25 },
    curse: false,
    slots: WEAPON,
  },
  teambuilding: {
    position: 'suffix',
    label: 'z povinného teambuildingu',
    mods: { knockbackMult: 1.6 },
    curse: false,
    slots: WEAPON,
  },
  overtime: {
    position: 'suffix',
    label: 'neplatených nadčasov',
    mods: { cooldownMult: 0.85 },
    curse: false,
    slots: WEAPON,
  },
  severance: {
    position: 'suffix',
    label: 's odstupným',
    mods: { dashCooldownMult: 0.75 },
    curse: false,
    slots: ANY,
  },
  // --- kliatby (iba rarita Prekliate): silná výhoda za silnú cenu ---
  cc_everyone: {
    position: 'suffix',
    label: 'v kópii celej firme',
    mods: { damageMult: 1.6, maxHpBonus: -30 },
    curse: true,
    slots: ANY,
  },
  micromanaged: {
    position: 'prefix',
    label: { m: 'Mikromanažovaný', f: 'Mikromanažovaná', n: 'Mikromanažované' },
    mods: { cooldownMult: 0.7, speedMult: 0.8 },
    curse: true,
    slots: ANY,
  },
  under_audit: {
    position: 'suffix',
    label: 'pod auditom',
    mods: { damageMult: 1.8, rangeMult: 0.7 },
    curse: true,
    slots: WEAPON,
  },
} as const satisfies Record<string, AffixDef>;

export type AffixId = keyof typeof AFFIXES;
export const AFFIX_IDS = Object.keys(AFFIXES) as AffixId[];

/** Predmet v inventári – iba odkazy na dáta, štatistiky sa počítajú. */
export interface Item {
  readonly id: string;
  readonly base: BaseItemId;
  readonly rarity: Rarity;
  readonly affixes: readonly AffixId[];
}

export const INVENTORY_LIMIT = 16;
