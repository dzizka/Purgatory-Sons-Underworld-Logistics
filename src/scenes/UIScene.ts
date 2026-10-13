import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/constants';
import { BUILDING_TYPES, BUILDINGS, type BuildingType } from '@/data/buildings';
import { canAfford, formatAmounts, RESOURCE_IDS, RESOURCE_INFO } from '@/data/resources';
import { TRAITS } from '@/data/traits';
import { InventoryPanel } from '@/ui/InventoryPanel';
import { sfx } from '@/audio/sfx';
import { BASE_EVENTS, type BaseScene, type TileInfo } from '@/scenes/BaseScene';
import type { SinnerState } from '@/state/GameState';
import { session } from '@/state/session';
import { SINNER_KIND_DEFS, SINNER_KINDS } from '@/data/sinnerKinds';
import { quotaText, STREAK_BONUS, STREAK_MAX } from '@/data/quotas';
import { bonusReady, dailyBonus, isDone, quotaReward } from '@/systems/quotas/quotas';
import { COFFEE_BREAK_AT, LEAD_BONUS, MAX_LEVEL, PENSION_BONUS } from '@/data/careers';
import { buildingRate, leadOf, workersOf } from '@/systems/base/production';
import { burnoutMult, isMaxLevel, levelFromXp, sinnerEfficiency, xpForLevel } from '@/systems/staff/sinners';
import type { TileKind } from '@/world/TileGrid';

const TILE_LABEL: Readonly<Record<TileKind, string>> = {
  floor: 'Podlaha (nepovinne umytá)',
  wall: 'Nosná stena (nosí hlavne výčitky)',
  pillar: 'Blok pekelného kameňa – firemné hodnoty',
  desk: 'Pracovný stôl, model „Večný Open-space“',
  elevator: 'Služobný výťah do Oddelenia reklamácií (E = nastúpiť)',
  stairs: 'Schodisko',
  void: 'Nič',
};

const STATUS_LABEL = { idle: 'stojí – chýbajú ľudia', working: 'pracuje', blocked: 'čaká na suroviny' } as const;

const FONT = 'monospace';
const C = {
  accent: '#e8a33d',
  text: '#e6d3d8',
  dim: '#8a5a66',
  muted: '#c9a0a8',
  good: '#9be37a',
  bad: '#ff6b6b',
  panel: 0x140a10,
} as const;

const PANEL = { x: GAME_WIDTH - 262, y: 10, w: 254 } as const;
/** Denné kvóty – vľavo, nad detailom budovy. */
const QUOTA = { x: 16, y: 196, w: 290 } as const;
const BAR_Y = GAME_HEIGHT - 32;
const ROW_H = 30;
const MAX_ROWS = 10;

const pct = (x: number): number => Math.round(x * 100);
/** Riadok v Personálnom sa musí zmestiť do panelu (monospace 10 px ≈ 6 px na znak). */
const fit = (text: string, max = 40): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/**
 * HUD overlay. Beží ako samostatná scéna s vlastnou kamerou, takže zoom
 * hernej kamery ho neškáluje.
 */
export class UIScene extends Phaser.Scene {
  private resourceText!: Phaser.GameObjects.Text;
  private hoverText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private infoBg!: Phaser.GameObjects.Rectangle;
  private infoText!: Phaser.GameObjects.Text;
  private staff!: Phaser.GameObjects.Container;
  private staffBg!: Phaser.GameObjects.Rectangle;
  private buildButtons: { type: BuildingType; text: Phaser.GameObjects.Text }[] = [];
  private toasts: Phaser.GameObjects.Text[] = [];
  private hoveredBuilding: string | null = null;
  private inventory!: InventoryPanel;
  private quotaBg!: Phaser.GameObjects.Rectangle;
  private quotaPanel!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // scéna sa pri návrate z expedície spúšťa znova – staré objekty už neexistujú
    this.toasts = [];
    this.buildButtons = [];
    this.hoveredBuilding = null;
    this.add.text(12, 10, 'PURGATORY & LOGISTICS · Oddelenie spracovania duší', this.style(13, C.accent));
    this.resourceText = this.add.text(12, 30, '', this.style(13, C.text));
    this.hoverText = this.add.text(12, 50, '', this.style(11, C.muted)).setWordWrapWidth(PANEL.x - 24);

    this.infoBg = this.blocker(this.add.rectangle(10, BAR_Y - 128, 400, 110, C.panel, 0.85).setOrigin(0, 0));
    this.infoText = this.add.text(18, BAR_Y - 122, '', this.style(11, C.text)).setWordWrapWidth(384);
    this.modeText = this.add.text(12, BAR_Y - 16, '', this.style(11, C.dim));

    this.staffBg = this.blocker(this.add.rectangle(PANEL.x - 6, PANEL.y, PANEL.w + 4, 100, C.panel, 0.85).setOrigin(0, 0));
    this.add.text(PANEL.x, PANEL.y + 6, 'PERSONÁLNE ODDELENIE', this.style(12, C.accent));
    this.staff = this.add.container(0, 0);

    this.quotaBg = this.blocker(this.add.rectangle(QUOTA.x - 6, QUOTA.y - 6, QUOTA.w, 80, C.panel, 0.85).setOrigin(0, 0));
    this.quotaPanel = this.add.container(0, 0);

    this.createBuildBar();
    this.inventory = new InventoryPanel(this);
    this.bindKeys();
    this.subscribe();
    this.renderAll();
    this.time.addEvent({ delay: 200, loop: true, callback: () => this.renderInfo() });
    // únava sa mení priebežne, nie na event
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.renderStaff() });

    // hlášky, ktoré prišli, kým HUD nebežal (návrat z expedície, offline progres, poškodený save)
    session.hudActive = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      session.hudActive = false;
    });
    const pending = session.takePendingNotices();
    pending.forEach((n, i) => this.time.delayedCall(300 + i * 900, () => this.toast(n.text, n.tone)));
  }

  // ---------- render ----------

  private renderAll(): void {
    this.renderQuotas();
    this.renderResources();
    this.renderStaff();
    this.renderBuildBar();
    this.renderMode();
    this.renderInfo();
  }

  private renderResources(): void {
    const r = session.store.state.resources;
    this.resourceText.setText(RESOURCE_IDS.map((id) => `${RESOURCE_INFO[id].name} ${Math.floor(r[id])}`).join('   '));
  }

  private renderStaff(): void {
    this.staff.removeAll(true);
    const { store } = session;
    const m = session.mode;
    const sinners = store.state.sinners;
    sinners.slice(0, MAX_ROWS).forEach((s, i) => {
      const y = PANEL.y + 28 + i * ROW_H;
      const selected = m.kind === 'assign' && m.sinnerId === s.id;
      const lvl = levelFromXp(s.xp);
      const where = s.assignedTo === null ? 'čakáreň' : BUILDINGS[store.building(s.assignedTo)?.type ?? 'intake'].name;
      const level = lvl >= MAX_LEVEL ? `Lv${lvl} MAX` : `Lv${lvl} (${Math.floor(s.xp)}/${xpForLevel(lvl + 1)})`;
      const line1 = `${selected ? '▶ ' : ''}${s.role === 'lead' ? 'VEDÚCI ' : ''}${s.name}  ${level}`;
      const tired = s.fatigue > COFFEE_BREAK_AT;
      const kind = s.kind === 'clerk' ? '' : `${SINNER_KIND_DEFS[s.kind].name}, `;
      const detail = tired ? `únava ${pct(s.fatigue)} %` : `${kind}${s.traits.map((t) => TRAITS[t].name).join(', ')}`;
      const color = selected ? C.accent : tired ? C.bad : s.role === 'worker' && isMaxLevel(s) ? C.good : C.text;
      const row = this.add.text(PANEL.x, y, `${fit(line1)}\n${fit(`  ${where} · ${detail}`)}`, this.style(10, color)).setLineSpacing(2);
      this.clickable(row, () => this.toggleAssign(s.id));
      row.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.hoverText.setText(this.describeSinner(s)));
      this.staff.add(row);
    });
    if (sinners.length > MAX_ROWS) {
      this.staff.add(this.add.text(PANEL.x, PANEL.y + 28 + MAX_ROWS * ROW_H - 8, `… a ďalších ${sinners.length - MAX_ROWS}`, this.style(10, C.dim)));
    }

    const rows = Math.min(sinners.length, MAX_ROWS) + (sinners.length > MAX_ROWS ? 0.5 : 0);
    let by = PANEL.y + 34 + ROW_H * rows;
    const button = (label: string, color: string, onClick: () => void): void => {
      const t = this.add.text(PANEL.x, by, label, this.style(11, color));
      this.clickable(t, onClick);
      this.staff.add(t);
      by += 14;
    };
    const hk = SINNER_KIND_DEFS[session.hireKind];
    button(`[H] Prijať: ${hk.name} (${formatAmounts(hk.hireCost)})`, canAfford(store.state.resources, hk.hireCost) ? C.good : C.dim, () => this.hire());
    const hireBtn = this.staff.list[this.staff.list.length - 1];
    hireBtn?.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.hoverText.setText(`${hk.name}: ${hk.description}`));
    const kinds = this.unlockedKinds();
    if (kinds.length > 1) button(`[T] Typ náboru ▸ (${kinds.indexOf(session.hireKind) + 1}/${kinds.length})`, C.muted, () => this.cycleHireKind());
    button(`[I] Sklad a výbava (${store.state.inventory.length})`, C.muted, () => this.inventory.toggle());
    const chosen = m.kind === 'assign' ? store.sinner(m.sinnerId) : undefined;
    if (chosen !== undefined && chosen.assignedTo !== null) button('[U] Poslať do čakárne', C.muted, () => this.unassignSelected());
    if (chosen !== undefined && isMaxLevel(chosen)) {
      if (chosen.role === 'worker') button(`[P] Povýšiť na vedúceho (+${pct(LEAD_BONUS - 1)} % budova)`, C.good, () => this.promoteSelected());
      button(`[R] Dôchodok (+${pct(PENSION_BONUS)} % celá výroba)`, C.good, () => this.retireSelected());
    }
    if (store.state.retirees.length > 0) {
      const t = this.add.text(PANEL.x, by, `Dôchodkový fond: ${store.state.retirees.length} · výroba +${store.pensionPercent()} %`, this.style(10, C.dim));
      t.setInteractive().on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
        this.hoverText.setText(`Na dôchodku: ${store.state.retirees.slice(-12).join(', ')}. Plaketa na chodbe, výplata nikdy.`),
      );
      this.staff.add(t);
      by += 14;
    }
    this.staffBg.setSize(PANEL.w + 4, by - PANEL.y + 6);
    this.staffBg.input?.hitArea.setTo(0, 0, PANEL.w + 4, by - PANEL.y + 6);
  }

  private renderQuotas(): void {
    this.quotaPanel.removeAll(true);
    const { store } = session;
    const board = store.state.quotas;
    if (board === null) {
      this.quotaBg.setVisible(false);
      return;
    }
    this.quotaBg.setVisible(true);
    const streak = board.streak > 0 ? ` · séria ${board.streak} d (+${pct(STREAK_BONUS * Math.min(board.streak, STREAK_MAX))} %)` : '';
    let y = QUOTA.y;
    const line = (text: string, color: string, size = 10): Phaser.GameObjects.Text => {
      const t = this.add.text(QUOTA.x, y, text, this.style(size, color));
      this.quotaPanel.add(t);
      y += size + 4;
      return t;
    };
    line(`DENNÉ KVÓTY OD VEDENIA${streak}`, C.accent, 11);
    for (const e of board.entries) {
      const done = isDone(e);
      const mark = e.claimed ? '[✓]' : done ? '[!]' : '[ ]';
      // pri „vráť sa z poschodia“ a CEO je počítadlo zbytočné – cieľ je v texte
      const counted = e.quota.kind !== 'depth' && e.quota.kind !== 'boss';
      const progress = done || !counted ? '' : ` ${Math.floor(e.progress)}/${e.quota.target}`;
      const t = line(fit(`${mark} ${quotaText(e.quota)}${progress}`, 46), e.claimed ? C.dim : done ? C.good : C.text);
      t.setInteractive().on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
        this.hoverText.setText(`Odmena: ${formatAmounts(quotaReward(e, board, store.state.progress))}. Kvóty sa menia o polnoci (miestny čas).`),
      );
    }
    const claimable = board.entries.some((e) => isDone(e) && !e.claimed) || bonusReady(board);
    if (claimable) {
      const t = line('[Q] Vyzdvihnúť odmeny', C.good, 11);
      this.clickable(t, () => this.claimQuotas());
    } else if (!board.bonusClaimed) {
      const t = line(`Všetky tri: +${formatAmounts(dailyBonus(board, store.state.progress))} a predmet`, C.dim);
      t.setInteractive().on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
        this.hoverText.setText('Zamestnanec dňa: splňte všetky tri kvóty. Séria dní zvyšuje všetky odmeny o 10 % za deň (najviac +50 %).'),
      );
    } else {
      line('Zamestnanec dňa. Zajtra znova.', C.dim);
    }
    this.quotaBg.setSize(QUOTA.w, y - QUOTA.y + 8);
    this.quotaBg.input?.hitArea.setTo(0, 0, QUOTA.w, y - QUOTA.y + 8);
  }

  private claimQuotas(): void {
    if (session.store.claimQuotas() === 0 && session.store.state.quotas?.bonusClaimed !== true) {
      this.toast('Zatiaľ nie je čo vyzdvihnúť. Vedenie si všíma snahu, nie úmysly.', 'warn');
    }
  }

  private createBuildBar(): void {
    this.blocker(this.add.rectangle(0, BAR_Y - 4, GAME_WIDTH, 36, C.panel, 0.9).setOrigin(0, 0));
    const w = GAME_WIDTH / BUILDING_TYPES.length;
    this.buildButtons = BUILDING_TYPES.map((type, i) => {
      const text = this.add.text(8 + i * w, BAR_Y, '', this.style(11, C.text)).setLineSpacing(1);
      this.clickable(text, () => this.toggleBuild(type));
      text.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        const d = BUILDINGS[type];
        this.hoverText.setText(`${d.name}: ${d.flavor}\n${this.recipe(type)}`);
      });
      return { type, text };
    });
  }

  private renderBuildBar(): void {
    const m = session.mode;
    const res = session.store.state.resources;
    this.buildButtons.forEach(({ type, text }, i) => {
      const d = BUILDINGS[type];
      const active = m.kind === 'build' && m.type === type;
      if (!session.store.isUnlocked(type)) {
        // stĺpec má ~29 znakov – kratšie odsadenie, aby text neprešiel do susedného tlačidla
        text.setText(`[${i + 1}] ${d.name}\n  zamknuté: ${d.unlock?.hint ?? ''}`).setColor(C.dim);
        return;
      }
      const color = active ? C.accent : canAfford(res, d.cost) ? C.text : C.dim;
      text.setText(`[${i + 1}] ${d.name}\n    ${formatAmounts(d.cost)}`).setColor(color);
    });
  }

  private renderMode(): void {
    const m = session.mode;
    const text =
      m.kind === 'build'
        ? `STAVBA: ${BUILDINGS[m.type].name} – klikni na voľnú podlahu (Shift = viac), Esc/pravé tlačidlo zruší`
        : m.kind === 'assign'
          ? `PRIDELENIE: ${session.store.sinner(m.sinnerId)?.name ?? '?'} – klikni na budovu, Esc zruší`
          : 'WASD pohyb · klik na budovu/hriešnika · 1–5 stavba · H nábor · I sklad · E výťah · M zvuk · Esc menu';
    this.modeText.setText(text).setColor(m.kind === 'idle' ? C.dim : C.accent);
  }

  private renderInfo(): void {
    const { store } = session;
    const id = session.selectedBuilding ?? this.hoveredBuilding;
    const b = id === null ? undefined : store.building(id);
    this.infoBg.setVisible(b !== undefined);
    if (b === undefined) {
      this.infoText.setText('');
      return;
    }
    const d = BUILDINGS[b.type];
    const workers = workersOf(store.state, b.id);
    const lead = leadOf(store.state, b.id);
    const rate = buildingRate(store.state, b);
    const leadLine = lead === undefined ? [] : [`  vedúci: ${lead.name} (deleguje)`];
    const crew =
      workers.length === 0
        ? '  nikto – vyberte hriešnika v Personálnom a kliknite sem'
        : workers
            .map((w) => {
              const burnt = burnoutMult(w.fatigue) < 1 ? ' (vyhorený – chýba káva)' : '';
              return `  ${w.name} ${pct(sinnerEfficiency(w, b.type, workers.filter((o) => o !== w)))} %${burnt}`;
            })
            .join('\n');
    const bonuses = [
      lead === undefined ? '' : `vedúci +${pct(LEAD_BONUS - 1)} %`,
      store.state.retirees.length === 0 ? '' : `fond +${store.pensionPercent()} %`,
    ].filter((x) => x !== '');
    const cycle = rate > 0 ? `${(d.cycleMs / rate / 1000).toFixed(1)} s/cyklus` : '—';
    this.infoText.setText(
      [
        `${d.name}  [${STATUS_LABEL[b.status]}]  ${Math.floor(b.progress * 100)} %  · ${cycle}`,
        this.recipe(b.type),
        `Pracovníci ${workers.length}/${d.maxWorkers}${bonuses.length > 0 ? ` · ${bonuses.join(' · ')}` : ''}:`,
        crew,
        ...leadLine,
      ].join('\n'),
    );
  }

  private recipe(type: BuildingType): string {
    const d = BUILDINGS[type];
    const out = d.trainingXp !== undefined ? `+${d.trainingXp} XP navyše` : formatAmounts(d.outputs);
    return `Vstup: ${formatAmounts(d.inputs)} → Výstup: ${out} · základ ${d.cycleMs / 1000} s`;
  }

  private describeSinner(s: SinnerState): string {
    const career =
      s.role === 'lead'
        ? `Vedúci: sám nepracuje, budova +${pct(LEAD_BONUS - 1)} %.`
        : isMaxLevel(s)
          ? 'Na strope. Vyberte ho a zvoľte [P] povýšenie alebo [R] dôchodok – alebo nech robí ďalej.'
          : `Únava ${pct(s.fatigue)} % – nad ${pct(COFFEE_BREAK_AT)} % si dá kávu zo skladu, bez nej vyhorí.`;
    const traits = s.traits.map((t) => `${TRAITS[t].name}: ${TRAITS[t].description}`).join('\n');
    const kind = SINNER_KIND_DEFS[s.kind];
    return `${s.name} (${kind.name}) – hriech: ${s.sin}. ${career}\n${kind.name}: ${kind.description}\n${traits}`;
  }

  /** Krátka hláška hore v strede; najviac 3 naraz, najnovšia hore. */
  private toast(text: string, tone: 'info' | 'warn'): void {
    const t = this.add
      .text(PANEL.x / 2, 0, text, this.style(12, tone === 'warn' ? C.bad : C.good))
      .setOrigin(0.5, 0)
      .setBackgroundColor('#140a10')
      .setPadding(6, 3, 6, 3)
      .setWordWrapWidth(440);
    this.toasts.unshift(t);
    this.toasts.splice(3).forEach((old) => old.destroy());
    // dlhé hlášky sa zalomia na dva riadky – ukladáme podľa skutočnej výšky, nie pevného kroku
    let y = 118;
    for (const o of this.toasts) {
      o.setY(y);
      y += o.height + 4;
    }
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 3500,
      duration: 600,
      onComplete: () => {
        this.toasts = this.toasts.filter((o) => o !== t);
        t.destroy();
      },
    });
  }

  // ---------- actions ----------

  private toggleBuild(type: BuildingType): void {
    if (!session.store.isUnlocked(type)) {
      const d = BUILDINGS[type];
      this.toast(`${d.name} je zamknutá – ${d.unlock?.hint ?? '?'}.`, 'warn');
      return;
    }
    const m = session.mode;
    session.setMode(m.kind === 'build' && m.type === type ? { kind: 'idle' } : { kind: 'build', type });
  }

  private toggleAssign(id: string): void {
    const m = session.mode;
    session.setMode(m.kind === 'assign' && m.sinnerId === id ? { kind: 'idle' } : { kind: 'assign', sinnerId: id });
  }

  private hire(): void {
    const r = session.store.hire(session.hireKind);
    if (!r.ok) this.toast(r.reason, 'warn');
  }

  private unlockedKinds(): (typeof SINNER_KINDS)[number][] {
    return SINNER_KINDS.filter((k) => session.store.isKindUnlocked(k));
  }

  private cycleHireKind(): void {
    const kinds = this.unlockedKinds();
    const next = kinds[(kinds.indexOf(session.hireKind) + 1) % kinds.length] ?? 'clerk';
    session.hireKind = next;
    const d = SINNER_KIND_DEFS[next];
    this.hoverText.setText(`${d.name}: ${d.description}`);
    this.renderStaff();
  }

  private promoteSelected(): void {
    const m = session.mode;
    if (m.kind !== 'assign') return;
    const r = session.store.promote(m.sinnerId);
    if (!r.ok) this.toast(r.reason, 'warn');
    this.renderStaff();
  }

  private retireSelected(): void {
    const m = session.mode;
    if (m.kind !== 'assign') return;
    const r = session.store.retire(m.sinnerId);
    if (!r.ok) this.toast(r.reason, 'warn');
    else session.resetMode();
    this.renderStaff();
  }

  private unassignSelected(): void {
    const m = session.mode;
    if (m.kind !== 'assign') return;
    session.store.assign(m.sinnerId, null);
    session.resetMode();
  }

  private bindKeys(): void {
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      const type = BUILDING_TYPES[n - 1];
      if (type !== undefined) this.toggleBuild(type);
      else if (e.key === 'h' || e.key === 'H') this.hire();
      else if (e.key === 'u' || e.key === 'U') this.unassignSelected();
      else if (e.key === 'p' || e.key === 'P') this.promoteSelected();
      else if (e.key === 'r' || e.key === 'R') this.retireSelected();
      else if (e.key === 't' || e.key === 'T') this.cycleHireKind();
      else if (e.key === 'q' || e.key === 'Q') this.claimQuotas();
      else if (e.key === 'i' || e.key === 'I') this.inventory.toggle();
      else if (e.key === 'Escape') this.escape();
    });
  }

  /** Esc postupne: zavrie sklad → zruší režim/výber → menu. */
  private escape(): void {
    if (this.scene.isActive('TutorialScene')) return; // Esc tam znamená „preskočiť školenie“
    if (this.inventory.isOpen) {
      this.inventory.toggle();
      return;
    }
    if (session.mode.kind !== 'idle' || session.selectedBuilding !== null) {
      session.resetMode();
      session.selectBuilding(null);
      return;
    }
    (this.scene.get('BaseScene') as BaseScene).openMenu();
  }

  private subscribe(): void {
    const { store, ui } = session;
    const base = this.scene.get('BaseScene');
    const onHover = (t: TileInfo): void => {
      if (t.buildingId === null) this.hoverText.setText(`[${t.tx}, ${t.ty}] ${TILE_LABEL[t.kind]}`);
    };
    base.events.on(BASE_EVENTS.tileHover, onHover);
    const offs = [
      store.events.on('resourcesChanged', () => {
        this.renderResources();
        this.renderBuildBar();
        this.renderStaff();
      }),
      store.events.on('sinnerHired', () => this.renderStaff()),
      store.events.on('sinnerAssigned', () => this.renderStaff()),
      store.events.on('levelUp', () => this.renderStaff()),
      store.events.on('careerChanged', () => this.renderStaff()),
      store.events.on('sinnerRetired', () => {
        this.hoverText.setText('');
        this.renderStaff();
      }),
      store.events.on('inventoryChanged', () => this.renderStaff()),
      store.events.on('buildingUnlocked', () => this.renderBuildBar()),
      store.events.on('kindUnlocked', () => this.renderStaff()),
      store.events.on('quotasChanged', () => this.renderQuotas()),
      store.events.on('notice', (n) => this.toast(n.text, n.tone)),
      ui.on('modeChanged', () => {
        this.renderMode();
        this.renderBuildBar();
        this.renderStaff();
      }),
      ui.on('buildingSelected', () => this.renderInfo()),
      ui.on('buildingHovered', (id) => {
        this.hoveredBuilding = id;
        const b = id === null ? undefined : store.building(id);
        if (b !== undefined) this.hoverText.setText(`${BUILDINGS[b.type].name}: ${BUILDINGS[b.type].flavor}`);
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offs.forEach((off) => off());
      base.events.off(BASE_EVENTS.tileHover, onHover);
    });
  }

  // ---------- helpers ----------

  private style(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT, fontSize: `${size}px`, color };
  }

  /** Klik spracuje UI a herný svet ho bude ignorovať. */
  private clickable<T extends Phaser.GameObjects.Text>(obj: T, onClick: () => void): T {
    obj.setInteractive({ useHandCursor: true });
    obj.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      session.uiPointerDownTime = p.downTime;
      sfx(this, 'click');
      onClick();
    });
    return obj;
  }

  /** Plocha panelu: zachytí klik, aby neprepadol do sveta. */
  private blocker<T extends Phaser.GameObjects.Rectangle>(obj: T): T {
    obj.setInteractive();
    obj.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      session.uiPointerDownTime = p.downTime;
    });
    return obj;
  }
}
