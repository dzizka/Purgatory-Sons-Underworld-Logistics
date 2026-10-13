import Phaser from 'phaser';
import { playMusic, toggleMute } from '@/audio/music';
import { sfx } from '@/audio/sfx';
import { FLOOR_DEPTH } from '@/config/constants';
import { screenToWorld, worldToScreen } from '@/core/iso';
import { BUILDINGS } from '@/data/buildings';
import { RARITIES, RARITY } from '@/data/items';
import type { ExpeditionOutcome } from '@/scenes/ExpeditionScene';
import { formatAmounts, RESOURCE_IDS, type ResourceAmounts } from '@/data/resources';
import { Player } from '@/entities/Player';
import { SinnerView } from '@/entities/SinnerView';
import type { BuildingState } from '@/state/GameState';
import { session } from '@/state/session';
import { leadOf, workersOf } from '@/systems/base/production';
import { itemName } from '@/systems/loot/loot';
import { workerSlots } from '@/systems/base/slots';
import type { CollisionGrid } from '@/systems/movement/movement';
import { BuildingView } from '@/world/BuildingView';
import { IsoMapView } from '@/world/IsoMapView';
import { BASE_ELEVATOR_ARRIVAL, inLounge, LOUNGE_SPOTS, PROCESSING_OFFICE } from '@/world/maps';
import { parseMap, TileGrid, type TileKind } from '@/world/TileGrid';

export const BASE_EVENTS = {
  tileHover: 'base:tile-hover',
  tileSelect: 'base:tile-select',
} as const;

export interface TileInfo {
  readonly tx: number;
  readonly ty: number;
  readonly kind: TileKind;
  readonly walkable: boolean;
  readonly buildingId: string | null;
}

/** Dáta pri štarte scény – návrat z expedície pristane pri výťahu. */
export interface BaseSceneData {
  readonly from?: 'expedition';
  readonly outcome?: ExpeditionOutcome;
}

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3;
const HIGHLIGHT_OK = 0x7dff7d;
const HIGHLIGHT_BAD = 0xff5050;

interface MoveKeys {
  readonly up: Phaser.Input.Keyboard.Key[];
  readonly down: Phaser.Input.Keyboard.Key[];
  readonly left: Phaser.Input.Keyboard.Key[];
  readonly right: Phaser.Input.Keyboard.Key[];
  readonly use: Phaser.Input.Keyboard.Key;
}

/** Základňa: kancelária, po ktorej chodí manažér, stavia budovy a prideľuje hriešnikov. */
export class BaseScene extends Phaser.Scene {
  private grid!: TileGrid;
  private collision!: CollisionGrid;
  private player!: Player;
  private highlight!: Phaser.GameObjects.Image;
  private keys!: MoveKeys;
  private view!: IsoMapView;
  private readonly buildingViews = new Map<string, BuildingView>();
  private readonly sinnerViews = new Map<string, SinnerView>();
  private hoverTile: { tx: number; ty: number } | null = null;
  private elevatorTiles = new Set<string>();
  private wasOnElevator = false;
  private departing = false;

  constructor() {
    super({ key: 'BaseScene' });
  }

  create(data: BaseSceneData = {}): void {
    this.buildingViews.clear();
    this.sinnerViews.clear();
    this.departing = false;
    const map = parseMap(PROCESSING_OFFICE);
    this.grid = map.grid;
    this.elevatorTiles = new Set(map.elevators.map((e) => `${e.tx},${e.ty}`));
    const { store } = session;
    // Budovy sú prekážky rovnako ako steny.
    this.collision = {
      isBlocked: (tx, ty) => this.grid.isBlocked(tx, ty) || store.buildingAt(tx, ty) !== undefined,
    };
    this.view = new IsoMapView(this, map);

    // tesne nad podlahou, pod všetkými Y-sortovanými objektmi
    this.highlight = this.add.image(0, 0, 'tile_highlight').setDepth(FLOOR_DEPTH + 1).setVisible(false);

    const back = data.from === 'expedition';
    this.player = new Player(this, this.collision, back ? BASE_ELEVATOR_ARRIVAL : map.spawn);
    this.wasOnElevator = false;

    const cam = this.cameras.main;
    cam.setBounds(this.view.bounds.x, this.view.bounds.y, this.view.bounds.width, this.view.bounds.height);
    cam.startFollow(this.player.sprite, true, 0.15, 0.15);
    cam.setZoom(1.5);

    for (const b of store.state.buildings) this.addBuildingView(b);
    for (const s of store.state.sinners) this.sinnerViews.set(s.id, this.makeSinnerView(s.id));
    this.layoutSinners();

    const offs = [
      store.events.on('buildingBuilt', (b) => {
        this.addBuildingView(b);
        this.layoutSinners(); // nová budova mohla zabrať miesto, kde niekto stál
      }),
      store.events.on('sinnerHired', (s) => {
        this.sinnerViews.set(s.id, this.makeSinnerView(s.id));
        this.layoutSinners();
      }),
      store.events.on('sinnerAssigned', () => this.layoutSinners()),
      store.events.on('careerChanged', () => this.layoutSinners()),
      store.events.on('sinnerRetired', (s) => {
        this.sinnerViews.get(s.id)?.destroy();
        this.sinnerViews.delete(s.id);
        const m = session.mode;
        if (m.kind === 'assign' && m.sinnerId === s.id) session.resetMode();
        this.layoutSinners();
      }),
      session.ui.on('modeChanged', () => this.refreshSelection()),
      session.ui.on('buildingSelected', () => this.refreshSelection()),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));

    this.keys = this.createKeys();
    this.bindPointer();
    this.startMusic();
    this.scene.launch('UIScene');
    if (!session.settings.tutorialDone) this.scene.launch('TutorialScene');
    this.cameras.main.fadeIn(250);
    const outcome = data.outcome;
    if (back && outcome !== undefined) this.time.delayedCall(400, () => this.reportReturn(outcome));
  }

  /** Výsledok expedície + Zeigarnik v praxi: čo základňa vyrobila, kým bol manažér preč. */
  private reportReturn(outcome: ExpeditionOutcome): void {
    const { events } = session.store;
    if (outcome.result === 'won') {
      events.emit('notice', {
        text: `Expedícia ukončená na poschodí ${outcome.depth}. Vybavené reklamácie: ${outcome.kills}. Odmena: ${formatAmounts(outcome.rewards)}.`,
        tone: 'info',
      });
      if (outcome.loot.length > 0) {
        const best = [...outcome.loot].sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity))[0];
        const bestText = best === undefined ? '' : ` Najlepší: [${RARITY[best.rarity].name}] ${itemName(best)}.`;
        events.emit('notice', { text: `Nové predmety v sklade: ${outcome.loot.length} (I = sklad).${bestText}`, tone: 'info' });
      }
    } else {
      const lost = outcome.loot.length > 0 ? ` a ${outcome.loot.length} predmetov` : '';
      events.emit('notice', {
        text: `Disciplinárne konanie. Korisť (${formatAmounts(outcome.rewards)}${lost}) skonfiškovaná v prospech vedenia.`,
        tone: 'warn',
      });
    }
    const before = session.departureResources;
    session.departureResources = null;
    if (before === null) return;
    const granted: ResourceAmounts = outcome.result === 'won' ? outcome.rewards : {};
    const now = session.store.state.resources;
    const produced: ResourceAmounts = {};
    for (const id of RESOURCE_IDS) {
      const d = Math.floor(now[id] - before[id] - (granted[id] ?? 0));
      if (d > 0) produced[id] = d;
    }
    if (Object.keys(produced).length > 0) {
      events.emit('notice', { text: `Kým ste boli preč, základňa vyrobila: ${formatAmounts(produced)}.`, tone: 'info' });
    }
  }

  private get onElevator(): boolean {
    const p = this.player.position;
    return this.elevatorTiles.has(`${Math.round(p.x)},${Math.round(p.y)}`);
  }

  private depart(): void {
    if (this.departing) return;
    this.departing = true;
    session.save();
    session.resetMode();
    session.selectBuilding(null);
    session.departureResources = { ...session.store.state.resources };
    this.cameras.main.fadeOut(300);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('UIScene');
      this.scene.start('ExpeditionScene');
    });
  }

  override update(_time: number, delta: number): void {
    const held = (ks: readonly Phaser.Input.Keyboard.Key[]): number => (ks.some((k) => k.isDown) ? 1 : 0);
    const dir = {
      x: held(this.keys.right) - held(this.keys.left),
      y: held(this.keys.down) - held(this.keys.up),
    };
    if (!this.departing) this.player.update(delta, dir);
    this.view.fadeOccluders(this.player.sprite);
    const on = this.onElevator;
    if (on && !this.wasOnElevator) {
      session.store.events.emit('notice', { text: 'Služobný výťah do Oddelenia reklamácií. E = nastúpiť.', tone: 'info' });
    }
    this.wasOnElevator = on;
    if (on && Phaser.Input.Keyboard.JustDown(this.keys.use)) this.depart();
    for (const v of this.buildingViews.values()) v.update(v.building.id === session.selectedBuilding);
    this.updateHighlight();
  }

  private addBuildingView(b: BuildingState): void {
    const v = new BuildingView(this, b);
    this.buildingViews.set(b.id, v);
    this.view.occluders.push(v.sprite);
    // Blok presahuje svoju dlaždicu – klik naň musí trafiť budovu, nie dlaždicu za ňou.
    v.sprite.setInteractive({ pixelPerfect: true, useHandCursor: true });
    v.sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.downTime === session.uiPointerDownTime || pointer.rightButtonDown()) return;
      const info = { tx: b.tx, ty: b.ty, kind: 'floor', walkable: false, buildingId: b.id } as const;
      this.handleClick(info, pointer.event.shiftKey);
    });
  }

  private makeSinnerView(id: string): SinnerView {
    const s = session.store.sinner(id);
    if (s === undefined) throw new Error(`BaseScene: hriešnik ${id} neexistuje`);
    const spawn = LOUNGE_SPOTS[0] ?? { x: 8, y: 12 };
    const v = new SinnerView(this, s, spawn);
    v.sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.downTime === session.uiPointerDownTime) return;
      const m = session.mode;
      session.setMode(m.kind === 'assign' && m.sinnerId === id ? { kind: 'idle' } : { kind: 'assign', sinnerId: id });
    });
    return v;
  }

  /** Pošle každého hriešnika na jeho miesto: k budove, alebo do čakárne. */
  private layoutSinners(): void {
    const { state } = session.store;
    let lounge = 0;
    for (const s of state.sinners) {
      const v = this.sinnerViews.get(s.id);
      if (v === undefined) continue;
      const b = s.assignedTo === null ? undefined : session.store.building(s.assignedTo);
      if (b === undefined) {
        const spot = LOUNGE_SPOTS[lounge++ % LOUNGE_SPOTS.length] ?? { x: 8, y: 12 };
        v.goTo(spot, null, false);
        continue;
      }
      // vedúci stojí na poslednom mieste a len sa díva (deleguje)
      const lead = leadOf(state, b.id);
      const crew = [...workersOf(state, b.id), ...(lead === undefined ? [] : [lead])];
      const slots = workerSlots(b.tx, b.ty, crew.length, (tx, ty) => !this.collision.isBlocked(tx, ty));
      const slot = slots[crew.indexOf(s)] ?? { x: b.tx + 0.6, y: b.ty + 0.6 };
      v.goTo(slot, { x: b.tx, y: b.ty }, s.role === 'worker');
    }
    this.refreshSelection();
  }

  private refreshSelection(): void {
    const m = session.mode;
    for (const [id, v] of this.sinnerViews) v.setSelected(m.kind === 'assign' && m.sinnerId === id);
  }

  /** Dá sa na dlaždicu postaviť? Vráti dôvod, ak nie. */
  private placementProblem(tx: number, ty: number): string | null {
    if (this.grid.get(tx, ty) !== 'floor') return 'Na nábytok a steny sa nestavia. Ani v pekle.';
    if (session.store.buildingAt(tx, ty) !== undefined) return 'Tu už niečo stojí.';
    if (inLounge(tx, ty)) return 'Čakáreň je chránená zóna. Odbory by nás roztrhali.';
    const p = this.player.position;
    if (Math.abs(p.x - tx) < 0.85 && Math.abs(p.y - ty) < 0.85) return 'Nestavajte si budovu na hlavu. Ustúpte.';
    return null;
  }

  private updateHighlight(): void {
    const t = this.hoverTile;
    if (t === null) {
      this.highlight.setVisible(false);
      return;
    }
    const s = worldToScreen({ x: t.tx, y: t.ty });
    this.highlight.setVisible(true).setPosition(s.x, s.y);
    const m = session.mode;
    if (m.kind === 'build') this.highlight.setTint(this.placementProblem(t.tx, t.ty) === null ? HIGHLIGHT_OK : HIGHLIGHT_BAD);
    else this.highlight.clearTint();
  }

  private handleClick(info: TileInfo, shift: boolean): void {
    const { store } = session;
    const m = session.mode;
    const notice = (text: string): void => store.events.emit('notice', { text, tone: 'warn' });

    if (m.kind === 'build') {
      const problem = this.placementProblem(info.tx, info.ty);
      if (problem !== null) return notice(problem);
      const r = store.build(m.type, info.tx, info.ty);
      if (!r.ok) return notice(r.reason);
      sfx(this, 'build');
      store.events.emit('notice', { text: `Stavba „${BUILDINGS[m.type].name}“ dokončená. Kolaudácia o 300 rokov.`, tone: 'info' });
      if (!shift) session.resetMode();
      session.selectBuilding(store.buildingAt(info.tx, info.ty)?.id ?? null);
      return;
    }

    if (m.kind === 'assign') {
      if (info.buildingId !== null) {
        const r = store.assign(m.sinnerId, info.buildingId);
        if (!r.ok) return notice(r.reason);
        session.selectBuilding(info.buildingId);
      }
      session.resetMode();
      return;
    }

    session.selectBuilding(info.buildingId);
    this.events.emit(BASE_EVENTS.tileSelect, info);
  }

  private startMusic(): void {
    // Prehliadač pustí zvuk až po prvej interakcii – Phaser ho odomkne sám.
    playMusic(this, 'music_base');
    this.input.keyboard?.on('keydown-M', () => toggleMute());
  }

  /** Esc v kancelárii: uložiť a do menu. */
  openMenu(): void {
    if (this.departing || this.scene.isActive('TutorialScene')) return;
    this.departing = true;
    session.save();
    this.cameras.main.fadeOut(200);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('UIScene');
      this.scene.start('MenuScene');
    });
  }

  private createKeys(): MoveKeys {
    const kb = this.input.keyboard;
    if (kb === null) throw new Error('BaseScene: klávesnica nie je dostupná');
    const K = Phaser.Input.Keyboard.KeyCodes;
    const add = (...codes: number[]): Phaser.Input.Keyboard.Key[] => codes.map((c) => kb.addKey(c));
    return {
      up: add(K.W, K.UP),
      down: add(K.S, K.DOWN),
      left: add(K.A, K.LEFT),
      right: add(K.D, K.RIGHT),
      use: kb.addKey(K.E),
    };
  }

  private bindPointer(): void {
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      const info = this.tileUnder(pointer);
      this.hoverTile = info;
      if (info !== null) this.events.emit(BASE_EVENTS.tileHover, info);
      session.ui.emit('buildingHovered', info?.buildingId ?? null);
    });

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // Klik spracovaný HUD-om alebo na hriešnika (ten má vlastný handler) svet ignoruje.
      if (pointer.downTime === session.uiPointerDownTime || over.length > 0) return;
      if (pointer.rightButtonDown()) {
        session.resetMode();
        return;
      }
      const info = this.tileUnder(pointer);
      if (info === null) {
        session.resetMode();
        session.selectBuilding(null);
        return;
      }
      this.handleClick(info, pointer.event.shiftKey);
    });

    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _over: unknown[], _dx: number, dy: number) => {
        const cam = this.cameras.main;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM));
      },
    );
    this.input.mouse?.disableContextMenu();
  }

  private tileUnder(pointer: Phaser.Input.Pointer): TileInfo | null {
    pointer.updateWorldPoint(this.cameras.main);
    const w = screenToWorld({ x: pointer.worldX, y: pointer.worldY });
    const { tx, ty } = TileGrid.tileAt(w.x, w.y);
    const kind = this.grid.get(tx, ty);
    if (kind === 'void') return null;
    const buildingId = session.store.buildingAt(tx, ty)?.id ?? null;
    return { tx, ty, kind, walkable: !this.collision.isBlocked(tx, ty), buildingId };
  }
}
