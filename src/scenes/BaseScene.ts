import Phaser from 'phaser';
import { AUDIO } from '@/assets/manifest';
import { FLOOR_DEPTH } from '@/config/constants';
import { screenToWorld, worldToScreen } from '@/core/iso';
import { Player } from '@/entities/Player';
import { IsoMapView } from '@/world/IsoMapView';
import { PROCESSING_OFFICE } from '@/world/maps';
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
}

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3;

interface MoveKeys {
  readonly up: Phaser.Input.Keyboard.Key[];
  readonly down: Phaser.Input.Keyboard.Key[];
  readonly left: Phaser.Input.Keyboard.Key[];
  readonly right: Phaser.Input.Keyboard.Key[];
}

/** Základňa – zatiaľ iba mapa kancelárie, po ktorej sa dá chodiť. */
export class BaseScene extends Phaser.Scene {
  private grid!: TileGrid;
  private player!: Player;
  private highlight!: Phaser.GameObjects.Image;
  private keys!: MoveKeys;
  private view!: IsoMapView;

  constructor() {
    super({ key: 'BaseScene' });
  }

  create(): void {
    const map = parseMap(PROCESSING_OFFICE);
    this.grid = map.grid;
    const view = new IsoMapView(this, map);
    this.view = view;

    // tesne nad podlahou, pod všetkými Y-sortovanými objektmi
    this.highlight = this.add.image(0, 0, 'tile_highlight').setDepth(FLOOR_DEPTH + 1).setVisible(false);

    this.player = new Player(this, this.grid, map.spawn);

    const cam = this.cameras.main;
    cam.setBounds(view.bounds.x, view.bounds.y, view.bounds.width, view.bounds.height);
    cam.startFollow(this.player.sprite, true, 0.15, 0.15);
    cam.setZoom(1.5);

    this.keys = this.createKeys();
    this.bindPointer();
    this.startMusic();
  }

  private startMusic(): void {
    // Prehliadač pustí zvuk až po prvej interakcii – Phaser ho odomkne sám.
    if (!this.cache.audio.exists('music_base')) return;
    const music = this.sound.add('music_base', { loop: true, volume: AUDIO.music_base.volume });
    music.play();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => music.destroy());
    this.input.keyboard?.on('keydown-M', () => {
      this.sound.mute = !this.sound.mute;
    });
  }

  override update(_time: number, delta: number): void {
    const held = (ks: readonly Phaser.Input.Keyboard.Key[]): number => (ks.some((k) => k.isDown) ? 1 : 0);
    const dir = {
      x: held(this.keys.right) - held(this.keys.left),
      y: held(this.keys.down) - held(this.keys.up),
    };
    this.player.update(delta, dir);
    this.view.fadeOccluders(this.player.sprite);
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
    };
  }

  private bindPointer(): void {
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      const info = this.tileUnder(pointer);
      if (info === null) {
        this.highlight.setVisible(false);
        return;
      }
      const s = worldToScreen({ x: info.tx, y: info.ty });
      this.highlight.setVisible(true).setPosition(s.x, s.y);
      this.events.emit(BASE_EVENTS.tileHover, info);
    });

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const info = this.tileUnder(pointer);
      if (info !== null) this.events.emit(BASE_EVENTS.tileSelect, info);
    });

    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _over: unknown[], _dx: number, dy: number) => {
        const cam = this.cameras.main;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM));
      },
    );
  }

  private tileUnder(pointer: Phaser.Input.Pointer): TileInfo | null {
    pointer.updateWorldPoint(this.cameras.main);
    const w = screenToWorld({ x: pointer.worldX, y: pointer.worldY });
    const { tx, ty } = TileGrid.tileAt(w.x, w.y);
    const kind = this.grid.get(tx, ty);
    if (kind === 'void') return null;
    return { tx, ty, kind, walkable: !this.grid.isBlocked(tx, ty) };
  }
}
