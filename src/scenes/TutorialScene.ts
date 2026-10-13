import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/constants';
import { TUTORIAL } from '@/data/tutorial';
import { session } from '@/state/session';

const CARD = { w: 620, h: 300 } as const;

const style = (size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'monospace',
  fontSize: `${size}px`,
  color,
});

/** Školenie nového zamestnanca – prekrytie nad základňou, ktoré sa dá kedykoľvek preskočiť. */
export class TutorialScene extends Phaser.Scene {
  private index = 0;
  private title!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private pager!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'TutorialScene' });
  }

  create(): void {
    this.index = 0;
    const x = (GAME_WIDTH - CARD.w) / 2;
    const y = (GAME_HEIGHT - CARD.h) / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0, 0).setInteractive();
    this.add.rectangle(x, y, CARD.w, CARD.h, 0xf1ead8, 1).setOrigin(0, 0).setStrokeStyle(3, 0x8b1e2d);
    // „PowerPoint“ hlavička
    this.add.rectangle(x, y, CARD.w, 34, 0x8b1e2d, 1).setOrigin(0, 0);
    this.add.text(x + 14, y + 9, 'ŠKOLENIE NOVÉHO ZAMESTNANCA · Oddelenie ľudských zdrojov', style(12, '#f1ead8'));
    this.title = this.add.text(x + 24, y + 52, '', style(18, '#2a1408'));
    this.body = this.add.text(x + 24, y + 92, '', style(13, '#3a2a20')).setWordWrapWidth(CARD.w - 48).setLineSpacing(8);
    this.pager = this.add.text(x + 24, y + CARD.h - 30, '', style(11, '#7a6a5a'));

    const next = this.add.text(x + CARD.w - 24, y + CARD.h - 34, 'Ďalej ▶', style(14, '#8b1e2d')).setOrigin(1, 0);
    const skip = this.add.text(x + CARD.w - 120, y + CARD.h - 32, 'Preskočiť', style(11, '#7a6a5a')).setOrigin(1, 0);
    next.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.next());
    skip.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.finish());
    this.input.keyboard?.on('keydown-ENTER', () => this.next());
    this.input.keyboard?.on('keydown-SPACE', () => this.next());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.show();
  }

  private show(): void {
    const slide = TUTORIAL[this.index];
    if (slide === undefined) return;
    this.title.setText(slide.title);
    this.body.setText(slide.body.map((l) => `•  ${l}`).join('\n'));
    this.pager.setText(`${this.index + 1} / ${TUTORIAL.length}   (Enter = ďalej, Esc = preskočiť)`);
  }

  private next(): void {
    if (this.index >= TUTORIAL.length - 1) {
      this.finish();
      return;
    }
    this.index += 1;
    this.show();
  }

  private finish(): void {
    session.updateSettings({ tutorialDone: true });
    this.scene.stop();
  }
}
