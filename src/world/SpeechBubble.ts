import Phaser from 'phaser';

/** Bubliny sú nad svetom, ale pod HUD (ten má vlastnú scénu). */
const BUBBLE_DEPTH = 920_000;
const PAD_X = 5;
const PAD_Y = 3;

/** Komiksová bublina nad postavou. Sleduje cieľ (sprite), po čase zmizne. */
export class SpeechBubble {
  private readonly container: Phaser.GameObjects.Container;
  private done = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly target: { readonly x: number; readonly y: number; readonly active?: boolean },
    text: string,
    opts: { readonly lift?: number; readonly durationMs?: number; readonly color?: string } = {},
  ) {
    const label = scene.add
      .text(0, 0, text, { fontFamily: 'monospace', fontSize: '9px', color: opts.color ?? '#1a0d12', align: 'center' })
      .setWordWrapWidth(130)
      .setOrigin(0.5, 1)
      .setResolution(2);
    const w = label.width + PAD_X * 2;
    const h = label.height + PAD_Y * 2;
    const g = scene.add.graphics();
    g.fillStyle(0xf3e9dc, 0.95).fillRoundedRect(-w / 2, -h, w, h, 4);
    g.lineStyle(1, 0x2a1418, 1).strokeRoundedRect(-w / 2, -h, w, h, 4);
    // chvostík bubliny
    g.fillStyle(0xf3e9dc, 0.95).fillTriangle(-3, 0, 3, 0, 0, 5);
    label.setY(-PAD_Y);
    this.container = scene.add.container(0, 0, [g, label]).setDepth(BUBBLE_DEPTH);
    this.lift = opts.lift ?? 44;
    this.follow();
    this.container.setScale(0.6).setAlpha(0);
    scene.tweens.add({ targets: this.container, scale: 1, alpha: 1, duration: 140, ease: 'Back.Out' });
    scene.time.delayedCall(opts.durationMs ?? 2600, () => this.dismiss());
  }

  private readonly lift: number;

  get finished(): boolean {
    return this.done;
  }

  /** Volá sa každý snímok – bublina ide za postavou. */
  follow(): void {
    if (this.done) return;
    if (this.target.active === false) {
      this.dismiss();
      return;
    }
    this.container.setPosition(Math.round(this.target.x), Math.round(this.target.y - this.lift));
  }

  dismiss(): void {
    if (this.done) return;
    this.done = true;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: this.container.y - 6,
      duration: 220,
      onComplete: () => this.container.destroy(),
    });
  }
}
