import Phaser from 'phaser';
import { assetEntry, type AssetKey } from '@/assets/manifest';
import { isoDepth, worldToScreen, type WorldPoint } from '@/core/iso';

/**
 * Obrázok, ktorý žije vo world súradniciach. Pozícia na obrazovke a hĺbka (Y-sort)
 * sa odvodzujú z world pozície – nikdy ich nenastavuj priamo.
 */
export class IsoSprite extends Phaser.GameObjects.Image {
  worldX: number;
  worldY: number;
  worldZ: number;
  /** Jemný posun hĺbky pre objekty na rovnakom mieste (napr. tieň pod postavou). */
  depthBias: number;

  constructor(scene: Phaser.Scene, key: AssetKey, world: WorldPoint, depthBias = 0) {
    super(scene, 0, 0, key);
    const { origin } = assetEntry(key);
    this.setOrigin(origin.x, origin.y);
    this.worldX = world.x;
    this.worldY = world.y;
    this.worldZ = world.z ?? 0;
    this.depthBias = depthBias;
    this.syncToWorld();
    scene.add.existing(this);
  }

  setWorld(x: number, y: number, z = this.worldZ): this {
    this.worldX = x;
    this.worldY = y;
    this.worldZ = z;
    return this.syncToWorld();
  }

  syncToWorld(): this {
    const p = { x: this.worldX, y: this.worldY, z: this.worldZ };
    const s = worldToScreen(p);
    this.setPosition(s.x, s.y);
    // Hĺbka podľa podstavy (z = 0), nie výšky – skok nesmie meniť poradie voči stĺpu.
    this.setDepth(isoDepth({ x: p.x, y: p.y }) + this.depthBias);
    return this;
  }
}
