import Phaser from 'phaser';
import { TILE_HEIGHT, TILE_WIDTH } from '@/config/constants';
import type { PlaceholderSpec } from '@/assets/manifest';

type P = Phaser.Math.Vector2;
const v = (x: number, y: number): P => new Phaser.Math.Vector2(x, y);

function diamond(cx: number, cy: number, hw: number, hh: number): P[] {
  return [v(cx, cy - hh), v(cx + hw, cy), v(cx, cy + hh), v(cx - hw, cy)];
}

/** Vygeneruje textúru `key` z popisu placeholdera (kosoštvorec, izometrický kváder, kapsula…). */
export function generatePlaceholder(scene: Phaser.Scene, key: string, spec: PlaceholderSpec): void {
  const g = scene.make.graphics({}, false);
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  let w: number;
  let h: number;

  switch (spec.kind) {
    case 'tile': {
      w = TILE_WIDTH;
      h = TILE_HEIGHT;
      const pts = diamond(hw, hh, hw, hh);
      g.fillStyle(spec.fill, 1).fillPoints(pts, true);
      g.lineStyle(1, spec.stroke, 1).strokePoints(pts, true);
      break;
    }
    case 'outline': {
      w = TILE_WIDTH;
      h = TILE_HEIGHT;
      const pts = diamond(hw, hh, hw - 1, hh - 1);
      g.fillStyle(spec.color, 0.18).fillPoints(pts, true);
      g.lineStyle(2, spec.color, 1).strokePoints(pts, true);
      break;
    }
    case 'block': {
      w = TILE_WIDTH;
      h = TILE_HEIGHT + spec.height;
      const bw = hw * spec.footprint;
      const bh = hh * spec.footprint;
      const cx = hw;
      const by = h - hh; // stred podstavy
      const ty = by - spec.height; // stred hornej plochy
      g.fillStyle(spec.left, 1).fillPoints([v(cx - bw, by), v(cx, by + bh), v(cx, ty + bh), v(cx - bw, ty)], true);
      g.fillStyle(spec.right, 1).fillPoints([v(cx + bw, by), v(cx, by + bh), v(cx, ty + bh), v(cx + bw, ty)], true);
      const top = diamond(cx, ty, bw, bh);
      g.fillStyle(spec.top, 1).fillPoints(top, true);
      g.lineStyle(1, 0x000000, 0.35).strokePoints(top, true);
      break;
    }
    case 'capsule': {
      w = spec.width + 2;
      h = spec.height + 2;
      const r = spec.width / 2;
      g.fillStyle(spec.outline, 1).fillRoundedRect(0, 0, w, h, r + 1);
      g.fillStyle(spec.fill, 1).fillRoundedRect(1, 1, spec.width, spec.height, r);
      // „kravata“ stredného manažmentu
      g.fillStyle(0x8b1e2d, 1).fillTriangle(w / 2 - 3, h * 0.38, w / 2 + 3, h * 0.38, w / 2, h * 0.7);
      break;
    }
    case 'shadow': {
      w = spec.width;
      h = spec.height;
      g.fillStyle(0x000000, 0.35).fillEllipse(w / 2, h / 2, w, h);
      break;
    }
  }

  g.generateTexture(key, Math.ceil(w), Math.ceil(h));
  g.destroy();
}
