import Phaser from 'phaser';
import { ENEMY_TEXTURE, THEMES } from '@/assets/manifest';
import { playMusic, toggleMute } from '@/audio/music';
import { sfx } from '@/audio/sfx';
import { FLOOR_DEPTH } from '@/config/constants';
import { screenToWorld, worldToScreen } from '@/core/iso';
import { ENEMIES } from '@/data/enemies';
import { PLAYER } from '@/data/player';
import type { Resources } from '@/data/resources';
import { type Item, RARITY } from '@/data/items';
import { punyAnimKey, registerPunyAnims, type PunyClip } from '@/entities/punyAnims';
import type { BaseSceneData } from '@/scenes/BaseScene';
import { session } from '@/state/session';
import { itemName } from '@/systems/loot/loot';
import {
  createExpedition,
  type EnemyState,
  type ExpeditionEvent,
  type ExpeditionState,
  leaveExpedition,
  stepExpedition,
} from '@/systems/combat/expedition';
import { facingFromScreen, type Facing } from '@/systems/movement/direction';
import type { Vec2 } from '@/systems/movement/movement';
import { IsoMapView } from '@/world/IsoMapView';
import { IsoSprite } from '@/world/IsoSprite';
import { COMPLAINTS_DEPT } from '@/world/maps';
import { parseMap, type TileGrid } from '@/world/TileGrid';

/** Krátke zamrznutie simulácie po zásahu – úder „sedí“. */
const HIT_STOP_MS = 45;
const OVERLAY_DEPTH = 950_000;
/** Výška letiacej sponky nad zemou (px). */
const PROJECTILE_Z = 14;

export type ExpeditionOutcome = {
  readonly result: 'won' | 'lost';
  readonly rewards: Resources;
  readonly kills: number;
  /** Zdvihnutá korisť (pri prehre prepadla – je tu iba na oznámenie). */
  readonly loot: readonly Item[];
};

interface EnemyView {
  sprite: IsoSprite;
  shadow: IsoSprite;
  facing: Facing;
  lastPhase: EnemyState['phase'];
}

interface Keys {
  up: Phaser.Input.Keyboard.Key[];
  down: Phaser.Input.Keyboard.Key[];
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
  dash: Phaser.Input.Keyboard.Key;
  use: Phaser.Input.Keyboard.Key;
}

/** Oddelenie reklamácií: ARPG časť. Simulácia je v `systems/combat`, tu je iba zobrazenie a vstup. */
export class ExpeditionScene extends Phaser.Scene {
  sim!: ExpeditionState;
  private grid!: TileGrid;
  private view!: IsoMapView;
  private player!: IsoSprite;
  private playerShadow!: IsoSprite;
  private playerFacing: Facing = 'SE';
  private attackAnimMs = 0;
  private attackClip: PunyClip = 'sword';
  private readonly enemyViews = new Map<number, EnemyView>();
  private readonly projectileViews = new Map<number, IsoSprite>();
  private readonly dropViews = new Map<number, IsoSprite>();
  private telegraphs!: Phaser.GameObjects.Graphics;
  private hitBars!: Phaser.GameObjects.Graphics;
  private keys!: Keys;
  private hitStopMs = 0;
  private elevatorTiles = new Set<string>();
  private finished = false;

  constructor() {
    super({ key: 'ExpeditionScene' });
  }

  create(): void {
    this.finished = false;
    this.hitStopMs = 0;
    this.enemyViews.clear();
    this.projectileViews.clear();
    this.dropViews.clear();

    const map = parseMap(COMPLAINTS_DEPT);
    this.grid = map.grid;
    this.elevatorTiles = new Set(map.elevators.map((e) => `${e.tx},${e.ty}`));
    this.view = new IsoMapView(this, map, THEMES.complaints);
    this.sim = createExpedition(map.spawn, map.enemies, {
      loadout: session.store.loadout(),
      seed: Math.floor(Math.random() * 2 ** 32),
    });

    registerPunyAnims(this, 'char_player');
    this.playerShadow = new IsoSprite(this, 'fx_shadow', map.spawn, { depthBias: -0.5 });
    this.player = new IsoSprite(this, 'char_player', map.spawn);

    for (const kind of Object.keys(ENEMY_TEXTURE) as (keyof typeof ENEMY_TEXTURE)[]) registerPunyAnims(this, ENEMY_TEXTURE[kind]);
    for (const e of this.sim.enemies) {
      const tex = ENEMY_TEXTURE[e.kind];
      const view: EnemyView = {
        shadow: new IsoSprite(this, 'fx_shadow', e.pos, { depthBias: -0.5 }),
        sprite: new IsoSprite(this, tex, e.pos),
        facing: 'S',
        lastPhase: e.phase,
      };
      view.sprite.play(punyAnimKey(tex, 'idle', 'S'));
      this.enemyViews.set(e.id, view);
    }

    this.telegraphs = this.add.graphics().setDepth(FLOOR_DEPTH + 2);
    this.hitBars = this.add.graphics().setDepth(OVERLAY_DEPTH - 1);

    const cam = this.cameras.main;
    cam.setBounds(this.view.bounds.x, this.view.bounds.y, this.view.bounds.width, this.view.bounds.height);
    cam.startFollow(this.player, true, 0.18, 0.18);
    cam.setZoom(1.6);
    cam.fadeIn(300);

    this.keys = this.createKeys();
    this.input.mouse?.disableContextMenu();
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _o: unknown[], _dx: number, dy: number) =>
        cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.9, 3)),
    );
    this.input.keyboard?.on('keydown-M', () => toggleMute());

    playMusic(this, 'music_expedition');
    this.scene.launch('ExpeditionUIScene');
  }

  /** Stojí manažér na výťahu? */
  get onElevator(): boolean {
    const p = this.sim.player.pos;
    return this.elevatorTiles.has(`${Math.round(p.x)},${Math.round(p.y)}`);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    if (this.hitStopMs > 0) {
      this.hitStopMs -= dt;
      return;
    }
    const events = stepExpedition(this.sim, this.readInput(), dt, this.grid);
    for (const e of events) this.handleEvent(e);
    this.attackAnimMs = Math.max(0, this.attackAnimMs - dt);
    this.syncPlayer();
    this.syncEnemies();
    this.syncProjectiles();
    this.syncDrops();
    this.view.fadeOccluders(this.player);

    if (!this.finished && this.sim.status === 'active' && this.onElevator && Phaser.Input.Keyboard.JustDown(this.keys.use)) {
      leaveExpedition(this.sim);
      this.finish();
    }
  }

  private readInput(): Parameters<typeof stepExpedition>[1] {
    const held = (ks: readonly Phaser.Input.Keyboard.Key[]): number => (ks.some((k) => k.isDown) ? 1 : 0);
    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    // Kurzor mieri na výšku pása postavy, nie na podlahu – inak by sa mierilo „pod nohy“.
    const aimAt = screenToWorld({ x: pointer.worldX, y: pointer.worldY + 14 });
    const overUi = pointer.downTime === session.uiPointerDownTime;
    return {
      move: { x: held(this.keys.right) - held(this.keys.left), y: held(this.keys.down) - held(this.keys.up) },
      aimAt,
      melee: pointer.leftButtonDown() && !overUi,
      ranged: pointer.rightButtonDown() && !overUi,
      dash: Phaser.Input.Keyboard.JustDown(this.keys.dash),
    };
  }

  private handleEvent(e: ExpeditionEvent): void {
    switch (e.type) {
      case 'swing':
        sfx(this, 'swing');
        this.attackClip = 'sword';
        this.attackAnimMs = 220;
        this.drawSwing(e.aim);
        break;
      case 'shot': {
        sfx(this, 'shot');
        this.attackClip = 'throw';
        this.attackAnimMs = 180;
        const pr = this.sim.projectiles.find((p) => p.id === e.projectileId);
        if (pr !== undefined) {
          const v = new IsoSprite(this, 'fx_staple', { x: pr.pos.x, y: pr.pos.y, z: PROJECTILE_Z });
          const s = worldToScreen(pr.vel);
          v.setRotation(Math.atan2(s.y, s.x));
          this.projectileViews.set(pr.id, v);
        }
        break;
      }
      case 'projectileGone':
        this.projectileViews.get(e.projectileId)?.destroy();
        this.projectileViews.delete(e.projectileId);
        break;
      case 'enemyHit': {
        sfx(this, 'hit');
        this.hitStopMs = HIT_STOP_MS;
        const v = this.enemyViews.get(e.enemyId);
        if (v === undefined) break;
        v.sprite.setTintFill(0xffffff);
        this.time.delayedCall(70, () => v.sprite.clearTint());
        this.floatText(v.sprite.x, v.sprite.y - 40, `-${e.amount}`, '#ffd080');
        break;
      }
      case 'enemyKilled': {
        sfx(this, 'kill');
        const v = this.enemyViews.get(e.enemyId);
        if (v === undefined) break;
        v.sprite.play(punyAnimKey(ENEMY_TEXTURE[e.kind], 'death', v.facing));
        this.floatText(v.sprite.x, v.sprite.y - 54, this.killQuip(e.kind), '#9be37a');
        this.tweens.add({ targets: [v.sprite, v.shadow], alpha: 0, delay: 500, duration: 380 });
        break;
      }
      case 'playerHit':
        sfx(this, 'hurt');
        this.cameras.main.shake(140, 0.006);
        this.player.setTintFill(0xff4040);
        this.time.delayedCall(90, () => this.player.clearTint());
        this.floatText(this.player.x, this.player.y - 44, `-${e.amount}`, '#ff6b6b');
        break;
      case 'enemyStrike': {
        const v = this.enemyViews.get(e.enemyId);
        const en = this.sim.enemies.find((x) => x.id === e.enemyId);
        if (v !== undefined && en !== undefined) v.sprite.play(punyAnimKey(ENEMY_TEXTURE[en.kind], 'sword', v.facing));
        break;
      }
      case 'playerDied':
        this.player.play(punyAnimKey('char_player', 'death', this.playerFacing));
        this.finish();
        break;
      case 'cleared':
        this.cameras.main.flash(250, 120, 200, 120);
        break;
      case 'lootDropped': {
        const d = this.sim.drops.find((x) => x.id === e.dropId);
        if (d === undefined) break;
        const v = new IsoSprite(this, 'fx_loot', { x: d.pos.x, y: d.pos.y, z: 8 }).setTint(RARITY[d.item.rarity].tint);
        this.dropViews.set(d.id, v);
        break;
      }
      case 'lootPicked': {
        sfx(this, 'pickup');
        this.dropViews.get(e.dropId)?.destroy();
        this.dropViews.delete(e.dropId);
        const r = RARITY[e.item.rarity];
        this.floatText(this.player.x, this.player.y - 58, `[${r.name}] ${itemName(e.item)}`, r.color, 1600);
        break;
      }
      case 'dash':
        sfx(this, 'dash');
        break;
      case 'windup':
        break;
    }
  }

  private syncPlayer(): void {
    const p = this.sim.player;
    this.player.setWorld(p.pos.x, p.pos.y);
    this.playerShadow.setWorld(p.pos.x, p.pos.y);
    if (this.sim.status === 'lost') return;
    const keys = this.keys;
    const held = (ks: readonly Phaser.Input.Keyboard.Key[]): number => (ks.some((k) => k.isDown) ? 1 : 0);
    const move = { x: held(keys.right) - held(keys.left), y: held(keys.down) - held(keys.up) };
    const aimScreen = worldToScreen(p.aim);
    if (this.attackAnimMs > 0) {
      this.playerFacing = facingFromScreen(aimScreen.x, aimScreen.y) ?? this.playerFacing;
      this.player.play(punyAnimKey('char_player', this.attackClip, this.playerFacing), true);
    } else {
      const f = facingFromScreen(move.x, move.y);
      if (f !== null) this.playerFacing = f;
      this.player.play(punyAnimKey('char_player', f === null ? 'idle' : 'walk', this.playerFacing), true);
    }
    // blikanie počas nezraniteľnosti
    this.player.setAlpha(p.invulnMs > 0 && Math.floor(p.invulnMs / 60) % 2 === 0 ? 0.45 : 1);
  }

  private syncEnemies(): void {
    const alive = new Set(this.sim.enemies.map((e) => e.id));
    for (const [id, v] of this.enemyViews) {
      if (alive.has(id)) continue;
      v.sprite.destroy();
      v.shadow.destroy();
      this.enemyViews.delete(id);
    }

    this.telegraphs.clear();
    this.hitBars.clear();
    const p = this.sim.player.pos;
    for (const e of this.sim.enemies) {
      const v = this.enemyViews.get(e.id);
      if (v === undefined) continue;
      v.sprite.setWorld(e.pos.x, e.pos.y);
      v.shadow.setWorld(e.pos.x, e.pos.y);
      if (e.phase === 'dead') continue;

      const tex = ENEMY_TEXTURE[e.kind];
      const def = ENEMIES[e.kind];
      if (e.phase === 'chase') {
        const a = worldToScreen(e.pos);
        const b = worldToScreen(p);
        v.facing = facingFromScreen(b.x - a.x, b.y - a.y) ?? v.facing;
        v.sprite.play(punyAnimKey(tex, 'walk', v.facing), true);
      } else if (e.phase === 'idle' || (e.phase === 'windup' && v.lastPhase !== 'windup')) {
        v.sprite.play(punyAnimKey(tex, 'idle', v.facing), true);
      }
      v.lastPhase = e.phase;

      if (e.phase === 'windup') this.drawTelegraph(e, 1 - Math.max(0, e.phaseMs) / def.windupMs);
      if (e.hp < e.maxHp) {
        const x = v.sprite.x - 12;
        const y = v.sprite.y - 40;
        this.hitBars.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, 26, 4);
        this.hitBars.fillStyle(0xd03030, 1).fillRect(x, y, 24 * (e.hp / e.maxHp), 2);
      }
    }
  }

  /** Korisť sa pomaly vznáša, aby si ju hráč všimol. */
  private syncDrops(): void {
    const t = this.sim.timeMs / 300;
    for (const d of this.sim.drops) this.dropViews.get(d.id)?.setWorld(d.pos.x, d.pos.y, 8 + Math.sin(t + d.id) * 3);
  }

  private syncProjectiles(): void {
    for (const pr of this.sim.projectiles) this.projectileViews.get(pr.id)?.setWorld(pr.pos.x, pr.pos.y, PROJECTILE_Z);
  }

  /** Červený výsek na zemi: kam nepriateľ udrie. Plní sa, ako sa blíži úder. */
  private drawTelegraph(e: EnemyState, t: number): void {
    const def = ENEMIES[e.kind];
    const reach = e.radius + def.reach + PLAYER.radius;
    const pts = this.arcPoints(e.pos, e.aim, reach, Math.PI / 2.4);
    this.telegraphs.fillStyle(0xff2020, 0.12 + 0.35 * t).fillPoints(pts, true);
    this.telegraphs.lineStyle(1, 0xff6060, 0.8).strokePoints(pts, true);
  }

  private drawSwing(aim: Vec2): void {
    const w = this.sim.loadout.melee;
    const g = this.add.graphics().setDepth(OVERLAY_DEPTH - 2);
    const pts = this.arcPoints(this.sim.player.pos, aim, w.range, (w.halfArcDeg * Math.PI) / 180);
    // výsek je na zemi, efekt kreslíme vo výške pása
    for (const pt of pts) pt.y -= 14;
    g.fillStyle(0xfff0c0, 0.4).fillPoints(pts, true);
    this.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
  }

  /** Výsek vo world súradniciach prevedený na obrazovkové body (v izometrii je to elipsa). */
  private arcPoints(origin: Vec2, aim: Vec2, range: number, halfArc: number): Phaser.Math.Vector2[] {
    const base = Math.atan2(aim.y, aim.x);
    const pts = [new Phaser.Math.Vector2(worldToScreen(origin).x, worldToScreen(origin).y)];
    for (let i = 0; i <= 10; i++) {
      const a = base - halfArc + (2 * halfArc * i) / 10;
      const s = worldToScreen({ x: origin.x + Math.cos(a) * range, y: origin.y + Math.sin(a) * range });
      pts.push(new Phaser.Math.Vector2(s.x, s.y));
    }
    return pts;
  }

  private floatText(x: number, y: number, text: string, color: string, durationMs = 750): void {
    const t = this.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '11px', color, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH);
    this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: durationMs, onComplete: () => t.destroy() });
  }

  private killQuip(kind: EnemyState['kind']): string {
    const quips =
      kind === 'auditor'
        ? ['Audit uzavretý.', 'Bez nálezu.', 'Zamietnuté.', 'Vybavené.']
        : ['Smernica zrušená.', 'Nevyhovuje predpisom.', 'Compliance: zlyhal.'];
    return quips[Math.floor(Math.random() * quips.length)] ?? 'Vybavené.';
  }

  /** Koniec expedície – výťahom (výhra) alebo disciplinárnym konaním (smrť). */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const won = this.sim.status === 'won';
    const outcome: ExpeditionOutcome = {
      result: won ? 'won' : 'lost',
      rewards: { ...this.sim.rewards },
      kills: this.sim.kills,
      loot: [...this.sim.loot],
    };
    const { store } = session;
    if (won) {
      store.grant(outcome.rewards);
      store.addLoot(outcome.loot);
    }
    store.recordExpedition(won, outcome.kills);
    session.save();
    this.events.emit('finished', outcome);
    this.time.delayedCall(won ? 400 : 2600, () => {
      this.cameras.main.fadeOut(350);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.stop('ExpeditionUIScene');
        const data: BaseSceneData = { from: 'expedition', outcome };
        this.scene.start('BaseScene', data);
      });
    });
  }

  private createKeys(): Keys {
    const kb = this.input.keyboard;
    if (kb === null) throw new Error('ExpeditionScene: klávesnica nie je dostupná');
    const K = Phaser.Input.Keyboard.KeyCodes;
    const add = (...codes: number[]): Phaser.Input.Keyboard.Key[] => codes.map((c) => kb.addKey(c));
    return {
      up: add(K.W, K.UP),
      down: add(K.S, K.DOWN),
      left: add(K.A, K.LEFT),
      right: add(K.D, K.RIGHT),
      dash: kb.addKey(K.SPACE),
      use: kb.addKey(K.E),
    };
  }
}
