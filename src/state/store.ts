import { EventBus } from '@/core/EventBus';
import { Rng } from '@/core/rng';
import { BUILDINGS, type BuildingType } from '@/data/buildings';
import { canAfford, formatAmounts, spend, type Resources } from '@/data/resources';
import type { BuildingState, GameState, SinnerState } from '@/state/GameState';
import { tickProduction, workersOf } from '@/systems/base/production';
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

  build(type: BuildingType, tx: number, ty: number): Result {
    const def = BUILDINGS[type];
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
