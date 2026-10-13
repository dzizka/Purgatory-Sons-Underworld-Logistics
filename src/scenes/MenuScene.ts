import Phaser from 'phaser';
import { sfx } from '@/audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/constants';
import { session } from '@/state/session';

const style = (size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'monospace',
  fontSize: `${size}px`,
  color,
});

const C = { title: '#e8a33d', item: '#e6d3d8', hover: '#ffd080', dim: '#8a5a66', ok: '#9be37a', bad: '#ff6b6b' } as const;
const NEW_GAME_CONFIRM_MS = 3000;

interface MenuItem {
  readonly label: () => string;
  readonly action: () => void;
  readonly visible?: () => boolean;
}

/** Hlavné menu a pauza (Esc v kancelárii). */
export class MenuScene extends Phaser.Scene {
  private items: Phaser.GameObjects.Text[] = [];
  private status!: Phaser.GameObjects.Text;
  private confirmNewUntil = 0;
  private fileInput: HTMLInputElement | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.items = [];
    this.confirmNewUntil = 0;
    this.sound.mute = session.settings.muted;
    this.drawBackground();

    this.add.text(GAME_WIDTH / 2, 70, 'PURGATORY & LOGISTICS', style(34, C.title)).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 110, 'Oddelenie spracovania duší · stredný manažment', style(13, C.dim))
      .setOrigin(0.5);

    const menu: MenuItem[] = [
      { label: () => '▶ Pokračovať v smene', action: () => this.play(), visible: () => session.hasSave },
      {
        label: () => (Date.now() < this.confirmNewUntil ? 'Naozaj? Všetko sa skartuje. (klik znova)' : 'Nová smena'),
        action: () => this.newGame(),
      },
      { label: () => 'Exportovať uloženú hru (súbor)', action: () => this.exportSave() },
      { label: () => 'Importovať uloženú hru…', action: () => this.importSave() },
      { label: () => `Hudba: ${Math.round(session.settings.musicVolume * 100)} %   [−] [+]`, action: () => undefined },
      { label: () => `Efekty: ${Math.round(session.settings.sfxVolume * 100)} %   [−] [+]`, action: () => undefined },
      {
        label: () => `Zvuk: ${session.settings.muted ? 'vypnutý' : 'zapnutý'}`,
        action: () => session.updateSettings({ muted: !session.settings.muted }),
      },
      {
        label: () => 'Školenie nového zamestnanca (tutoriál)',
        action: () => {
          session.updateSettings({ tutorialDone: false });
          this.play();
        },
      },
    ];

    let y = 170;
    menu.forEach((m, i) => {
      if (m.visible !== undefined && !m.visible()) return;
      const t = this.add.text(GAME_WIDTH / 2, y, m.label(), style(16, C.item)).setOrigin(0.5);
      t.setInteractive({ useHandCursor: true });
      t.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => t.setColor(C.hover));
      t.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => t.setColor(C.item));
      // riadky s hlasitosťou: ľavá polovica −, pravá +
      const volume = i === 4 ? 'musicVolume' : i === 5 ? 'sfxVolume' : null;
      t.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
        sfx(this, 'click');
        if (volume !== null) {
          const step = p.x < t.x ? -0.1 : 0.1;
          const v = Math.round(Math.min(1, Math.max(0, session.settings[volume] + step)) * 10) / 10;
          session.updateSettings({ [volume]: v });
        } else {
          m.action();
        }
        this.refresh(menu);
      });
      t.setData('menu', i);
      this.items.push(t);
      y += 34;
    });

    this.status = this.add.text(GAME_WIDTH / 2, y + 16, '', style(12, C.ok)).setOrigin(0.5).setWordWrapWidth(700).setAlign('center');
    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 24,
        'Grafika a hudba CC0: Screaming Brain Studios (Isometric Stone Soup) · Shade (Puny Characters) · yd (hudba)',
        style(10, C.dim),
      )
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown-ENTER', () => this.play());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (session.hasSave) this.play();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.fileInput?.remove());
    this.cameras.main.fadeIn(250);
  }

  private refresh(menu: readonly MenuItem[]): void {
    for (const t of this.items) {
      const i = t.getData('menu') as number;
      const m = menu[i];
      if (m !== undefined) t.setText(m.label());
    }
  }

  private play(): void {
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('BaseScene'));
  }

  private newGame(): void {
    if (session.hasSave && Date.now() > this.confirmNewUntil) {
      this.confirmNewUntil = Date.now() + NEW_GAME_CONFIRM_MS;
      return;
    }
    session.newGame();
    this.play();
  }

  private exportSave(): void {
    const blob = new Blob([session.exportSave()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `purgatory-logistics-${date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.say('Uložená hra exportovaná. Uschovajte ju v trezore (alebo v Stiahnutých súboroch).', C.ok);
  }

  private importSave(): void {
    this.fileInput?.remove();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file === undefined) return;
      if (file.size > 2_000_000) {
        this.say('Súbor je príliš veľký na uloženú hru.', C.bad);
        return;
      }
      void file.text().then((text) => {
        const r = session.importSave(text);
        if (r.ok) this.play();
        else this.say(r.reason, C.bad);
      });
    });
    document.body.appendChild(input);
    this.fileInput = input;
    input.click();
  }

  private say(text: string, color: string): void {
    this.status.setText(text).setColor(color);
  }

  /** Pozadie: pár dlaždíc kancelárie v tme, nech menu nevisí v prázdnote. */
  private drawBackground(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b0609, 1).setOrigin(0, 0);
    if (!this.textures.exists('tile_floor')) return;
    for (let i = -6; i <= 6; i++)
      for (let j = -6; j <= 6; j++) {
        const x = GAME_WIDTH / 2 + (i - j) * 32;
        const y = GAME_HEIGHT / 2 + 60 + (i + j) * 16;
        const d = Math.hypot(i, j);
        this.add.image(x, y, 'tile_floor', (i * 7 + j * 3 + 20) % 4).setAlpha(Math.max(0, 0.35 - d * 0.05));
      }
  }
}
