import Phaser from 'phaser';
import { COLORS, TILE_HEIGHT, TILE_WIDTH } from '@/config/constants';
import { isoDepth, worldToScreen } from '@/core/iso';

const GRID_SIZE = 10;

/**
 * Fáza 1: dôkaz, že canvas, izometrická matematika a Y-sorting fungujú.
 * Neskôr sa z nej stane preloader, ktorý predá štafetu BaseScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const origin = this.add.container(this.scale.width / 2, this.scale.height / 2 - (GRID_SIZE * TILE_HEIGHT) / 2);

    const floor = this.add.graphics();
    for (let wx = 0; wx < GRID_SIZE; wx++) {
      for (let wy = 0; wy < GRID_SIZE; wy++) {
        this.drawTile(floor, wx, wy, (wx + wy) % 2 === 0 ? COLORS.tileFill : COLORS.tileFillAlt);
      }
    }
    origin.add(floor);

    // Zástupný „hriešnik“ – placeholder tvar, kým nemáme CC0 sprite.
    const pos = { x: GRID_SIZE / 2, y: GRID_SIZE / 2, z: 0 };
    const sinner = this.add.ellipse(0, 0, 18, 30, COLORS.accent);
    sinner.setOrigin(0.5, 1);
    origin.add(sinner);

    this.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 4000,
      repeat: -1,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const p = { x: pos.x + Math.cos(t) * 3, y: pos.y + Math.sin(t) * 3, z: Math.abs(Math.sin(t * 4)) * 6 };
        const s = worldToScreen(p);
        sinner.setPosition(s.x, s.y);
        sinner.setDepth(isoDepth(p));
      },
    });

    this.add
      .text(16, 16, 'PURGATORY & LOGISTICS\nOddelenie spracovania duší – Fáza 1', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#e8a33d',
      })
      .setScrollFactor(0);

    this.add
      .text(16, this.scale.height - 28, 'Formulár 66-B: Žiadosť o podanie žiadosti. Čakacia doba: večnosť.', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#8a5a66',
      })
      .setScrollFactor(0);
  }

  private drawTile(g: Phaser.GameObjects.Graphics, wx: number, wy: number, fill: number): void {
    const c = worldToScreen({ x: wx, y: wy });
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    const points = [
      new Phaser.Math.Vector2(c.x, c.y - hh),
      new Phaser.Math.Vector2(c.x + hw, c.y),
      new Phaser.Math.Vector2(c.x, c.y + hh),
      new Phaser.Math.Vector2(c.x - hw, c.y),
    ];
    g.fillStyle(fill, 1);
    g.fillPoints(points, true);
    g.lineStyle(1, COLORS.tileStroke, 1);
    g.strokePoints(points, true);
  }
}
