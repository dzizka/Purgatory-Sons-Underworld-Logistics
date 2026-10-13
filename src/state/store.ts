import { EventBus } from '@/core/EventBus';
import { Rng } from '@/core/rng';
import { BUILDING_TYPES, BUILDINGS, type BuildingType } from '@/data/buildings';
import { BASE_ITEMS, INVENTORY_LIMIT, type Item, RARITY } from '@/data/items';
import { canAfford, formatAmounts, gain, spend, type ResourceAmounts, type Resources } from '@/data/resources';
import type { BuildingState, GameState, SinnerState } from '@/state/GameState';
import { tickProduction, workersOf } from '@/systems/base/production';
import { itemName, type Loadout, resolveLoadout } from '@/systems/loot/loot';
import { generateSinner, levelFromXp } from '@/systems/staff/sinners';

export const HIRE_COST = { souls: 3 } as const;

export interface GameEvents {
  resourcesChanged: Readonly<Resources>;
  buildingBuilt: BuildingState;
  cycleCompleted: { building: BuildingState };
  sinnerHired: SinnerState;
  sinnerAssigned: { sinner: SinnerState; building: BuildingState | null };
  levelUp: SinnerState;
  notice: { text: string; tone: 'info' | 'warn' };
  inventoryChanged: null;
  buildingUnlocked: BuildingType;
}

export type Result = { ok: true } | { ok: false; reason: string };

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
    progress: { expeditionsWon: 0, expeditionsLost: 0, kills: 0 },
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
    const results = tickProduction(this.state, dtMs);
    if (results.length === 0) return;
    for (const r of results) {
      this.events.emit('cycleCompleted', { building: r.building });
      for (const s of r.levelUps) {
        this.events.emit('levelUp', s);
        this.events.emit('notice', {
          text: `${s.name} povýšený na úroveň ${levelFromXp(s.xp)}. Plat ostáva rovnaký.`,
          tone: 'info',
        });
      }
    }
    this.events.emit('resourcesChanged', this.state.resources);
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
  recordExpedition(won: boolean, kills: number): void {
    const before = BUILDING_TYPES.filter((t) => this.isUnlocked(t));
    const p = this.state.progress;
    if (won) p.expeditionsWon += 1;
    else p.expeditionsLost += 1;
    p.kills += kills;
    for (const t of BUILDING_TYPES) {
      if (before.includes(t) || !this.isUnlocked(t)) continue;
      this.events.emit('buildingUnlocked', t);
      this.events.emit('notice', { text: `Odomknuté: ${BUILDINGS[t].name}. Vedenie schválilo rozpočet.`, tone: 'info' });
    }
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

  hire(): Result {
    if (!canAfford(this.state.resources, HIRE_COST)) {
      return fail(`Na nábor treba ${formatAmounts(HIRE_COST)}. HR bez duší nepracuje.`);
    }
    spend(this.state.resources, HIRE_COST);
    const rng = new Rng(this.state.rngSeed);
    const s = generateSinner(rng, `s${this.state.nextId++}`);
    this.state.rngSeed = rng.seed;
    this.state.sinners.push(s);
    this.events.emit('sinnerHired', s);
    this.events.emit('resourcesChanged', this.state.resources);
    this.events.emit('notice', { text: `Nový zamestnanec: ${s.name} (hriech: ${s.sin.toLowerCase()})`, tone: 'info' });
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
    if (workersOf(this.state, b.id).length >= def.maxWorkers) {
      return fail(`${def.name} je plná (${def.maxWorkers}). Aj peklo má bezpečnostné predpisy.`);
    }
    s.assignedTo = b.id;
    this.events.emit('sinnerAssigned', { sinner: s, building: b });
    return { ok: true };
  }
}
