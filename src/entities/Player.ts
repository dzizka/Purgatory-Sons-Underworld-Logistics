import type Phaser from 'phaser';
import { punyAnimKey, registerPunyAnims } from '@/entities/punyAnims';
import { facingFromScreen, type Facing } from '@/systems/movement/direction';
import { inputToWorldVelocity, moveWithCollision, type CollisionGrid, type Vec2 } from '@/systems/movement/movement';
import { IsoSprite } from '@/world/IsoSprite';

/** Rýchlosť v obrazovkových pixeloch za sekundu. */
const SPEED_PX = 150;
/** Polomer kolízie v dlaždiciach. */
const RADIUS = 0.28;

/** Stredný manažér. Zatiaľ vie iba chodiť – čo je viac, než zvládne väčšina manažérov. */
export class Player {
  readonly sprite: IsoSprite;
  private readonly shadow: IsoSprite;
  private facing: Facing = 'S';

  constructor(
    scene: Phaser.Scene,
    private readonly grid: CollisionGrid,
    spawn: Vec2,
  ) {
    registerPunyAnims(scene, 'char_player');
    this.shadow = new IsoSprite(scene, 'fx_shadow', spawn, { depthBias: -0.5 });
    this.sprite = new IsoSprite(scene, 'char_player', spawn);
    this.sprite.play(punyAnimKey('char_player', 'idle', this.facing));
  }

  get position(): Vec2 {
    return { x: this.sprite.worldX, y: this.sprite.worldY };
  }

  /** @param dir smer v obrazovkových osiach (-1..1), napr. z klávesnice */
  update(dtMs: number, dir: Vec2): void {
    const facing = facingFromScreen(dir.x, dir.y);
    if (facing === null) {
      this.sprite.play(punyAnimKey('char_player', 'idle', this.facing), true);
      return;
    }
    this.facing = facing;
    this.sprite.play(punyAnimKey('char_player', 'walk', facing), true);

    const vel = inputToWorldVelocity(dir.x, dir.y, SPEED_PX);
    const dt = Math.min(dtMs, 100) / 1000; // pri zaseknutí tabu nechceme teleport
    const next = moveWithCollision(this.grid, this.position, { x: vel.x * dt, y: vel.y * dt }, RADIUS);
    this.sprite.setWorld(next.x, next.y);
    this.shadow.setWorld(next.x, next.y);
  }
}
