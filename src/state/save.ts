import { BUILDING_TYPES } from '@/data/buildings';
import { SINNER_ROLES } from '@/data/careers';
import { AFFIX_IDS, BASE_ITEM_IDS, type Item, RARITIES } from '@/data/items';
import { RESOURCE_IDS } from '@/data/resources';
import { TRAIT_IDS } from '@/data/traits';
import type { BuildingState, GameState, SinnerState } from '@/state/GameState';
import { MAX_XP } from '@/systems/staff/sinners';

/**
 * Ukladanie: JSON v localStorage + verzie s migráciami.
 * Všetko čo príde zvonka (localStorage, importovaný súbor) je nedôveryhodné → validácia.
 */

export const SAVE_KEY = 'purgatory-logistics.save';
/** Sem sa odloží poškodený save, aby sa dal ručne zachrániť. */
export const CORRUPT_BACKUP_KEY = 'purgatory-logistics.save.corrupt';
export const SAVE_VERSION = 3;

export interface Settings {
  /** 0..1 */
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  tutorialDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = { musicVolume: 0.7, sfxVolume: 0.8, muted: false, tutorialDone: false };

export interface SaveFile {
  readonly saveVersion: number;
  /** Epoch ms – na výpočet offline progresu. */
  readonly savedAt: number;
  readonly state: GameState;
  readonly settings: Settings;
}

export type ParseResult = { ok: true; save: SaveFile; migratedFrom: number | null } | { ok: false; reason: string };

export function serialize(state: GameState, settings: Settings, now: number): string {
  const file: SaveFile = { saveVersion: SAVE_VERSION, savedAt: now, state, settings };
  return JSON.stringify(file);
}

// ---------------------------------------------------------------- migrácie

type Json = Record<string, unknown>;

/**
 * `MIGRATIONS[n]` prevedie save verzie n na n+1. Nová verzia savu = nová položka tu + test.
 * v0: prototyp bez skladu, výbavy a štatistík expedícií.
 */
const MIGRATIONS: Readonly<Record<number, (state: Json) => Json>> = {
  0: (s) => ({
    ...s,
    inventory: s.inventory ?? [
      { id: 'i-start-melee', base: 'puncher', rarity: 'common', affixes: [] },
      { id: 'i-start-ranged', base: 'stapler', rarity: 'common', affixes: [] },
    ],
    equipment: s.equipment ?? { melee: 'i-start-melee', ranged: 'i-start-ranged', trinket: null },
    progress: s.progress ?? { expeditionsWon: 0, expeditionsLost: 0, kills: 0 },
  }),
  // v1 → v2: procedurálny dungeon, rekord najhlbšieho poschodia
  1: (s) => {
    const progress = isObj(s.progress) ? s.progress : {};
    return { ...s, progress: { ...progress, deepestFloor: progress.deepestFloor ?? 0 } };
  },
  // v2 → v3: kariéra hriešnikov – rola, únava, dôchodkový fond
  2: (s) => ({
    ...s,
    sinners: Array.isArray(s.sinners) ? s.sinners.map((x) => (isObj(x) ? { role: 'worker', fatigue: 0, ...x } : x)) : s.sinners,
    retirees: s.retirees ?? [],
  }),
};

// ---------------------------------------------------------------- validácia

class Invalid extends Error {}

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function obj(v: unknown, path: string): Json {
  if (!isObj(v)) throw new Invalid(`${path}: očakávaný objekt`);
  return v;
}
function num(v: unknown, path: string, min = -Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min) throw new Invalid(`${path}: neplatné číslo`);
  return v;
}
function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 200) throw new Invalid(`${path}: neplatný text`);
  return v;
}
function arr(v: unknown, path: string, max = 10_000): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw new Invalid(`${path}: očakávané pole`);
  return v;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], path: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw new Invalid(`${path}: neznáma hodnota`);
  return v as T;
}

function validateState(raw: unknown): GameState {
  const s = obj(raw, 'state');
  const res = obj(s.resources, 'resources');
  const resources = Object.fromEntries(RESOURCE_IDS.map((id) => [id, num(res[id], `resources.${id}`, 0)])) as GameState['resources'];

  const buildings: BuildingState[] = arr(s.buildings, 'buildings', 500).map((b, i) => {
    const o = obj(b, `buildings[${i}]`);
    return {
      id: str(o.id, `buildings[${i}].id`),
      type: oneOf(o.type, BUILDING_TYPES, `buildings[${i}].type`),
      tx: num(o.tx, `buildings[${i}].tx`),
      ty: num(o.ty, `buildings[${i}].ty`),
      progress: Math.min(1, num(o.progress, `buildings[${i}].progress`, 0)),
      status: 'idle', // dopočíta sa pri ďalšom ticku
      cyclesDone: num(o.cyclesDone ?? 0, `buildings[${i}].cyclesDone`, 0),
    };
  });
  const buildingIds = new Set(buildings.map((b) => b.id));

  const sinners: SinnerState[] = arr(s.sinners, 'sinners', 500).map((x, i) => {
    const o = obj(x, `sinners[${i}]`);
    const assigned = o.assignedTo === null || o.assignedTo === undefined ? null : str(o.assignedTo, `sinners[${i}].assignedTo`);
    return {
      id: str(o.id, `sinners[${i}].id`),
      name: str(o.name, `sinners[${i}].name`),
      sin: str(o.sin, `sinners[${i}].sin`),
      traits: arr(o.traits, `sinners[${i}].traits`, 4).map((t, j) => oneOf(t, TRAIT_IDS, `sinners[${i}].traits[${j}]`)),
      look: Math.floor(num(o.look, `sinners[${i}].look`, 0)),
      xp: Math.min(MAX_XP, num(o.xp, `sinners[${i}].xp`, 0)),
      role: oneOf(o.role, SINNER_ROLES, `sinners[${i}].role`),
      fatigue: Math.min(1, num(o.fatigue, `sinners[${i}].fatigue`, 0)),
      // pridelenie do neexistujúcej budovy = späť do čakárne, nie chyba
      assignedTo: assigned !== null && buildingIds.has(assigned) ? assigned : null,
    };
  });

  // najviac jeden vedúci na budovu – ďalší idú do čakárne
  const led = new Set<string>();
  for (const x of sinners) {
    if (x.role !== 'lead' || x.assignedTo === null) continue;
    if (led.has(x.assignedTo)) x.assignedTo = null;
    else led.add(x.assignedTo);
  }

  const inventory: Item[] = arr(s.inventory, 'inventory', 100).map((x, i) => {
    const o = obj(x, `inventory[${i}]`);
    return {
      id: str(o.id, `inventory[${i}].id`),
      base: oneOf(o.base, BASE_ITEM_IDS, `inventory[${i}].base`),
      rarity: oneOf(o.rarity, RARITIES, `inventory[${i}].rarity`),
      affixes: arr(o.affixes, `inventory[${i}].affixes`, 4).map((a, j) => oneOf(a, AFFIX_IDS, `inventory[${i}].affixes[${j}]`)),
    };
  });
  const itemIds = new Set(inventory.map((i) => i.id));
  const eq = obj(s.equipment, 'equipment');
  const slot = (v: unknown, path: string): string | null => {
    if (v === null || v === undefined) return null;
    const id = str(v, path);
    return itemIds.has(id) ? id : null;
  };

  const progress = obj(s.progress, 'progress');
  return {
    version: 1,
    timeMs: num(s.timeMs, 'timeMs', 0),
    resources,
    buildings,
    sinners,
    inventory,
    equipment: { melee: slot(eq.melee, 'equipment.melee'), ranged: slot(eq.ranged, 'equipment.ranged'), trinket: slot(eq.trinket, 'equipment.trinket') },
    progress: {
      expeditionsWon: num(progress.expeditionsWon, 'progress.expeditionsWon', 0),
      expeditionsLost: num(progress.expeditionsLost, 'progress.expeditionsLost', 0),
      kills: num(progress.kills, 'progress.kills', 0),
      deepestFloor: Math.floor(num(progress.deepestFloor, 'progress.deepestFloor', 0)),
    },
    retirees: arr(s.retirees, 'retirees', 1000).map((n, i) => str(n, `retirees[${i}]`)),
    rngSeed: num(s.rngSeed, 'rngSeed') >>> 0,
    nextId: Math.floor(num(s.nextId, 'nextId', 0)),
  };
}

function validateSettings(raw: unknown): Settings {
  if (!isObj(raw)) return { ...DEFAULT_SETTINGS };
  const clamp01 = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
  return {
    musicVolume: clamp01(raw.musicVolume, DEFAULT_SETTINGS.musicVolume),
    sfxVolume: clamp01(raw.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    muted: raw.muted === true,
    tutorialDone: raw.tutorialDone === true,
  };
}

/** Rozparsuje a zvaliduje save (z localStorage alebo importovaného súboru). Nikdy nehodí výnimku. */
export function parseSave(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'súbor nie je platný JSON' };
  }
  try {
    const file = obj(raw, 'save');
    const version = Math.floor(num(file.saveVersion, 'saveVersion', 0));
    if (version > SAVE_VERSION) return { ok: false, reason: `save je z novšej verzie hry (${version})` };
    let state = obj(file.state, 'state');
    for (let v = version; v < SAVE_VERSION; v++) {
      const migrate = MIGRATIONS[v];
      if (migrate === undefined) return { ok: false, reason: `chýba migrácia z verzie ${v}` };
      state = migrate(state);
    }
    return {
      ok: true,
      save: { saveVersion: SAVE_VERSION, savedAt: num(file.savedAt, 'savedAt', 0), state: validateState(state), settings: validateSettings(file.settings) },
      migratedFrom: version < SAVE_VERSION ? version : null,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Invalid ? e.message : 'neznáma chyba' };
  }
}

// ---------------------------------------------------------------- úložisko

/** Podmnožina `Storage` – v testoch stačí obyčajný objekt. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult =
  | { kind: 'none' }
  | { kind: 'ok'; save: SaveFile; migratedFrom: number | null }
  | { kind: 'corrupt'; reason: string };

/** localStorage môže chýbať alebo hádzať (súkromné okno, zakázané cookies) – vtedy `null`. */
export function browserStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    const probe = '__pnl_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function loadFromStorage(storage: StorageLike | null): LoadResult {
  if (storage === null) return { kind: 'none' };
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { kind: 'none' };
  }
  if (raw === null) return { kind: 'none' };
  const r = parseSave(raw);
  if (r.ok) return { kind: 'ok', save: r.save, migratedFrom: r.migratedFrom };
  try {
    storage.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // záloha je bonus – keď sa nepodarí, pokračujeme
  }
  return { kind: 'corrupt', reason: r.reason };
}

/** Vráti `false`, ak sa uložiť nepodarilo (plné/zakázané úložisko). */
export function writeToStorage(storage: StorageLike | null, json: string): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(SAVE_KEY, json);
    return true;
  } catch {
    return false;
  }
}
