import { EventBus } from '@/core/EventBus';
import type { BuildingType } from '@/data/buildings';
import { formatAmounts, type Resources } from '@/data/resources';
import type { GameState } from '@/state/GameState';
import {
  browserStorage,
  DEFAULT_SETTINGS,
  loadFromStorage,
  parseSave,
  serialize,
  type Settings,
  type StorageLike,
  writeToStorage,
} from '@/state/save';
import { createInitialState, GameStore, type GameEvents, type Result } from '@/state/store';
import { applyOffline, formatDuration } from '@/systems/base/offline';

/** Čo práve robí kurzor v hernom svete. */
export type UiMode =
  | { readonly kind: 'idle' }
  | { readonly kind: 'build'; readonly type: BuildingType }
  | { readonly kind: 'assign'; readonly sinnerId: string };

export interface UiEvents {
  modeChanged: UiMode;
  buildingSelected: string | null;
  buildingHovered: string | null;
  settingsChanged: Settings;
}

type Notice = GameEvents['notice'];

const IDLE: UiMode = { kind: 'idle' };
/** Kratšia neprítomnosť nestojí za hlášku. */
const AWAY_REPORT_MIN_MS = 60_000;

const randomSeed = (): number => Math.floor(Math.random() * 2 ** 32);

/**
 * Jedna herná relácia: stav hry (načítaný zo savu), nastavenia a stav UI zdieľaný medzi scénami.
 */
class Session {
  store!: GameStore;
  settings: Settings = { ...DEFAULT_SETTINGS };
  readonly ui = new EventBus<UiEvents>();
  private currentMode: UiMode = IDLE;
  selectedBuilding: string | null = null;
  /** `downTime` posledného kliknutia, ktoré spracovalo UI – herný svet ho ignoruje. */
  uiPointerDownTime = -1;
  /** Stav surovín pri odchode na expedíciu – na súhrn „kým ste boli preč“. */
  departureResources: Resources | null = null;
  /** Existuje uložená hra (pre menu: „Pokračovať“). */
  hasSave = false;
  /** HUD základne beží → hlášky idú rovno doň; inak sa odložia. */
  hudActive = false;
  private pendingNotices: Notice[] = [];
  private offNotice: (() => void) | null = null;
  private readonly storage: StorageLike | null = browserStorage();

  constructor() {
    const loaded = loadFromStorage(this.storage);
    if (loaded.kind === 'ok') {
      this.settings = loaded.save.settings;
      this.setState(loaded.save.state);
      this.hasSave = true;
      if (loaded.migratedFrom !== null) this.queue({ text: `Uložená hra aktualizovaná z verzie ${loaded.migratedFrom}.`, tone: 'info' });
      this.catchUp(Date.now() - loaded.save.savedAt);
    } else {
      this.setState(createInitialState(randomSeed()));
      if (loaded.kind === 'corrupt') {
        this.queue({
          text: `Uložená hra je poškodená (${loaded.reason}). Záloha je odložená, začína sa nová smena.`,
          tone: 'warn',
        });
      }
    }
    if (this.storage === null) {
      this.queue({ text: 'Prehliadač nedovoľuje ukladať (súkromné okno?). Postup sa neuloží.', tone: 'warn' });
    }
  }

  // ---------- ukladanie ----------

  save(): boolean {
    const ok = writeToStorage(this.storage, serialize(this.store.state, this.settings, Date.now()));
    if (ok) this.hasSave = true;
    return ok;
  }

  exportSave(): string {
    return serialize(this.store.state, this.settings, Date.now());
  }

  importSave(json: string): Result {
    const r = parseSave(json);
    if (!r.ok) return { ok: false, reason: `Import zlyhal: ${r.reason}.` };
    this.settings = r.save.settings;
    this.setState(r.save.state);
    this.save();
    this.ui.emit('settingsChanged', this.settings);
    this.queue({ text: 'Uložená hra načítaná zo súboru. Účtovníctvo nič nevidelo.', tone: 'info' });
    return { ok: true };
  }

  newGame(): void {
    this.setState(createInitialState(randomSeed()));
    this.settings = { ...this.settings, tutorialDone: false };
    this.save();
  }

  /** Dopočíta výrobu za čas, keď hra nebežala (zavretá karta, skrytý prehliadač). */
  catchUp(elapsedMs: number): void {
    if (!(elapsedMs > 1000)) return;
    const r = applyOffline(this.store.state, elapsedMs);
    this.store.events.emit('resourcesChanged', this.store.state.resources);
    if (elapsedMs < AWAY_REPORT_MIN_MS) return;
    const what = Object.keys(r.produced).length === 0 ? 'nič (nikto nebol pridelený)' : formatAmounts(r.produced);
    const cap = r.capped ? ' Nadčasy nad 8 h sa neprepláca.' : '';
    this.queue({ text: `Kým ste boli preč (${formatDuration(elapsedMs)}), základňa vyrobila: ${what}.${cap}`, tone: 'info' });
  }

  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.ui.emit('settingsChanged', this.settings);
    this.save();
  }

  // ---------- hlášky ----------

  /** HUD si pri štarte vyzdvihne hlášky, ktoré prišli, keď nebežal. */
  takePendingNotices(): Notice[] {
    const out = this.pendingNotices;
    this.pendingNotices = [];
    return out;
  }

  private queue(n: Notice): void {
    if (this.hudActive) this.store.events.emit('notice', n);
    else this.pendingNotices.push(n);
  }

  private setState(state: GameState): void {
    this.offNotice?.();
    this.store = new GameStore(state);
    this.offNotice = this.store.events.on('notice', (n) => {
      if (!this.hudActive) this.pendingNotices.push(n);
    });
    this.currentMode = IDLE;
    this.selectedBuilding = null;
    this.departureResources = null;
  }

  // ---------- UI režim ----------

  get mode(): UiMode {
    return this.currentMode;
  }

  setMode(mode: UiMode): void {
    this.currentMode = mode;
    this.ui.emit('modeChanged', mode);
  }

  resetMode(): void {
    if (this.currentMode.kind !== 'idle') this.setMode(IDLE);
  }

  selectBuilding(id: string | null): void {
    this.selectedBuilding = id;
    this.ui.emit('buildingSelected', id);
  }
}

export const session = new Session();
