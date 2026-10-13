import type Phaser from 'phaser';
import { SINNER_TEXTURES } from '@/assets/manifest';
import { punyAnimKey, registerPunyAnims, type PunyClip } from '@/entities/punyAnims';
import { worldToScreen } from '@/core/iso';
import type { SinnerState } from '@/state/GameState';
import { facingFromScreen, type Facing } from '@/systems/movement/direction';
import type { Vec2 } from '@/systems/movement/movement';
import { IsoSprite } from '@/world/IsoSprite';

/** Rýchlosť presunu v dlaždiciach za sekundu. Hriešnici sa nikam neponáhľajú. */
const WALK_TILES_PER_S = 2.2;

/** Hriešnik vo svete. Nemá kolízie – presúva sa tweenom na pridelené miesto. */
export class SinnerView {
  readonly sprite: IsoSprite;
  private readonly shadow: IsoSprite;
  private readonly texture: (typeof SINNER_TEXTURES)[number];
  private tween: Phaser.Tweens.Tween | null = null;
  private facing: Facing = 'S';

  constructor(
    private readonly scene: Phaser.Scene,
    readonly sinner: SinnerState,
    at: Vec2,
  ) {
    this.texture = SINNER_TEXTURES[sinner.look % SINNER_TEXTURES.length] ?? 'char_sinner_0';
    registerPunyAnims(scene, this.texture);
    this.shadow = new IsoSprite(scene, 'fx_shadow', at, { depthBias: -0.5 });
    this.sprite = new IsoSprite(scene, this.texture, at);
    this.sprite.setInteractive({ useHandCursor: true, pixelPerfect: true });
    this.play('idle');
  }

  /** Dôjde na miesto; po príchode sa otočí k `lookAt` a začne pracovať (ak `working`). */
  goTo(target: Vec2, lookAt: Vec2 | null, working: boolean): void {
    this.tween?.stop();
    const from = { x: this.sprite.worldX, y: this.sprite.worldY };
    const dist = Math.hypot(target.x - from.x, target.y - from.y);
    const finish = (): void => {
      if (lookAt !== null) this.face(lookAt);
      this.play(working ? 'work' : 'idle');
    };
    if (dist < 0.01) {
      finish();
      return;
    }
    this.face(target);
    this.play('walk');
    const pos = { ...from };
    this.tween = this.scene.tweens.add({
      targets: pos,
      x: target.x,
      y: target.y,
      duration: (dist / WALK_TILES_PER_S) * 1000,
      onUpdate: () => {
        this.sprite.setWorld(pos.x, pos.y);
        this.shadow.setWorld(pos.x, pos.y);
      },
      onComplete: finish,
    });
  }

  setSelected(selected: boolean): void {
    this.sprite.setTint(selected ? 0xffe08a : 0xffffff);
  }

  destroy(): void {
    this.tween?.stop();
    this.sprite.destroy();
    this.shadow.destroy();
  }

  private face(target: Vec2): void {
    const a = worldToScreen({ x: this.sprite.worldX, y: this.sprite.worldY });
    const b = worldToScreen(target);
    this.facing = facingFromScreen(b.x - a.x, b.y - a.y) ?? this.facing;
  }

  private play(clip: PunyClip): void {
    this.sprite.play(punyAnimKey(this.texture, clip, this.facing), true);
  }
}
