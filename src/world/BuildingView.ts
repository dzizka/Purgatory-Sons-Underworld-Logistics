import type Phaser from 'phaser';
import { BUILDING_TEXTURE } from '@/assets/manifest';
import type { BuildingState } from '@/state/GameState';
import { IsoSprite } from '@/world/IsoSprite';

const BAR_W = 36;
const BAR_H = 4;
/** Ukazovatele postupu sú nad všetkým svetom (sú to vlastne UI). */
const BAR_DEPTH = 900_000;

const STATUS_COLOR = { idle: 0x6b6b6b, working: 0xe8a33d, blocked: 0xd03030 } as const;

/** Budova vo svete: blok + ukazovateľ postupu cyklu. */
export class BuildingView {
  readonly sprite: IsoSprite;
  private readonly bar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    readonly building: BuildingState,
  ) {
    this.sprite = new IsoSprite(scene, BUILDING_TEXTURE[building.type], { x: building.tx, y: building.ty });
    this.bar = scene.add.graphics().setDepth(BAR_DEPTH);
    this.update();
  }

  update(selected = false): void {
    const b = this.building;
    const x = this.sprite.x - BAR_W / 2;
    const y = this.sprite.y - 44;
    this.bar.clear();
    this.bar.fillStyle(0x000000, 0.6).fillRect(x - 1, y - 1, BAR_W + 2, BAR_H + 2);
    this.bar.fillStyle(STATUS_COLOR[b.status], 1).fillRect(x, y, BAR_W * Math.min(1, b.progress), BAR_H);
    if (selected) this.bar.lineStyle(1, 0xffe08a, 1).strokeRect(x - 2, y - 2, BAR_W + 4, BAR_H + 4);
    this.sprite.setTint(selected ? 0xffe8b0 : 0xffffff);
  }
}
