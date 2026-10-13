import Phaser from 'phaser';
import { BASE_ITEMS, INVENTORY_LIMIT, type Item, type ItemSlot, RARITY } from '@/data/items';
import { session } from '@/state/session';
import { describeMods, itemName, type Loadout, resolveLoadout } from '@/systems/loot/loot';

const SLOT_LABEL: Readonly<Record<ItemSlot, string>> = { melee: 'Úder', ranged: 'Strela', trinket: 'Talizman' };
const PANEL = { x: 120, y: 54, w: 572, h: 400 } as const;
const ROW = 18;
const MAX_NAME = 46;

const style = (size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'monospace',
  fontSize: `${size}px`,
  color,
});

const shorten = (s: string): string => (s.length > MAX_NAME ? `${s.slice(0, MAX_NAME - 1)}…` : s);

/** Rozdiel dvoch čísel pre porovnanie: „12 → 18 (+6)“. Pri cooldowne je lepšie menej. */
function delta(label: string, a: number, b: number, lowerIsBetter = false, digits = 0): string | null {
  const r = (v: number): number => Math.round(v * 10 ** digits) / 10 ** digits;
  if (r(a) === r(b)) return null;
  const better = lowerIsBetter ? b < a : b > a;
  const sign = b > a ? '+' : '−';
  return `${label} ${r(a)} → ${r(b)} (${sign}${r(Math.abs(b - a))})${better ? ' ▲' : ' ▼'}`;
}

/** Sklad a výbava: klik = nasadiť, pravé tlačidlo = skartovať. */
export class InventoryPanel {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dynamic: Phaser.GameObjects.Container;
  private readonly details: Phaser.GameObjects.Text;
  private open = false;

  constructor(private readonly scene: Phaser.Scene) {
    const bg = scene.add.rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 0x0e070b, 0.96).setOrigin(0, 0).setStrokeStyle(1, 0x6b2f3f);
    bg.setInteractive();
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      session.uiPointerDownTime = p.downTime;
    });
    const title = scene.add.text(PANEL.x + 12, PANEL.y + 8, 'SKLAD A VÝBAVA', style(13, '#e8a33d'));
    const help = scene.add
      .text(PANEL.x + PANEL.w - 12, PANEL.y + 10, 'klik = nasadiť · pravé tl. = skartovať · I = zavrieť', style(10, '#8a5a66'))
      .setOrigin(1, 0);
    this.details = scene.add.text(PANEL.x + 12, PANEL.y + PANEL.h - 92, '', style(10, '#c9a0a8')).setWordWrapWidth(PANEL.w - 24).setLineSpacing(2);
    this.dynamic = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [bg, title, help, this.details, this.dynamic]).setDepth(100).setVisible(false);

    const { events } = session.store;
    const off = events.on('inventoryChanged', () => {
      if (this.open) this.render();
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    this.open = !this.open;
    this.root.setVisible(this.open);
    if (this.open) this.render();
  }

  private render(): void {
    this.dynamic.removeAll(true);
    this.details.setText('Prejdite myšou nad predmet pre porovnanie s tým, čo máte na sebe.');
    const { store } = session;
    const { state } = store;
    const x0 = PANEL.x + 12;
    const x1 = PANEL.x + 262;
    let y = PANEL.y + 34;

    // --- výbava ---
    this.dynamic.add(this.scene.add.text(x0, y, 'NA SEBE', style(11, '#e8a33d')));
    y += 18;
    for (const slot of ['melee', 'ranged', 'trinket'] as const) {
      const it = store.item(state.equipment[slot]);
      const line = this.scene.add.text(x0, y, `${SLOT_LABEL[slot]}:\n  ${it === undefined ? '—' : shorten(itemName(it))}`, style(10, it ? RARITY[it.rarity].color : '#8a5a66'));
      this.dynamic.add(line);
      if (slot === 'trinket' && it !== undefined) {
        this.clickable(line, () => store.unequipTrinket());
        line.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.details.setText('Klik = odložiť talizman.'));
      }
      y += 30;
    }
    const l = store.loadout();
    this.dynamic.add(
      this.scene.add
        .text(
          x0,
          y + 4,
          [
            `Úder:   ${l.melee.damage} dmg / ${(l.melee.cooldownMs / 1000).toFixed(2)} s, dosah ${l.melee.range.toFixed(1)}`,
            `Strela: ${l.ranged.damage} dmg / ${(l.ranged.cooldownMs / 1000).toFixed(2)} s, dolet ${l.ranged.range.toFixed(1)}`,
            `Zdravie ${l.maxHp} · pohyb ${Math.round((l.speedPx / 150) * 100)} % · úskok ${(l.dashCooldownMs / 1000).toFixed(2)} s`,
          ].join('\n'),
          style(10, '#e6d3d8'),
        )
        .setLineSpacing(3),
    );

    // --- sklad ---
    y = PANEL.y + 34;
    this.dynamic.add(this.scene.add.text(x1, y, `SKLAD ${state.inventory.length}/${INVENTORY_LIMIT}`, style(11, '#e8a33d')));
    y += 18;
    for (const it of state.inventory) {
      const equipped = store.isEquipped(it.id);
      const row = this.scene.add.text(x1, y, `${equipped ? '▶' : ' '} ${shorten(itemName(it))}`, style(10, RARITY[it.rarity].color));
      this.clickable(row, (p) => {
        const r = p.rightButtonDown() ? store.shred(it.id) : store.equip(it.id);
        if (!r.ok) store.events.emit('notice', { text: r.reason, tone: 'warn' });
      });
      row.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.details.setText(this.describe(it, l)));
      this.dynamic.add(row);
      y += ROW;
    }
  }

  private describe(it: Item, current: Loadout): string {
    const { store } = session;
    const base = BASE_ITEMS[it.base];
    const eq = store.state.equipment;
    const pick = (slot: ItemSlot): Item | undefined => (base.slot === slot ? it : store.item(eq[slot]));
    const next = resolveLoadout({ melee: pick('melee'), ranged: pick('ranged'), trinket: pick('trinket') });
    const diffs = [
      delta('úder dmg', current.melee.damage, next.melee.damage, false, 1),
      delta('úder cooldown ms', current.melee.cooldownMs, next.melee.cooldownMs, true),
      delta('strela dmg', current.ranged.damage, next.ranged.damage, false, 1),
      delta('strela cooldown ms', current.ranged.cooldownMs, next.ranged.cooldownMs, true),
      delta('zdravie', current.maxHp, next.maxHp),
      delta('pohyb px/s', current.speedPx, next.speedPx),
      delta('úskok ms', current.dashCooldownMs, next.dashCooldownMs, true),
    ].filter((d): d is string => d !== null);
    const mods = describeMods(it);
    return [
      `[${RARITY[it.rarity].name}] ${itemName(it)} – ${SLOT_LABEL[base.slot].toLowerCase()}`,
      `${base.flavor}${mods === '' ? '' : `  Efekty: ${mods}.`}`,
      store.isEquipped(it.id) ? 'Máte na sebe.' : diffs.length === 0 ? 'Oproti súčasnej výbave bez zmeny.' : `Po nasadení: ${diffs.join(' · ')}`,
      `Skartovanie: +${RARITY[it.rarity].shredValue} F`,
    ].join('\n');
  }

  private clickable(obj: Phaser.GameObjects.Text, onClick: (p: Phaser.Input.Pointer) => void): void {
    obj.setInteractive({ useHandCursor: true });
    obj.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      session.uiPointerDownTime = p.downTime;
      onClick(p);
    });
  }
}
