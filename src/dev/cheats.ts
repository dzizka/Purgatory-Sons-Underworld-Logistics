import { Rng } from '@/core/rng';
import { BUILDING_TYPES } from '@/data/buildings';
import { INVENTORY_LIMIT, type Rarity } from '@/data/items';
import { RESOURCE_IDS, type ResourceAmounts } from '@/data/resources';
import { SINNER_KINDS } from '@/data/sinnerKinds';
import type { ProgressState } from '@/state/GameState';
import type { GameStore } from '@/state/store';
import { ENEMIES } from '@/data/enemies';
import { aliveEnemies, CORPSE_MS, type ExpeditionState } from '@/systems/combat/expedition';
import { generateItem } from '@/systems/loot/loot';
import { MAX_XP } from '@/systems/staff/sinners';
import { dayKey } from '@/systems/quotas/quotas';

/**
 * Vývojárske cheaty na testovanie. Čisté funkcie nad store / simuláciou – žiadny Phaser,
 * aby sa dali otestovať. Spúšťa ich `DevScene` (F9, iba v dev móde alebo s `?debug`).
 */

/** Prepínače, ktoré čítajú herné scény. */
export const devFlags = {
  /** Nesmrteľnosť manažéra v expedícii. */
  god: false,
};

export function grantAll(store: GameStore, amount: number): void {
  const a: ResourceAmounts = {};
  for (const id of RESOURCE_IDS) a[id] = amount;
  store.grant(a);
}

/** Odomkne všetky budovy a typy hriešnikov (a ohlási ich ako pri bežnom postupe). */
export function unlockAll(store: GameStore): void {
  const target: ProgressState = { expeditionsWon: 99, expeditionsLost: 0, kills: 999, deepestFloor: 20, bossesDefeated: 5 };
  const buildingsBefore = BUILDING_TYPES.filter((t) => store.isUnlocked(t));
  const kindsBefore = SINNER_KINDS.filter((k) => store.isKindUnlocked(k));
  const p = store.state.progress;
  p.expeditionsWon = Math.max(p.expeditionsWon, target.expeditionsWon);
  p.kills = Math.max(p.kills, target.kills);
  p.deepestFloor = Math.max(p.deepestFloor, target.deepestFloor);
  p.bossesDefeated = Math.max(p.bossesDefeated, target.bossesDefeated);
  for (const t of BUILDING_TYPES) if (!buildingsBefore.includes(t)) store.events.emit('buildingUnlocked', t);
  for (const k of SINNER_KINDS) if (!kindsBefore.includes(k)) store.events.emit('kindUnlocked', k);
  store.events.emit('notice', { text: 'DEV: všetko odomknuté.', tone: 'info' });
}

/** Všetkých hriešnikov na strop úrovne (aby sa dalo testovať povýšenie a dôchodok). */
export function maxLevelAll(store: GameStore): void {
  for (const s of store.state.sinners) {
    if (s.xp >= MAX_XP) continue;
    s.xp = MAX_XP;
    store.events.emit('levelUp', s);
  }
  store.events.emit('notice', { text: 'DEV: všetci na úrovni 10.', tone: 'info' });
}

export function setFatigueAll(store: GameStore, fatigue: number): void {
  for (const s of store.state.sinners) s.fatigue = Math.min(1, Math.max(0, fatigue));
  store.events.emit('notice', { text: `DEV: únava všetkých ${Math.round(fatigue * 100)} %.`, tone: 'info' });
}

/** Pridá predmet danej rarity do skladu (ak je miesto). */
export function addItem(store: GameStore, rarity: Rarity): boolean {
  if (store.state.inventory.length >= INVENTORY_LIMIT) {
    store.events.emit('notice', { text: 'DEV: sklad je plný.', tone: 'warn' });
    return false;
  }
  const rng = new Rng((store.state.rngSeed ^ store.state.nextId) >>> 0);
  store.addLoot([generateItem(rng, 'dev', { rarity })]);
  return true;
}

/** Splní všetky dnešné kvóty (odmeny treba vyzdvihnúť cez [Q]). */
export function completeQuotas(store: GameStore): void {
  const board = store.state.quotas;
  if (board === null) return;
  for (const e of board.entries) e.progress = e.quota.target;
  store.events.emit('quotasChanged', null);
}

/** Posunie kvóty na nasledujúci deň (séria pokračuje, ak bol bonus vyzdvihnutý). */
export function nextQuotaDay(store: GameStore): void {
  const day = store.state.quotas?.day;
  const base = day === undefined ? new Date() : new Date(`${day}T12:00:00`);
  base.setDate(base.getDate() + 1);
  store.refreshQuotas(dayKey(base));
}

// ---------------------------------------------------------------- expedícia

export function healPlayer(sim: ExpeditionState): void {
  sim.player.hp = sim.player.maxHp;
}

/**
 * Zabije všetkých nepriateľov na poschodí (bez odmien a koristi) – poschodie sa v ďalšom kroku vybaví.
 * Porazený CEO sa započíta (kvôli testovaniu odomknutia právnika).
 */
export function killAll(sim: ExpeditionState): number {
  const alive = aliveEnemies(sim);
  for (const e of alive) {
    e.hp = 0;
    e.phase = 'dead';
    e.phaseMs = CORPSE_MS;
    if (ENEMIES[e.kind].boss !== undefined) sim.bossKills += 1;
  }
  sim.kills += alive.length;
  return alive.length;
}
