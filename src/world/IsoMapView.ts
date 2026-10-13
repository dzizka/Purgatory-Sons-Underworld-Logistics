import Phaser from 'phaser';
import { type AssetKey, type MapTheme, THEMES, variantCount } from '@/assets/manifest';
import { FLOOR_DEPTH, TILE_HEIGHT, TILE_WIDTH } from '@/config/constants';
import { worldToScreen } from '@/core/iso';
import { IsoSprite } from '@/world/IsoSprite';
import { type ParsedMap, type PropPlacement, tileVariant } from '@/world/TileGrid';

const OCCLUDER_ALPHA = 0.35;

/** Vykreslenie mapy: podlaha (statická, pod všetkým) + Y-sortované bloky. */
export class IsoMapView {
  /** Obdĺžnik mapy v obrazovkových pixeloch – pre hranice kamery. */
  readonly bounds: Phaser.Geom.Rectangle;
  /** Bloky, ktoré môžu zakryť postavu – pre priehľadnosť pri prekrytí. */
  readonly occluders: IsoSprite[];

  constructor(scene: Phaser.Scene, map: ParsedMap, theme: MapTheme = THEMES.office) {
    const { grid } = map;
    const propTexture: Readonly<Record<PropPlacement['kind'], AssetKey>> = { wall: theme.wall, pillar: theme.pillar, desk: theme.desk };
    const floorVariants = variantCount(theme.floor);
    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        const kind = grid.get(tx, ty);
        if (kind === 'void') continue;
        const s = worldToScreen({ x: tx, y: ty });
        if (kind === 'elevator') {
          const pad = scene.add.image(s.x, s.y, theme.elevator).setDepth(FLOOR_DEPTH);
          scene.tweens.add({ targets: pad, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });
        } else {
          const tile = scene.add.image(s.x, s.y, theme.floor, tileVariant(tx, ty, floorVariants)).setDepth(FLOOR_DEPTH);
          if (theme.floorTint !== undefined) tile.setTint(theme.floorTint);
        }
      }
    }

    this.occluders = map.props.map((prop) => {
      const key = propTexture[prop.kind];
      const frame = tileVariant(prop.tx, prop.ty, variantCount(key));
      return new IsoSprite(scene, key, { x: prop.tx, y: prop.ty }, { frame });
    });

    const left = worldToScreen({ x: 0, y: grid.height - 1 }).x - TILE_WIDTH / 2;
    const right = worldToScreen({ x: grid.width - 1, y: 0 }).x + TILE_WIDTH / 2;
    const top = worldToScreen({ x: 0, y: 0 }).y - TILE_HEIGHT * 3; // rezerva na vysoké bloky
    const bottom = worldToScreen({ x: grid.width - 1, y: grid.height - 1 }).y + TILE_HEIGHT;
    this.bounds = new Phaser.Geom.Rectangle(left, top, right - left, bottom - top);
  }

  /** Bloky pred postavou, ktoré ju na obrazovke prekrývajú, spriehľadní. */
  fadeOccluders(target: IsoSprite): void {
    // Iba telo postavy (snímka je väčšinou priehľadná), inak by blednul pol mapy.
    const t = new Phaser.Geom.Rectangle(target.x - 10, target.y - 30, 20, 30);
    const r = new Phaser.Geom.Rectangle();
    for (const o of this.occluders) {
      const covers = o.depth > target.depth && Phaser.Geom.Intersects.RectangleToRectangle(t, o.getBounds(r));
      o.setAlpha(covers ? OCCLUDER_ALPHA : 1);
    }
  }
}
