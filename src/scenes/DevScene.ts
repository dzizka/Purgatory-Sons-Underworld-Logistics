import Phaser from 'phaser';
import { GAME_HEIGHT } from '@/config/constants';
import type { Rarity } from '@/data/items';
import { addItem, devFlags, grantAll, healPlayer, killAll, maxLevelAll, setFatigueAll, unlockAll } from '@/dev/cheats';
import type { BaseScene } from '@/scenes/BaseScene';
import type { ExpeditionScene } from '@/scenes/ExpeditionScene';
import { session } from '@/state/session';

interface DevAction {
  readonly label: string;
  readonly run: () => void;
}

const FONT = { fontFamily: 'monospace', fontSize: '11px' } as const;
const X = 12;
const W = 270;

/**
 * Vývojárske cheat menu (F9 alebo `). Beží nad všetkými scénami, iba v dev móde alebo s `?debug`.
 * Ponuka sa mení podľa toho, či je hráč na základni alebo v expedícii.
 */
export class DevScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private open = false;
  /** Texty položiek z posledného vykreslenia – prekresľujeme len pri zmene (nie pod kurzorom). */
  private shown = '';

  constructor() {
    super({ key: 'DevScene' });
  }

  create(): void {
    this.panel = this.add.container(0, 0).setVisible(false);
    this.add.text(4, GAME_HEIGHT - 12, 'F9 dev', { ...FONT, fontSize: '9px', color: '#5a3a46' }).setAlpha(0.7);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'F9' || e.key === '`') {
        e.preventDefault();
        this.toggle();
        return;
      }
      if (!this.open) return;
      const n = Number.parseInt(e.key, 10);
      if (e.altKey && n >= 1 && n <= 9) this.actions()[n - 1]?.run();
    });
    // ponuka závisí od scény (základňa / expedícia) – prekreslí sa, keď sa zmení
    this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        if (this.open && this.signature() !== this.shown) this.render();
      },
    });
  }

  private toggle(): void {
    this.open = !this.open;
    this.panel.setVisible(this.open);
    if (this.open) this.render();
    this.scene.bringToTop();
  }

  private actions(): DevAction[] {
    const { store } = session;
    const exp = this.scene.isActive('ExpeditionScene') ? (this.scene.get('ExpeditionScene') as ExpeditionScene) : undefined;
    const base = this.scene.isActive('BaseScene') ? (this.scene.get('BaseScene') as BaseScene) : undefined;
    const item = (r: Rarity, name: string): DevAction => ({ label: `+ predmet: ${name}`, run: () => addItem(store, r) });
    const list: DevAction[] = [
      { label: '+100 všetkých surovín', run: () => grantAll(store, 100) },
      { label: '+1000 všetkých surovín', run: () => grantAll(store, 1000) },
      { label: 'Odomknúť všetko', run: () => unlockAll(store) },
      { label: 'Všetci hriešnici na úroveň 10', run: () => maxLevelAll(store) },
      { label: 'Únava všetkých 0 %', run: () => setFatigueAll(store, 0) },
      { label: 'Únava všetkých 100 % (vyhorenie)', run: () => setFatigueAll(store, 1) },
      item('legendary', 'legendárny'),
      item('cursed', 'prekliaty'),
      { label: 'Simulovať 1 h offline', run: () => session.catchUp(60 * 60 * 1000) },
      { label: `Nesmrteľnosť: ${devFlags.god ? 'ZAP' : 'vyp'}`, run: () => (devFlags.god = !devFlags.god) },
    ];
    if (base !== undefined) {
      for (const depth of [1, 4, 5, 10]) list.push({ label: `Expedícia: poschodie ${depth}${depth % 5 === 0 ? ' (CEO)' : ''}`, run: () => base.depart(depth) });
    }
    if (exp !== undefined) {
      list.push({ label: 'Plné zdravie', run: () => healPlayer(exp.sim) });
      list.push({ label: 'Zabiť všetkých na poschodí', run: () => killAll(exp.sim) });
    }
    list.push({ label: 'Uložiť teraz', run: () => session.save() });
    return list;
  }

  private signature(): string {
    return this.actions()
      .map((a) => a.label)
      .join('|');
  }

  private render(): void {
    this.panel.removeAll(true);
    const actions = this.actions();
    this.shown = actions.map((a) => a.label).join('|');
    const h = 30 + actions.length * 15;
    const top = Math.max(8, (GAME_HEIGHT - h) / 2);
    const bg = this.add.rectangle(X - 6, top - 6, W, h, 0x000000, 0.88).setOrigin(0, 0).setStrokeStyle(1, 0x7da8ff);
    bg.setInteractive().on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      session.uiPointerDownTime = p.downTime;
    });
    this.panel.add(bg);
    this.panel.add(this.add.text(X, top, 'DEV CHEATY · F9 zavrieť · Alt+1–9', { ...FONT, color: '#7da8ff' }));
    actions.forEach((a, i) => {
      const key = i < 9 ? `${i + 1}` : ' ';
      const t = this.add.text(X, top + 18 + i * 15, `${key} ${a.label}`, { ...FONT, color: '#e6d3d8' });
      t.setInteractive({ useHandCursor: true });
      t.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => t.setColor('#e8a33d'));
      t.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => t.setColor('#e6d3d8'));
      t.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
        session.uiPointerDownTime = p.downTime;
        a.run();
        // prekreslenie až po spracovaní kliknutia (nie počas neho)
        this.time.delayedCall(0, () => this.render());
      });
      this.panel.add(t);
    });
  }
}
