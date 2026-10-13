import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/constants';
import { BUILDING_TYPES, BUILDINGS, type BuildingType } from '@/data/buildings';
import { canAfford, formatAmounts, RESOURCE_IDS, RESOURCE_INFO } from '@/data/resources';
import { TRAITS } from '@/data/traits';
import { BASE_EVENTS, type TileInfo } from '@/scenes/BaseScene';
import type { SinnerState } from '@/state/GameState';
import { session } from '@/state/session';
import { HIRE_COST } from '@/state/store';
import { buildingRate, workersOf } from '@/systems/base/production';
import { levelFromXp, sinnerEfficiency } from '@/systems/staff/sinners';
import type { TileKind } from '@/world/TileGrid';

const TILE_LABEL: Readonly<Record<TileKind, string>> = {
  floor: 'Podlaha (nepovinne umytá)',
  wall: 'Nosná stena (nosí hlavne výčitky)',
  pillar: 'Blok pekelného kameňa – firemné hodnoty',
  desk: 'Pracovný stôl, model „Večný Open-space“',
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
const BAR_Y = GAME_HEIGHT - 32;
const ROW_H = 30;
const MAX_ROWS = 10;

/** XP potrebné na ďalšiu úroveň. */
const xpForLevel = (level: number): number => 20 * (level - 1) ** 2;

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

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.add.text(12, 10, 'PURGATORY & LOGISTICS · Oddelenie spracovania duší', this.style(13, C.accent));
    this.resourceText = this.add.text(12, 30, '', this.style(13, C.text));
    this.hoverText = this.add.text(12, 50, '', this.style(11, C.muted)).setWordWrapWidth(PANEL.x - 24);

    this.infoBg = this.blocker(this.add.rectangle(10, BAR_Y - 128, 400, 110, C.panel, 0.85).setOrigin(0, 0));
    this.infoText = this.add.text(18, BAR_Y - 122, '', this.style(11, C.text)).setWordWrapWidth(384);
    this.modeText = this.add.text(12, BAR_Y - 16, '', this.style(11, C.dim));

    this.staffBg = this.blocker(this.add.rectangle(PANEL.x - 6, PANEL.y, PANEL.w + 4, 100, C.panel, 0.85).setOrigin(0, 0));
    this.add.text(PANEL.x, PANEL.y + 6, 'PERSONÁLNE ODDELENIE', this.style(12, C.accent));
    this.staff = this.add.container(0, 0);

    this.createBuildBar();
    this.bindKeys();
    this.subscribe();
    this.renderAll();
    this.time.addEvent({ delay: 200, loop: true, callback: () => this.renderInfo() });
  }

  // ---------- render ----------

  private renderAll(): void {
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
      const line1 = `${selected ? '▶ ' : ''}${s.name}  Lv${lvl} (${Math.floor(s.xp)}/${xpForLevel(lvl + 1)})`;
      const row = this.add
        .text(PANEL.x, y, `${line1}\n  ${where} · ${s.traits.map((t) => TRAITS[t].name).join(', ')}`, this.style(10, selected ? C.accent : C.text))
        .setLineSpacing(2);
      this.clickable(row, () => this.toggleAssign(s.id));
      row.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.hoverText.setText(this.describeSinner(s)));
      this.staff.add(row);
    });
    if (sinners.length > MAX_ROWS) {
      this.staff.add(this.add.text(PANEL.x, PANEL.y + 28 + MAX_ROWS * ROW_H - 8, `… a ďalších ${sinners.length - MAX_ROWS}`, this.style(10, C.dim)));
    }

    const rows = Math.min(sinners.length, MAX_ROWS) + (sinners.length > MAX_ROWS ? 0.5 : 0);
    const by = PANEL.y + 34 + ROW_H * rows;
    const affordable = canAfford(store.state.resources, HIRE_COST);
    const hire = this.add.text(PANEL.x, by, `[H] Prijať hriešnika (${formatAmounts(HIRE_COST)})`, this.style(11, affordable ? C.good : C.dim));
    this.clickable(hire, () => this.hire());
    this.staff.add(hire);
    if (m.kind === 'assign' && store.sinner(m.sinnerId)?.assignedTo !== null) {
      const free = this.add.text(PANEL.x, by + 14, '[U] Poslať do čakárne', this.style(11, C.muted));
      this.clickable(free, () => this.unassignSelected());
      this.staff.add(free);
    }
    this.staffBg.setSize(PANEL.w + 4, by - PANEL.y + 34);
    this.staffBg.input?.hitArea.setTo(0, 0, PANEL.w + 4, by - PANEL.y + 34);
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
          : 'WASD pohyb · koliesko zoom · klik na budovu/hriešnika · 1–5 stavba · H nábor · M hudba';
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
    const rate = buildingRate(store.state, b);
    const crew =
      workers.length === 0
        ? '  nikto – vyberte hriešnika v Personálnom a kliknite sem'
        : workers
            .map((w) => `  ${w.name} ${Math.round(sinnerEfficiency(w, b.type, workers.filter((o) => o !== w)) * 100)} %`)
            .join('\n');
    const cycle = rate > 0 ? `${(d.cycleMs / rate / 1000).toFixed(1)} s/cyklus` : '—';
    this.infoText.setText(
      [
        `${d.name}  [${STATUS_LABEL[b.status]}]  ${Math.floor(b.progress * 100)} %  · ${cycle}`,
        this.recipe(b.type),
        `Pracovníci ${workers.length}/${d.maxWorkers}:`,
        crew,
      ].join('\n'),
    );
  }

  private recipe(type: BuildingType): string {
    const d = BUILDINGS[type];
    const out = d.trainingXp !== undefined ? `+${d.trainingXp} XP navyše` : formatAmounts(d.outputs);
    return `Vstup: ${formatAmounts(d.inputs)} → Výstup: ${out} · základ ${d.cycleMs / 1000} s`;
  }

  private describeSinner(s: SinnerState): string {
    return `${s.name} – hriech: ${s.sin}.\n${s.traits.map((t) => `${TRAITS[t].name}: ${TRAITS[t].description}`).join('\n')}`;
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
    this.toasts.forEach((o, i) => o.setY(118 + i * 26));
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
    const m = session.mode;
    session.setMode(m.kind === 'build' && m.type === type ? { kind: 'idle' } : { kind: 'build', type });
  }

  private toggleAssign(id: string): void {
    const m = session.mode;
    session.setMode(m.kind === 'assign' && m.sinnerId === id ? { kind: 'idle' } : { kind: 'assign', sinnerId: id });
  }

  private hire(): void {
    const r = session.store.hire();
    if (!r.ok) this.toast(r.reason, 'warn');
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
      else if (e.key === 'Escape') {
        session.resetMode();
        session.selectBuilding(null);
      }
    });
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
