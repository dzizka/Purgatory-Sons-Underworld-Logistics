import type Phaser from 'phaser';
import { IsoSprite } from '@/world/IsoSprite';
import { inputToWorldVelocity, moveWithCollision, type CollisionGrid, type Vec2 } from '@/systems/movement/movement';

/** Rýchlosť v obrazovkových pixeloch za sekundu. */
const SPEED_PX = 150;
/** Polomer kolízie v dlaždiciach. */
const RADIUS = 0.28;

/** Stredný manažér. Zatiaľ vie iba chodiť – čo je viac, než zvládne väčšina manažérov. */
export class Player {
  readonly sprite: IsoSprite;
  private readonly shadow: IsoSprite;

  constructor(
    scene: Phaser.Scene,
    private readonly grid: CollisionGrid,
    spawn: Vec2,
  ) {
    this.shadow = new IsoSprite(scene, 'fx_shadow', spawn, -0.5);
    this.sprite = new IsoSprite(scene, 'char_player', spawn);
  }

  get position(): Vec2 {
    return { x: this.sprite.worldX, y: this.sprite.worldY };
  }

  /** @param dir smer v obrazovkových osiach (-1..1), napr. z klávesnice */
  update(dtMs: number, dir: Vec2): void {
    const vel = inputToWorldVelocity(dir.x, dir.y, SPEED_PX);
    if (vel.x === 0 && vel.y === 0) return;
    const dt = Math.min(dtMs, 100) / 1000; // pri zaseknutí tabu nechceme teleport
    const next = moveWithCollision(this.grid, this.position, { x: vel.x * dt, y: vel.y * dt }, RADIUS);
    this.sprite.setWorld(next.x, next.y);
    this.shadow.setWorld(next.x, next.y);
    if (dir.x !== 0) this.sprite.setFlipX(dir.x < 0);
  }
}
