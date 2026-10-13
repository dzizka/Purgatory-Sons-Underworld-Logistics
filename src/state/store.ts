import { EventBus } from '@/core/EventBus';
import { Rng } from '@/core/rng';
import { BUILDING_TYPES, BUILDINGS, type BuildingType } from '@/data/buildings';
import { BASE_ITEMS, INVENTORY_LIMIT, type Item, RARITY } from '@/data/items';
import { canAfford, formatAmounts, gain, spend, type ResourceAmounts, type Resources } from '@/data/resources';
import type { BuildingState, GameState, SinnerState } from '@/state/GameState';
import { MAX_LEVEL, PENSION_BONUS, PENSION_MAX } from '@/data/careers';
import { SINNER_KIND_DEFS, SINNER_KINDS, type SinnerKind } from '@/data/sinnerKinds';
import { leadOf, tickBase, workersOf } from '@/systems/base/production';
import { quotaText } from '@/data/quotas';
import {
  applyQuotaEvent,
  bonusReady,
  createBoard,
  dailyBonus,
  isDone,
  quotaReward,
  type QuotaEvent,
} from '@/systems/quotas/quotas';
import { DAILY_BONUS_LUCK } from '@/data/quotas';
import type { EnemyKind } from '@/data/enemies';
import { generateItem, itemName, type Loadout, resolveLoadout } from '@/systems/loot/loot';
import { generateSinner, isMaxLevel, levelFromXp } from '@/systems/staff/sinners';

/** Cena náboru úradníka (základný typ). */
export const HIRE_COST = SINNER_KIND_DEFS.clerk.hireCost;
/** Koľko mien si dôchodkový fond pamätá (bonus sa počíta len do `PENSION_MAX`). */
const RETIREES_KEPT = 100;

export interface GameEvents {
  resourcesChanged: Readonly<Resources>;
  buildingBuilt: BuildingState;
  cycleCompleted: { building: BuildingState };
  sinnerHired: SinnerState;
  sinnerAssigned: { sinner: SinnerState; building: BuildingState | null };
  levelUp: SinnerState;
  /** Hriešnik si práve vzal kávu zo skladu (kozmetické – animácia prestávky). */
  coffeeBreak: SinnerState;
  /** Povýšenie na vedúceho. */
  careerChanged: SinnerState;
  sinnerRetired: SinnerState;
  notice: { text: string; tone: 'info' | 'warn' };
  inventoryChanged: null;
  buildingUnlocked: BuildingType;
  kindUnlocked: SinnerKind;
  quotasChanged: null;
}

export type Result = { ok: true } | { ok: false; reason: string };

/** Sčíta čiastkové suroviny (chýbajúce položky = 0). */
function addAmounts(into: ResourceAmounts, a: ResourceAmounts): void {
  for (const id of Object.keys(a) as (keyof ResourceAmounts)[]) into[id] = (into[id] ?? 0) + (a[id] ?? 0);
}

const fail = (reason: string): Result => ({ ok: false, reason });

export function createInitialState(seed: number): GameState {
  const state: GameState = {
    version: 1,
    timeMs: 0,
    resources: { souls: 2, forms: 10, sulfur: 40, coffee: 2 },
    buildings: [],
    sinners: [],
    inventory: [
      { id: 'i-start-melee', base: 'puncher', rarity: 'common', affixes: [] },
      { id: 'i-start-ranged', base: 'stapler', rarity: 'common', affixes: [] },
    ],
    equipment: { melee: 'i-start-melee', ranged: 'i-start-ranged', trinket: null },
    progress: { expeditionsWon: 0, expeditionsLost: 0, kills: 0, deepestFloor: 0, bossesDefeated: 0 },
    retirees: [],
    quotas: null,
    rngSeed: seed >>> 0,
    nextId: 1,
  };
  const rng = new Rng(state.rngSeed);
  for (let i = 0; i < 2; i++) state.sinners.push(generateSinner(rng, `s${state.nextId++}`));
  state.rngSeed = rng.seed;
  return state;
}

/**
 * Jediné miesto, kde sa mení stav hry. Scény volajú príkazy a počúvajú eventy,
 * stav nikdy nemenia priamo.
 */
export class GameStore {
  readonly events = new EventBus<GameEvents>();

  constructor(readonly state: GameState) {}

  buildingAt(tx: number, ty: number): BuildingState | undefined {
    return this.state.buildings.find((b) => b.tx === tx && b.ty === ty);
  }

  building(id: string): BuildingState | undefined {
    return this.state.buildings.find((b) => b.id === id);
  }

  sinner(id: string): SinnerState | undefined {
    return this.state.sinners.find((s) => s.id === id);
  }

  tick(dtMs: number): void {
    const { cycles, fatigue } = tickBase(this.state, dtMs);
    const [first, ...others] = fatigue.burnedOut;
    if (first !== undefined) {
      const who = others.length === 0 ? `${first.name} vyhorel` : `${first.name} a ďalší (${others.length}) vyhoreli`;
      this.events.emit('notice', { text: `${who}. Bez kávy pracujú na polovicu – postavte Kávovar.`, tone: 'warn' });
    }
    for (const s of fatigue.drinkers) this.events.emit('coffeeBreak', s);
    if (cycles.length === 0 && fatigue.coffeeBreaks === 0) return;
    if (cycles.length > 0) {
      const produced: ResourceAmounts = {};
      for (const r of cycles) addAmounts(produced, r.produced);
      this.quotaEvent({ type: 'produced', amounts: produced });
    }
    for (const r of cycles) {
      this.events.emit('cycleCompleted', { building: r.building });
      for (const s of r.levelUps) {
        this.events.emit('levelUp', s);
        const lvl = levelFromXp(s.xp);
        this.events.emit('notice', {
          text:
            lvl >= MAX_LEVEL
              ? `${s.name} dosiahol strop (úroveň ${MAX_LEVEL}). V Personálnom: [P] povýšiť na vedúceho, [R] dôchodok.`
              : `${s.name} povýšený na úroveň ${lvl}. Plat ostáva rovnaký.`,
          tone: 'info',
        });
      }
    }
    this.events.emit('resourcesChanged', this.state.resources);
  }

  /** Bonus dôchodkového fondu v percentách (pre UI). */
  pensionPercent(): number {
    return Math.round(PENSION_BONUS * Math.min(PENSION_MAX, this.state.retirees.length) * 100);
  }

  /** Hriešnik na strope sa stane vedúcim: nepracuje, ale jeho budova ide o 25 % rýchlejšie. */
  promote(sinnerId: string): Result {
    const s = this.sinner(sinnerId);
    if (s === undefined) return fail('Taký zamestnanec neexistuje.');
    if (s.role === 'lead') return fail(`${s.name} už je vedúci. Vyššie je len predstavenstvo a tam sa nedostane nikto.`);
    if (!isMaxLevel(s)) return fail(`Povýšiť sa dá až na úrovni ${MAX_LEVEL}. Dovtedy je to len „talent“.`);
    s.role = 'lead';
    s.fatigue = 0;
    // v budove už vedúci je → nový ide do čakárne, dvaja vedúci = nekonečná porada
    if (s.assignedTo !== null && leadOf(this.state, s.assignedTo) !== s) s.assignedTo = null;
    this.events.emit('careerChanged', s);
    this.events.emit('notice', { text: `${s.name} povýšený na vedúceho. Odteraz už len deleguje (+25 % pre budovu).`, tone: 'info' });
    return { ok: true };
  }

  /** Hriešnik na strope odíde do dôchodku: zmizne z personálu, celá výroba je trvalo rýchlejšia. */
  retire(sinnerId: string): Result {
    const s = this.sinner(sinnerId);
    if (s === undefined) return fail('Taký zamestnanec neexistuje.');
    if (!isMaxLevel(s)) return fail(`Do dôchodku až na úrovni ${MAX_LEVEL}. Večnosť je dlhá, odpracujte si ju.`);
    this.state.sinners = this.state.sinners.filter((o) => o !== s);
    this.state.retirees.push(s.name);
    this.state.retirees.splice(0, Math.max(0, this.state.retirees.length - RETIREES_KEPT));
    const full = this.state.retirees.length > PENSION_MAX;
    this.events.emit('sinnerRetired', s);
    this.events.emit('notice', {
      text: full
        ? `${s.name} odchádza do dôchodku. Fond je plný, bonus ostáva +${this.pensionPercent()} %. Aspoň sa uvoľnilo miesto.`
        : `${s.name} odchádza do dôchodku. Celá výroba +${this.pensionPercent()} %. Penzia je krátka, večnosť dlhá.`,
      tone: 'info',
    });
    return { ok: true };
  }

  isUnlocked(type: BuildingType): boolean {
    const u = BUILDINGS[type].unlock;
    if (u === undefined) return true;
    const p = this.state.progress;
    return p.expeditionsWon >= (u.expeditionsWon ?? 0) && p.kills >= (u.kills ?? 0);
  }

  item(id: string | null): Item | undefined {
    return id === null ? undefined : this.state.inventory.find((i) => i.id === id);
  }

  isEquipped(id: string): boolean {
    return Object.values(this.state.equipment).includes(id);
  }

  /** Aktuálne štatistiky manažéra z výbavy. */
  loadout(): Loadout {
    const eq = this.state.equipment;
    return resolveLoadout({ melee: this.item(eq.melee), ranged: this.item(eq.ranged), trinket: this.item(eq.trinket) });
  }

  equip(itemId: string): Result {
    const item = this.item(itemId);
    if (item === undefined) return fail('Predmet sa stratil. Pravdepodobne ho niekto „požičal“.');
    this.state.equipment[BASE_ITEMS[item.base].slot] = item.id;
    this.events.emit('inventoryChanged', null);
    return { ok: true };
  }

  /** Talizman sa dá odložiť; zbraň nie (bez nej by manažér bojoval argumentmi). */
  unequipTrinket(): void {
    this.state.equipment.trinket = null;
    this.events.emit('inventoryChanged', null);
  }

  /** Skartovanie predmetu → formuláre podľa rarity. */
  shred(itemId: string): Result {
    const item = this.item(itemId);
    if (item === undefined) return fail('Nie je čo skartovať.');
    if (this.isEquipped(itemId)) return fail('Výbavu na sebe neskartujeme. Bezpečnosť práce.');
    this.state.inventory = this.state.inventory.filter((i) => i.id !== itemId);
    const forms = RARITY[item.rarity].shredValue;
    this.grant({ forms });
    this.events.emit('inventoryChanged', null);
    this.events.emit('notice', { text: `Skartované: ${itemName(item)} (+${forms} F).`, tone: 'info' });
    this.quotaEvent({ type: 'shredded' });
    return { ok: true };
  }

  /** Pridá korisť do skladu; čo sa nezmestí, automaticky skartuje. */
  addLoot(items: readonly Item[]): { added: Item[]; shredded: Item[] } {
    const added: Item[] = [];
    const shredded: Item[] = [];
    for (const it of items) {
      const item: Item = { ...it, id: `i${this.state.nextId++}` };
      if (this.state.inventory.length < INVENTORY_LIMIT) {
        this.state.inventory.push(item);
        added.push(item);
      } else {
        shredded.push(item);
      }
    }
    const forms = shredded.reduce((sum, i) => sum + RARITY[i.rarity].shredValue, 0);
    if (forms > 0) {
      this.grant({ forms });
      this.events.emit('notice', { text: `Sklad je plný – ${shredded.length}× skartované (+${forms} F).`, tone: 'warn' });
    }
    if (added.length > 0) this.events.emit('inventoryChanged', null);
    return { added, shredded };
  }

  /** Zapíše výsledok expedície a ohlási nové odomknuté budovy. */
  recordExpedition(won: boolean, kills: number, depth = 1, bossKills = 0, killsByKind: Partial<Record<EnemyKind, number>> = {}): void {
    // kvóty: mŕtvi nevykazujú – ráta sa len živý návrat
    if (won) this.quotaEvent({ type: 'expedition', kills, killsByKind, depth, bossKills });
    const before = BUILDING_TYPES.filter((t) => this.isUnlocked(t));
    const kindsBefore = SINNER_KINDS.filter((k) => this.isKindUnlocked(k));
    const p = this.state.progress;
    if (won) {
      p.expeditionsWon += 1;
      p.bossesDefeated += bossKills;
      if (depth > p.deepestFloor) {
        p.deepestFloor = depth;
        if (depth > 1) this.events.emit('notice', { text: `Nový rekord: poschodie ${depth}. Vedenie o vás vie. To nie je dobre.`, tone: 'info' });
      }
    } else p.expeditionsLost += 1;
    p.kills += kills;
    for (const t of BUILDING_TYPES) {
      if (before.includes(t) || !this.isUnlocked(t)) continue;
      this.events.emit('buildingUnlocked', t);
      this.events.emit('notice', { text: `Odomknuté: ${BUILDINGS[t].name}. Vedenie schválilo rozpočet.`, tone: 'info' });
    }
    for (const k of SINNER_KINDS) {
      if (kindsBefore.includes(k) || !this.isKindUnlocked(k)) continue;
      this.events.emit('kindUnlocked', k);
      this.events.emit('notice', { text: `HR môže nabrať nový typ: ${SINNER_KIND_DEFS[k].name}. [T] v Personálnom prepne typ náboru.`, tone: 'info' });
    }
  }

  /** Nový deň → nové kvóty (séria pokračuje, ak včera bolo splnené všetko). Vráti `true`, ak sa vygenerovali. */
  refreshQuotas(day: string): boolean {
    const old = this.state.quotas;
    if (old !== null && old.day === day) return false;
    this.state.quotas = createBoard(this.state.rngSeed, day, this.state.progress, old);
    this.events.emit('quotasChanged', null);
    if (old !== null) this.events.emit('notice', { text: 'Vedenie vydalo nové denné kvóty. Plnenie je dobrovoľne povinné.', tone: 'info' });
    return true;
  }

  private quotaEvent(ev: QuotaEvent): void {
    const board = this.state.quotas;
    if (board === null) return;
    const done = applyQuotaEvent(board, ev);
    for (const e of done) this.events.emit('notice', { text: `Kvóta splnená: ${quotaText(e.quota)}. [Q] vyzdvihnúť odmenu.`, tone: 'info' });
    this.events.emit('quotasChanged', null);
  }

  /** Vyzdvihne odmeny za splnené kvóty (a bonus za všetky tri). Vráti počet vyzdvihnutých. */
  claimQuotas(): number {
    const board = this.state.quotas;
    if (board === null) return 0;
    const total: ResourceAmounts = {};
    let claimed = 0;
    for (const e of board.entries) {
      if (e.claimed || !isDone(e)) continue;
      e.claimed = true;
      claimed += 1;
      addAmounts(total, quotaReward(e, board, this.state.progress));
    }
    let bonus = false;
    if (bonusReady(board)) {
      board.bonusClaimed = true;
      bonus = true;
      addAmounts(total, dailyBonus(board, this.state.progress));
      const rng = new Rng(this.state.rngSeed);
      const item = generateItem(rng, 'quota', { luck: DAILY_BONUS_LUCK + 0.25 * this.state.progress.deepestFloor });
      this.state.rngSeed = rng.seed;
      this.addLoot([item]);
    }
    if (claimed === 0 && !bonus) return 0;
    this.grant(total);
    this.events.emit('quotasChanged', null);
    this.events.emit('notice', {
      text: bonus
        ? `Všetky kvóty splnené! Zamestnanec dňa: +${formatAmounts(total)} a predmet. Séria: ${board.streak + 1}. deň.`
        : `Odmena za kvóty: +${formatAmounts(total)}. Vedenie je mierne menej sklamané.`,
      tone: 'info',
    });
    return claimed;
  }

  isKindUnlocked(kind: SinnerKind): boolean {
    const u = SINNER_KIND_DEFS[kind].unlock;
    if (u === undefined) return true;
    const p = this.state.progress;
    return (
      p.kills >= (u.kills ?? 0) &&
      p.expeditionsWon >= (u.expeditionsWon ?? 0) &&
      p.deepestFloor >= (u.deepestFloor ?? 0) &&
      p.bossesDefeated >= (u.bossesDefeated ?? 0)
    );
  }

  /** Pripíše suroviny (napr. odmeny z expedície). */
  grant(amount: ResourceAmounts): void {
    gain(this.state.resources, amount);
    this.events.emit('resourcesChanged', this.state.resources);
  }

  build(type: BuildingType, tx: number, ty: number): Result {
    const def = BUILDINGS[type];
    if (!this.isUnlocked(type)) return fail(`${def.name} je zatiaľ zamknutá: ${def.unlock?.hint ?? '?'}.`);
    if (this.buildingAt(tx, ty) !== undefined) return fail('Tu už niečo stojí. Dvojité zaúčtovanie je hriech.');
    if (!canAfford(this.state.resources, def.cost)) {
      return fail(`Rozpočet nestačí (${formatAmounts(def.cost)}). Podajte žiadosť o navýšenie v troch kópiách.`);
    }
    spend(this.state.resources, def.cost);
    const b: BuildingState = { id: `b${this.state.nextId++}`, type, tx, ty, progress: 0, status: 'idle', cyclesDone: 0 };
    this.state.buildings.push(b);
    this.events.emit('buildingBuilt', b);
    this.events.emit('resourcesChanged', this.state.resources);
    return { ok: true };
  }

  hire(kind: SinnerKind = 'clerk'): Result {
    const def = SINNER_KIND_DEFS[kind];
    if (!this.isKindUnlocked(kind)) return fail(`${def.name} je zatiaľ mimo rozpočtu HR: ${def.unlock?.hint ?? '?'}.`);
    if (!canAfford(this.state.resources, def.hireCost)) {
      return fail(`Na nábor (${def.name}) treba ${formatAmounts(def.hireCost)}. HR bez duší nepracuje.`);
    }
    spend(this.state.resources, def.hireCost);
    const rng = new Rng(this.state.rngSeed);
    const s = generateSinner(rng, `s${this.state.nextId++}`, kind);
    this.state.rngSeed = rng.seed;
    this.state.sinners.push(s);
    this.events.emit('sinnerHired', s);
    this.quotaEvent({ type: 'hired' });
    this.events.emit('resourcesChanged', this.state.resources);
    this.events.emit('notice', { text: `Nový zamestnanec: ${s.name}, ${def.name.toLowerCase()} (hriech: ${s.sin.toLowerCase()})`, tone: 'info' });
    return { ok: true };
  }

  /** Priradí hriešnika do budovy, `null` = späť do čakárne. */
  assign(sinnerId: string, buildingId: string | null): Result {
    const s = this.sinner(sinnerId);
    if (s === undefined) return fail('Taký zamestnanec neexistuje. Možno ho prepustili posmrtne.');
    if (buildingId === null) {
      s.assignedTo = null;
      this.events.emit('sinnerAssigned', { sinner: s, building: null });
      return { ok: true };
    }
    const b = this.building(buildingId);
    if (b === undefined) return fail('Budova neexistuje. Ani v papieroch.');
    if (s.assignedTo === b.id) return { ok: true };
    const def = BUILDINGS[b.type];
    if (s.role === 'lead') {
      const other = leadOf(this.state, b.id);
      if (other !== undefined) return fail(`${def.name} už má vedúceho (${other.name}). Dvaja vedúci = nekonečná porada.`);
      s.assignedTo = b.id;
      this.events.emit('sinnerAssigned', { sinner: s, building: b });
      return { ok: true };
    }
    if (workersOf(this.state, b.id).length >= def.maxWorkers) {
      return fail(`${def.name} je plná (${def.maxWorkers}). Aj peklo má bezpečnostné predpisy.`);
    }
    s.assignedTo = b.id;
    this.events.emit('sinnerAssigned', { sinner: s, building: b });
    return { ok: true };
  }
}
