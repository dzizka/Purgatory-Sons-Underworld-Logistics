import { EventBus } from '@/core/EventBus';
import type { BuildingType } from '@/data/buildings';
import type { Resources } from '@/data/resources';
import { createInitialState, GameStore } from '@/state/store';

/** Čo práve robí kurzor v hernom svete. */
export type UiMode =
  | { readonly kind: 'idle' }
  | { readonly kind: 'build'; readonly type: BuildingType }
  | { readonly kind: 'assign'; readonly sinnerId: string };

export interface UiEvents {
  modeChanged: UiMode;
  buildingSelected: string | null;
  buildingHovered: string | null;
}

const IDLE: UiMode = { kind: 'idle' };

/**
 * Jedna herná relácia: stav hry + stav UI zdieľaný medzi scénami.
 * (Vo Fáze 6 sa `store` bude vytvárať z uloženého savu.)
 */
class Session {
  readonly store = new GameStore(createInitialState(Math.floor(Math.random() * 2 ** 32)));
  readonly ui = new EventBus<UiEvents>();
  private currentMode: UiMode = IDLE;
  selectedBuilding: string | null = null;
  /** `downTime` posledného kliknutia, ktoré spracovalo UI – herný svet ho ignoruje. */
  uiPointerDownTime = -1;
  /** Stav surovín pri odchode na expedíciu – na súhrn „kým ste boli preč“. */
  departureResources: Resources | null = null;

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
