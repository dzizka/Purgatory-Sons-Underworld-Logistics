import type Phaser from 'phaser';
import { sfx } from '@/audio/sfx';
import { Rng } from '@/core/rng';
import { BUILDINGS, type BuildingType } from '@/data/buildings';
import { COFFEE_BREAK_AT } from '@/data/careers';
import { CHATTER_COFFEE, CHATTER_LEVEL_UP, CHATTER_MANAGER } from '@/data/chatter';
import { RESOURCE_IDS, RESOURCE_INFO } from '@/data/resources';
import type { BaseScene } from '@/scenes/BaseScene';
import type { BuildingState, SinnerState } from '@/state/GameState';
import { session } from '@/state/session';
import { pickChatter, pickOfficeEvent } from '@/systems/staff/chatter';
import { LOUNGE_SPOTS } from '@/world/maps';
import { SpeechBubble } from '@/world/SpeechBubble';

/** Kozmetika, ktorá do simulácie nezasahuje – iba oživuje kanceláriu. */
const CHATTER_MS: readonly [number, number] = [1600, 3400];
const WANDER_MS: readonly [number, number] = [3500, 7000];
const EVENT_MS: readonly [number, number] = [70_000, 140_000];
const MAX_BUBBLES = 3;
const MANAGER_IDLE_MS = 25_000;
const RESOURCE_COLOR = { souls: '#c9b8ff', forms: '#f3e9dc', sulfur: '#ffb347', coffee: '#c08a5a' } as const;
const FLOAT_DEPTH = 910_000;

/**
 * Život na základni: hriešnici kecajú, chodia na kávu, flákajú sa v čakárni, tešia sa z povýšenia,
 * budovy „dýchajú“ pri každom cykle a občas sa stane kancelárska udalosť.
 */
export class BaseLife {
  private readonly rng = new Rng((Date.now() ^ 0x5eed) >>> 0);
  private bubbles = new Map<string, SpeechBubble>();
  private lastEvent: string | null = null;
  private onBreak = new Set<string>();
  private managerIdleMs = 0;
  private lastPlayer = { x: 0, y: 0 };

  constructor(private readonly base: BaseScene) {
    const { store } = session;
    const offs = [
      store.events.on('coffeeBreak', (s) => this.coffeeBreak(s)),
      store.events.on('levelUp', (s) => this.levelUp(s)),
      store.events.on('cycleCompleted', ({ building }) => this.cycle(building)),
    ];
    base.events.once('shutdown', () => offs.forEach((off) => off()));
    this.schedule(CHATTER_MS, () => this.chatter());
    this.schedule(WANDER_MS, () => this.wander());
    this.schedule(EVENT_MS, () => this.officeEvent());
    base.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshTired() });
  }

  /** Volá BaseScene každý snímok. */
  update(delta: number): void {
    for (const [id, b] of this.bubbles) {
      b.follow();
      if (b.finished) this.bubbles.delete(id);
    }
    const p = this.base.playerSprite;
    if (Math.abs(p.x - this.lastPlayer.x) + Math.abs(p.y - this.lastPlayer.y) > 0.5) {
      this.managerIdleMs = 0;
      this.lastPlayer = { x: p.x, y: p.y };
    } else if ((this.managerIdleMs += delta) > MANAGER_IDLE_MS) {
      this.managerIdleMs = 0;
      this.say('manager', p, this.rng.pick(CHATTER_MANAGER), { lift: 50, force: true });
    }
  }

  // ---------- udalosti zo simulácie ----------

  private coffeeBreak(s: SinnerState): void {
    const v = this.base.sinnerView(s.id);
    const coffee = session.store.state.buildings.find((b) => b.type === 'coffee');
    if (v === undefined || v.walking || coffee === undefined || this.onBreak.has(s.id)) return;
    const spot = this.base.visitSpot(coffee.id);
    if (spot === undefined) return;
    this.onBreak.add(s.id);
    v.goTo(spot, { x: coffee.tx, y: coffee.ty }, false, () => {
      this.say(s.id, v.sprite, this.rng.pick(CHATTER_COFFEE), { force: true });
      this.base.time.delayedCall(2600, () => {
        this.onBreak.delete(s.id);
        this.base.sendHome(s.id);
      });
    });
  }

  private levelUp(s: SinnerState): void {
    const v = this.base.sinnerView(s.id);
    if (v === undefined) return;
    if (!v.walking) v.hop(2);
    this.say(s.id, v.sprite, this.rng.pick(CHATTER_LEVEL_UP), { force: true });
  }

  /** Budova pri dokončení cyklu „dýchne“ a vyletí z nej čo vyrobila. */
  private cycle(b: BuildingState): void {
    const view = this.base.buildingView(b.id);
    if (view === undefined) return;
    const sprite = view.sprite;
    // rýchle cykly by sa inak prekrývali a mierka by „ujela“
    this.base.tweens.killTweensOf(sprite);
    sprite.setScale(1);
    sprite.syncToWorld();
    this.base.tweens.add({ targets: sprite, scaleY: 0.9, scaleX: 1.06, duration: 90, yoyo: true, ease: 'Quad.Out' });
    const def = BUILDINGS[b.type];
    const out = RESOURCE_IDS.filter((id) => (def.outputs[id] ?? 0) > 0);
    const label = out.length > 0 ? out.map((id) => `+${def.outputs[id]} ${RESOURCE_INFO[id].short}`).join(' ') : '+XP';
    const color = out[0] !== undefined ? RESOURCE_COLOR[out[0]] : '#9be37a';
    const t = this.base.add
      .text(sprite.x, sprite.y - 52, label, { fontFamily: 'monospace', fontSize: '10px', color, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(FLOAT_DEPTH);
    this.base.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 1100, ease: 'Quad.Out', onComplete: () => t.destroy() });
  }

  // ---------- náhodné správanie ----------

  private chatter(): void {
    const { store } = session;
    const candidates = store.state.sinners.filter((s) => !this.bubbles.has(s.id) && this.base.sinnerView(s.id) !== undefined);
    if (candidates.length === 0) return;
    const s = this.rng.pick(candidates);
    const v = this.base.sinnerView(s.id);
    if (v === undefined) return;
    const building = s.assignedTo === null ? null : (store.building(s.assignedTo)?.type ?? null);
    this.say(s.id, v.sprite, pickChatter(s, building, this.rng));
  }

  /** Nepridelení sa ponevierajú po čakárni – občas k niekomu prídu „pokecať“. */
  private wander(): void {
    const idle = session.store.state.sinners.filter((s) => s.assignedTo === null && !this.onBreak.has(s.id));
    if (idle.length === 0) return;
    const s = this.rng.pick(idle);
    const v = this.base.sinnerView(s.id);
    if (v === undefined || v.walking) return;
    const spot = this.rng.pick(LOUNGE_SPOTS);
    v.goTo({ x: spot.x + (this.rng.next() - 0.5) * 0.4, y: spot.y + (this.rng.next() - 0.5) * 0.4 }, null, false);
  }

  /** Náhodná kancelárska udalosť (verejné kvôli dev menu). */
  officeEvent(): void {
    const { store } = session;
    if (store.state.sinners.length === 0) return;
    const built = new Set<BuildingType>(store.state.buildings.map((b) => b.type));
    const ev = pickOfficeEvent(built, this.rng, this.lastEvent);
    this.lastEvent = ev.id;
    store.events.emit('notice', { text: ev.notice, tone: 'info' });
    sfx(this.base, 'summon');

    if (ev.needs !== undefined) {
      const b = store.state.buildings.find((x) => x.type === ev.needs);
      const view = b === undefined ? undefined : this.base.buildingView(b.id);
      if (view !== undefined) {
        this.base.tweens.add({ targets: view.sprite, x: view.sprite.x + 2, duration: 50, yoyo: true, repeat: 7 });
      }
    }
    if (ev.id === 'fire') {
      // všetci utekajú do čakárne a po chvíli späť
      this.base.cameras.main.shake(300, 0.004);
      for (const s of store.state.sinners) {
        const v = this.base.sinnerView(s.id);
        if (v === undefined) continue;
        v.goTo(this.rng.pick(LOUNGE_SPOTS), null, false);
      }
      this.base.time.delayedCall(5000, () => store.state.sinners.forEach((s) => this.base.sendHome(s.id)));
    }

    const speakers = this.rng.sample(store.state.sinners, Math.min(3, store.state.sinners.length));
    speakers.forEach((s, i) => {
      this.base.time.delayedCall(600 + i * 900, () => {
        const v = this.base.sinnerView(s.id);
        if (v === undefined) return;
        if (ev.id === 'birthday' && !v.walking) v.hop(3);
        this.say(s.id, v.sprite, ev.who[i % ev.who.length] ?? '…', { force: true });
      });
    });
  }

  private refreshTired(): void {
    for (const s of session.store.state.sinners) {
      this.base.sinnerView(s.id)?.setTired(s.role === 'worker' && s.assignedTo !== null && s.fatigue > COFFEE_BREAK_AT);
    }
  }

  // ---------- pomocné ----------

  private say(
    id: string,
    target: { readonly x: number; readonly y: number; readonly active?: boolean },
    text: string,
    opts: { readonly lift?: number; readonly force?: boolean } = {},
  ): void {
    if (this.bubbles.has(id)) this.bubbles.get(id)?.dismiss();
    else if (!opts.force && this.bubbles.size >= MAX_BUBBLES) return;
    this.bubbles.set(id, new SpeechBubble(this.base as Phaser.Scene, target, text, opts.lift !== undefined ? { lift: opts.lift } : {}));
  }

  /** Opakovaný časovač s náhodným intervalom. */
  private schedule([min, max]: readonly [number, number], fn: () => void): void {
    const next = (): void => {
      this.base.time.delayedCall(min + this.rng.next() * (max - min), () => {
        fn();
        next();
      });
    };
    next();
  }
}
