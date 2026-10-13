import type { Rng } from '@/core/rng';
import { PLAYER } from '@/data/player';
import {
  AFFIX_IDS,
  AFFIXES,
  type AffixId,
  BASE_ITEM_IDS,
  BASE_ITEMS,
  type BaseItemId,
  type Item,
  type ItemSlot,
  type MeleeStats,
  RARITIES,
  RARITY,
  type Rarity,
  type RangedStats,
  type StatMods,
} from '@/data/items';

/** Vážený výber. Váhy nemusia dávať súčet 1. */
export function weightedPick<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let r = rng.next() * total;
  for (const [value, w] of entries) {
    r -= Math.max(0, w);
    if (r < 0) return value;
  }
  const last = entries[entries.length - 1];
  if (last === undefined) throw new Error('weightedPick: prázdny zoznam');
  return last[0];
}

/** `luck` > 0 zvyšuje šancu na všetko okrem bežných (napr. bonus za vybavenie mapy). */
export function rarityWeights(luck = 0): [Rarity, number][] {
  return RARITIES.map((r) => [r, RARITY[r].weight * (r === 'common' ? 1 : 1 + luck)]);
}

export function rollRarity(rng: Rng, luck = 0): Rarity {
  return weightedPick(rng, rarityWeights(luck));
}

function slotOf(base: BaseItemId): ItemSlot {
  return BASE_ITEMS[base].slot;
}

/** Vyberie afixy: najviac jeden prefix a jeden suffix (aby sa dal zložiť názov). */
function rollAffixes(rng: Rng, slot: ItemSlot, rarity: Rarity): AffixId[] {
  const def = RARITY[rarity];
  const fits = (id: AffixId, curse: boolean): boolean => {
    const a = AFFIXES[id];
    return a.curse === curse && (a.slots as readonly ItemSlot[]).includes(slot);
  };
  const chosen: AffixId[] = [];
  const used = new Set<'prefix' | 'suffix'>();
  const take = (curse: boolean): void => {
    const pool = AFFIX_IDS.filter((id) => fits(id, curse) && !used.has(AFFIXES[id].position) && !chosen.includes(id));
    if (pool.length === 0) return;
    const id = rng.pick(pool);
    chosen.push(id);
    used.add(AFFIXES[id].position);
  };
  for (let i = 0; i < def.curses; i++) take(true);
  for (let i = 0; i < def.goodAffixes; i++) take(false);
  return chosen;
}

export function generateItem(rng: Rng, id: string, opts: { luck?: number; base?: BaseItemId; rarity?: Rarity } = {}): Item {
  const rarity = opts.rarity ?? rollRarity(rng, opts.luck);
  const base = opts.base ?? rng.pick(BASE_ITEM_IDS);
  return { id, base, rarity, affixes: rollAffixes(rng, slotOf(base), rarity) };
}

/** „Prokrastinujúca Dierovačka z porady, ktorá mohla byť e-mail“ */
export function itemName(item: Item): string {
  const base = BASE_ITEMS[item.base];
  let prefix = '';
  let suffix = '';
  for (const id of item.affixes) {
    const a = AFFIXES[id];
    if (typeof a.label === 'string') suffix = a.label;
    else prefix = a.label[base.gender];
  }
  const name = prefix === '' ? base.name : `${prefix} ${base.name.charAt(0).toLowerCase()}${base.name.slice(1)}`;
  return suffix === '' ? name : `${name} ${suffix}`;
}

interface Mods {
  damageMult: number;
  cooldownMult: number;
  rangeMult: number;
  knockbackMult: number;
  maxHpBonus: number;
  speedMult: number;
  dashCooldownMult: number;
}

const NEUTRAL: Mods = { damageMult: 1, cooldownMult: 1, rangeMult: 1, knockbackMult: 1, maxHpBonus: 0, speedMult: 1, dashCooldownMult: 1 };

function combine(a: Mods, b: StatMods): Mods {
  return {
    damageMult: a.damageMult * (b.damageMult ?? 1),
    cooldownMult: a.cooldownMult * (b.cooldownMult ?? 1),
    rangeMult: a.rangeMult * (b.rangeMult ?? 1),
    knockbackMult: a.knockbackMult * (b.knockbackMult ?? 1),
    maxHpBonus: a.maxHpBonus + (b.maxHpBonus ?? 0),
    speedMult: a.speedMult * (b.speedMult ?? 1),
    dashCooldownMult: a.dashCooldownMult * (b.dashCooldownMult ?? 1),
  };
}

/** Všetky modifikátory predmetu (talizman: aj jeho základ). */
export function itemMods(item: Item): Mods {
  const base = BASE_ITEMS[item.base];
  let m = base.slot === 'trinket' ? combine(NEUTRAL, base.mods) : NEUTRAL;
  for (const id of item.affixes) m = combine(m, AFFIXES[id].mods);
  return m;
}

export interface Loadout {
  readonly melee: MeleeStats & { readonly name: string };
  readonly ranged: RangedStats & { readonly name: string };
  readonly maxHp: number;
  readonly speedPx: number;
  readonly dashCooldownMs: number;
}

const FALLBACK_MELEE: Item = { id: 'fallback-melee', base: 'puncher', rarity: 'common', affixes: [] };
const FALLBACK_RANGED: Item = { id: 'fallback-ranged', base: 'stapler', rarity: 'common', affixes: [] };

/**
 * Výsledné štatistiky manažéra z výbavy.
 * Útočné afixy zbrane platia pre ňu; afixy talizmanu pre obe zbrane; pohyb/HP/úskok sa sčítajú zo všetkého.
 */
export function resolveLoadout(equipped: {
  melee?: Item | null | undefined;
  ranged?: Item | null | undefined;
  trinket?: Item | null | undefined;
}): Loadout {
  const melee = equipped.melee ?? FALLBACK_MELEE;
  const ranged = equipped.ranged ?? FALLBACK_RANGED;
  const trinketMods = equipped.trinket ? itemMods(equipped.trinket) : NEUTRAL;
  const meleeMods = itemMods(melee);
  const rangedMods = itemMods(ranged);
  const all = [meleeMods, rangedMods, trinketMods];

  const weapon = <S extends MeleeStats | RangedStats>(stats: S, own: Mods): S => {
    const m = combine(own, trinketMods);
    return {
      ...stats,
      damage: Math.round(stats.damage * m.damageMult * 10) / 10,
      cooldownMs: Math.round(stats.cooldownMs * m.cooldownMult),
      range: stats.range * m.rangeMult,
      knockback: stats.knockback * m.knockbackMult,
    };
  };
  const meleeBase = BASE_ITEMS[melee.base];
  const rangedBase = BASE_ITEMS[ranged.base];
  if (meleeBase.slot !== 'melee' || rangedBase.slot !== 'ranged') throw new Error('resolveLoadout: predmet v zlom slote');

  return {
    melee: { ...weapon(meleeBase.stats, meleeMods), name: itemName(melee) },
    ranged: { ...weapon(rangedBase.stats, rangedMods), name: itemName(ranged) },
    maxHp: Math.max(10, PLAYER.maxHp + all.reduce((s, m) => s + m.maxHpBonus, 0)),
    speedPx: PLAYER.speedPx * all.reduce((s, m) => s * m.speedMult, 1),
    dashCooldownMs: PLAYER.dash.cooldownMs * all.reduce((s, m) => s * m.dashCooldownMult, 1),
  };
}

/** Krátky popis efektov pre UI: „+50 % poškodenie, −25 % rýchlosť útoku“. */
export function describeMods(item: Item): string {
  const m = itemMods(item);
  const pct = (v: number): string => `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)} %`;
  const parts: string[] = [];
  if (m.damageMult !== 1) parts.push(`${pct(m.damageMult)} poškodenie`);
  // dlhší cooldown = pomalší útok → znamienko otočené, aby „+“ bolo vždy dobré
  if (m.cooldownMult !== 1) parts.push(`${pct(1 / m.cooldownMult)} rýchlosť útoku`);
  if (m.rangeMult !== 1) parts.push(`${pct(m.rangeMult)} dosah`);
  if (m.knockbackMult !== 1) parts.push(`${pct(m.knockbackMult)} odhodenie`);
  if (m.maxHpBonus !== 0) parts.push(`${m.maxHpBonus > 0 ? '+' : '−'}${Math.abs(m.maxHpBonus)} zdravie`);
  if (m.speedMult !== 1) parts.push(`${pct(m.speedMult)} pohyb`);
  if (m.dashCooldownMult !== 1) parts.push(`${pct(1 / m.dashCooldownMult)} úskok`);
  return parts.join(', ');
}
