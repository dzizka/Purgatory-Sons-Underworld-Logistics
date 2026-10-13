import { CLEAR_BONUS, ENEMIES, type EnemyDef, type EnemyKind } from '@/data/enemies';
import { PLAYER } from '@/data/player';
import { depthScaling, type DepthScaling } from '@/data/dungeon';
import { emptyResources, gain, type ResourceAmounts, type Resources } from '@/data/resources';
import { Rng } from '@/core/rng';
import type { Item } from '@/data/items';
import { generateItem, type Loadout, resolveLoadout } from '@/systems/loot/loot';
import { applyHit, distance, type Fighter, inArc, type MutVec, normalize, stepKnockback } from '@/systems/combat/combat';
import { inputToWorldVelocity, moveWithCollision, type CollisionGrid, type Vec2 } from '@/systems/movement/movement';

/** Krátka nezraniteľnosť nepriateľa po zásahu – jeden švih = jeden zásah. */
const ENEMY_HIT_INVULN_MS = 120;
/** Tolerancia úderu nepriateľa: hráč musí naozaj uskočiť, nestačí o vlások. */
const STRIKE_SLACK = 0.2;
/** Ako dlho zostane mŕtvy nepriateľ v stave (na animáciu smrti). */
export const CORPSE_MS = 900;

export type EnemyPhase = 'idle' | 'chase' | 'windup' | 'recover' | 'dead';

export interface PlayerCombat extends Fighter {
  /** Posledný smer mierenia (jednotkový, world). */
  aim: MutVec;
  meleeCdMs: number;
  rangedCdMs: number;
  dashCdMs: number;
  dashMs: number;
  dashDir: MutVec;
}

export interface EnemyState extends Fighter {
  readonly id: number;
  readonly kind: EnemyKind;
  phase: EnemyPhase;
  phaseMs: number;
  /** Smer úderu zafixovaný na začiatku nápriahu. */
  aim: MutVec;
  /** Boss: odpočet do ďalšej porady (privolania posíl). */
  summonMs: number;
  /** Boss pod prahom zdravia: rýchlejší a s kratším nápriahom. */
  enraged: boolean;
  /** Privolaný na poradu – nenesie korisť (inak by sa dal CEO „farmiť“). */
  readonly minion: boolean;
}

export interface Projectile {
  readonly id: number;
  pos: MutVec;
  readonly vel: Vec2;
  travelled: number;
}

/** Projektil nepriateľa (predvolanie právnika protistrany). */
export interface EnemyProjectile extends Projectile {
  readonly damage: number;
  readonly range: number;
}

export type ExpeditionStatus = 'active' | 'won' | 'lost';

export interface LootDrop {
  readonly id: number;
  readonly item: Item;
  readonly pos: Vec2;
}

/** Šanca na korisť z vybavenia všetkých reklamácií: lepšia rarita. */
const CLEAR_LUCK = 1.5;
/** Ako blízko musí manažér prejsť, aby korisť zdvihol. */
const PICKUP_RADIUS = 0.55;

export interface ExpeditionState {
  readonly loadout: Loadout;
  readonly depth: number;
  readonly scaling: DepthScaling;
  player: PlayerCombat;
  enemies: EnemyState[];
  projectiles: Projectile[];
  enemyShots: EnemyProjectile[];
  nextId: number;
  kills: number;
  /** Porazení bossovia počas celej výpravy (cez všetky poschodia). */
  bossKills: number;
  /** Zabitia podľa typu (pre denné kvóty), za celú výpravu. */
  killsByKind: Partial<Record<EnemyKind, number>>;
  /** Odmeny, ktoré sa pripíšu základni pri návrate výťahom. Pri smrti prepadnú. */
  rewards: Resources;
  /** Korisť na zemi (prepadne, ak ju nikto nezdvihne). */
  drops: LootDrop[];
  /** Zdvihnutá korisť – pripíše sa pri návrate výťahom, pri smrti prepadá. */
  loot: Item[];
  cleared: boolean;
  status: ExpeditionStatus;
  timeMs: number;
  /** Dev cheat: smrteľný zásah manažéra len doplní zdravie. */
  godMode: boolean;
  readonly rng: Rng;
}

export interface ExpeditionInput {
  /** Smer pohybu v obrazovkových osiach (-1..1). */
  readonly move: Vec2;
  /** Bod vo world súradniciach, kam hráč mieri (kurzor). */
  readonly aimAt: Vec2;
  readonly melee: boolean;
  readonly ranged: boolean;
  readonly dash: boolean;
}

export type ExpeditionEvent =
  | { readonly type: 'swing'; readonly aim: Vec2 }
  | { readonly type: 'shot'; readonly projectileId: number }
  | { readonly type: 'projectileGone'; readonly projectileId: number }
  | { readonly type: 'enemyHit'; readonly enemyId: number; readonly amount: number }
  | { readonly type: 'enemyKilled'; readonly enemyId: number; readonly kind: EnemyKind }
  | { readonly type: 'windup'; readonly enemyId: number }
  /** Nepriateľ si manažéra prvýkrát všimol (pre repliky). */
  | { readonly type: 'aggro'; readonly enemyId: number; readonly kind: EnemyKind }
  | { readonly type: 'enemyStrike'; readonly enemyId: number; readonly hit: boolean }
  | { readonly type: 'playerHit'; readonly amount: number }
  | { readonly type: 'playerDied' }
  | { readonly type: 'dash' }
  | { readonly type: 'cleared' }
  | { readonly type: 'summon'; readonly enemyId: number; readonly spawned: readonly number[] }
  | { readonly type: 'enraged'; readonly enemyId: number }
  | { readonly type: 'split'; readonly enemyId: number; readonly spawned: readonly number[] }
  | { readonly type: 'enemyShot'; readonly enemyId: number; readonly projectileId: number }
  | { readonly type: 'enemyShotGone'; readonly projectileId: number }
  | { readonly type: 'lootDropped'; readonly dropId: number }
  | { readonly type: 'lootPicked'; readonly dropId: number; readonly item: Item };

/** Čo si manažér nesie z vyššieho poschodia. */
export interface ExpeditionCarry {
  readonly hp: number;
  readonly rewards: Resources;
  readonly loot: readonly Item[];
  readonly kills: number;
  readonly bossKills?: number;
  readonly killsByKind?: Partial<Record<EnemyKind, number>>;
}

export interface ExpeditionOptions {
  /** Výbava manažéra; predvolene základná dierovačka a sponkovačka. */
  readonly loadout?: Loadout;
  /** Seed pre korisť – rovnaký seed, rovnaké dropy. */
  readonly seed?: number;
  /** Poschodie (1 = prvé). Hlbšie = silnejší nepriatelia, lepšia korisť. */
  readonly depth?: number;
  readonly carry?: ExpeditionCarry;
  /** Korisť ležiaca na mape od začiatku (sklad). */
  readonly lootSpots?: readonly { readonly tx: number; readonly ty: number }[];
}

/** Násobok surovín podľa hĺbky, zaokrúhlený (aspoň pôvodná hodnota). */
function scaleAmounts(a: ResourceAmounts, mult: number): ResourceAmounts {
  const out: ResourceAmounts = {};
  for (const id of Object.keys(a) as (keyof ResourceAmounts)[]) {
    const v = a[id] ?? 0;
    out[id] = Math.max(v, Math.round(v * mult));
  }
  return out;
}

/** Schodisko dole sa otvorí, až keď je poschodie vybavené. */
export function canDescend(s: ExpeditionState): boolean {
  return s.status === 'active' && s.cleared;
}

/** Stav, ktorý sa prenesie na ďalšie poschodie. */
export function carryOf(s: ExpeditionState): ExpeditionCarry {
  return { hp: s.player.hp, rewards: { ...s.rewards }, loot: [...s.loot], kills: s.kills, bossKills: s.bossKills, killsByKind: { ...s.killsByKind } };
}

export function createExpedition(
  spawn: Vec2,
  enemies: readonly { kind: EnemyKind; tx: number; ty: number }[],
  opts: ExpeditionOptions = {},
): ExpeditionState {
  const loadout = opts.loadout ?? resolveLoadout({});
  const depth = Math.max(1, Math.floor(opts.depth ?? 1));
  const scaling = depthScaling(depth);
  const carry = opts.carry;
  const s: ExpeditionState = {
    loadout,
    depth,
    scaling,
    rng: new Rng(opts.seed ?? 1),
    drops: [],
    loot: carry ? [...carry.loot] : [],
    player: {
      pos: { x: spawn.x, y: spawn.y },
      hp: carry ? Math.min(loadout.maxHp, Math.max(1, carry.hp)) : loadout.maxHp,
      maxHp: loadout.maxHp,
      radius: PLAYER.radius,
      invulnMs: 0,
      knock: { x: 0, y: 0 },
      aim: { x: 1, y: 1 },
      meleeCdMs: 0,
      rangedCdMs: 0,
      dashCdMs: 0,
      dashMs: 0,
      dashDir: { x: 0, y: 0 },
    },
    enemies: [],
    projectiles: [],
    enemyShots: [],
    nextId: 1,
    kills: carry?.kills ?? 0,
    bossKills: carry?.bossKills ?? 0,
    killsByKind: { ...(carry?.killsByKind ?? {}) },
    rewards: carry ? { ...carry.rewards } : emptyResources(),
    cleared: enemies.length === 0,
    status: 'active',
    timeMs: 0,
    godMode: false,
  };
  for (const e of enemies) spawnEnemy(s, e.kind, { x: e.tx, y: e.ty }, false);
  // sklad: korisť leží na zemi od začiatku (so šťastím navyše)
  for (const spot of opts.lootSpots ?? []) {
    const id = s.nextId++;
    s.drops.push({ id, item: generateItem(s.rng, `loot-${id}`, { luck: scaling.luck + 0.5 }), pos: { x: spot.tx, y: spot.ty } });
  }
  return s;
}

/** Pridá nepriateľa so zdravím podľa hĺbky. */
function spawnEnemy(s: ExpeditionState, kind: EnemyKind, pos: Vec2, minion: boolean): EnemyState {
  const def = ENEMIES[kind];
  const hp = Math.round(def.maxHp * s.scaling.enemyHp);
  const e: EnemyState = {
    id: s.nextId++,
    kind,
    pos: { x: pos.x, y: pos.y },
    hp,
    maxHp: hp,
    radius: def.radius,
    invulnMs: 0,
    knock: { x: 0, y: 0 },
    phase: minion ? 'chase' : 'idle',
    phaseMs: 0,
    aim: { x: 0, y: 1 },
    summonMs: (def.boss?.summonEveryMs ?? 0) / 2,
    enraged: false,
    minion,
  };
  s.enemies.push(e);
  return e;
}

/** Rýchlosť a nápriah podľa toho, či je boss rozzúrený. */
function speedOf(def: EnemyDef, e: EnemyState): number {
  return def.speed * (e.enraged ? (def.boss?.enrageSpeedMult ?? 1) : 1);
}
function windupOf(def: EnemyDef, e: EnemyState): number {
  return def.windupMs * (e.enraged ? (def.boss?.enrageWindupMult ?? 1) : 1);
}

export function bossOf(s: ExpeditionState): EnemyState | undefined {
  return s.enemies.find((e) => ENEMIES[e.kind].boss !== undefined);
}

export function aliveEnemies(s: ExpeditionState): EnemyState[] {
  return s.enemies.filter((e) => e.phase !== 'dead');
}

/** Hráč nastúpil do výťahu – odmeny sa dajú pripísať. */
export function leaveExpedition(s: ExpeditionState): void {
  if (s.status === 'active') s.status = 'won';
}

/** Jeden krok simulácie. Mutuje `s`, vráti udalosti pre zvuk/efekty/UI. */
export function stepExpedition(s: ExpeditionState, input: ExpeditionInput, dtMs: number, grid: CollisionGrid): ExpeditionEvent[] {
  if (s.status !== 'active') return [];
  const ev: ExpeditionEvent[] = [];
  s.timeMs += dtMs;
  const p = s.player;

  // --- časovače ---
  p.invulnMs = Math.max(0, p.invulnMs - dtMs);
  p.meleeCdMs = Math.max(0, p.meleeCdMs - dtMs);
  p.rangedCdMs = Math.max(0, p.rangedCdMs - dtMs);
  p.dashCdMs = Math.max(0, p.dashCdMs - dtMs);
  p.dashMs = Math.max(0, p.dashMs - dtMs);

  // --- mierenie ---
  const aim = normalize({ x: input.aimAt.x - p.pos.x, y: input.aimAt.y - p.pos.y });
  if (aim.x !== 0 || aim.y !== 0) {
    p.aim.x = aim.x;
    p.aim.y = aim.y;
  }

  // --- pohyb a úskok ---
  const walk = inputToWorldVelocity(input.move.x, input.move.y, s.loadout.speedPx);
  if (input.dash && p.dashCdMs === 0 && p.dashMs === 0) {
    const dir = walk.x !== 0 || walk.y !== 0 ? normalize(walk) : p.aim;
    p.dashDir.x = dir.x * PLAYER.dash.speed;
    p.dashDir.y = dir.y * PLAYER.dash.speed;
    p.dashMs = PLAYER.dash.durationMs;
    p.dashCdMs = s.loadout.dashCooldownMs;
    p.invulnMs = Math.max(p.invulnMs, PLAYER.dash.invulnMs);
    ev.push({ type: 'dash' });
  }
  const vel = p.dashMs > 0 ? p.dashDir : walk;
  const dt = dtMs / 1000;
  const moved = moveWithCollision(grid, p.pos, { x: vel.x * dt, y: vel.y * dt }, p.radius);
  p.pos.x = moved.x;
  p.pos.y = moved.y;
  stepKnockback(p, grid, dtMs);

  // --- útoky ---
  if (input.melee && p.meleeCdMs === 0) {
    const w = s.loadout.melee;
    p.meleeCdMs = w.cooldownMs;
    ev.push({ type: 'swing', aim: { ...p.aim } });
    for (const e of aliveEnemies(s)) {
      if (inArc(p.pos, p.aim, w.range, (w.halfArcDeg * Math.PI) / 180, e.pos, e.radius)) {
        hitEnemy(s, e, w.damage, p.pos, w.knockback, ev);
      }
    }
  }
  if (input.ranged && p.rangedCdMs === 0) {
    const w = s.loadout.ranged;
    p.rangedCdMs = w.cooldownMs;
    const id = s.nextId++;
    s.projectiles.push({
      id,
      pos: { x: p.pos.x + p.aim.x * 0.3, y: p.pos.y + p.aim.y * 0.3 },
      vel: { x: p.aim.x * w.speed, y: p.aim.y * w.speed },
      travelled: 0,
    });
    ev.push({ type: 'shot', projectileId: id });
  }

  // --- projektily ---
  s.projectiles = s.projectiles.filter((pr) => {
    const step = { x: pr.vel.x * dt, y: pr.vel.y * dt };
    pr.pos.x += step.x;
    pr.pos.y += step.y;
    pr.travelled += Math.hypot(step.x, step.y);
    const hit = aliveEnemies(s).find((e) => distance(e.pos, pr.pos) < e.radius + 0.08);
    const w = s.loadout.ranged;
    if (hit !== undefined) {
      hitEnemy(s, hit, w.damage, { x: pr.pos.x - pr.vel.x, y: pr.pos.y - pr.vel.y }, w.knockback, ev);
    }
    const gone = hit !== undefined || pr.travelled >= w.range || grid.isBlocked(Math.round(pr.pos.x), Math.round(pr.pos.y));
    if (gone) ev.push({ type: 'projectileGone', projectileId: pr.id });
    return !gone;
  });

  // --- korisť: zdvihne sa prechodom ---
  s.drops = s.drops.filter((d) => {
    if (distance(d.pos, p.pos) > PICKUP_RADIUS) return true;
    s.loot.push(d.item);
    ev.push({ type: 'lootPicked', dropId: d.id, item: d.item });
    return false;
  });

  // --- nepriatelia ---
  for (const e of s.enemies) stepEnemy(s, e, dtMs, grid, ev);
  stepEnemyShots(s, dt, grid, ev);
  separate(aliveEnemies(s), grid);
  s.enemies = s.enemies.filter((e) => e.phase !== 'dead' || e.phaseMs > 0);

  // --- koniec ---
  if (p.hp <= 0 && s.godMode) p.hp = p.maxHp;
  if (p.hp <= 0) {
    s.status = 'lost';
    ev.push({ type: 'playerDied' });
  } else if (!s.cleared && aliveEnemies(s).length === 0) {
    s.cleared = true;
    gain(s.rewards, scaleAmounts(CLEAR_BONUS, s.scaling.reward));
    ev.push({ type: 'cleared' });
    // garantovaná odmena za vybavenie všetkého – pri nohách manažéra
    dropLoot(s, { x: p.pos.x + 0.6, y: p.pos.y + 0.6 }, CLEAR_LUCK + s.scaling.luck, ev);
  }
  return ev;
}

function hitEnemy(s: ExpeditionState, e: EnemyState, amount: number, from: Vec2, knockback: number, ev: ExpeditionEvent[]): void {
  const def = ENEMIES[e.kind];
  if (!applyHit(e, amount, from, knockback * def.knockbackTaken, ENEMY_HIT_INVULN_MS)) return;
  ev.push({ type: 'enemyHit', enemyId: e.id, amount });
  if (e.hp <= 0) {
    e.phase = 'dead';
    e.phaseMs = CORPSE_MS;
    s.kills += 1;
    s.killsByKind[e.kind] = (s.killsByKind[e.kind] ?? 0) + 1;
    if (def.boss !== undefined) s.bossKills += 1;
    gain(s.rewards, scaleAmounts(def.reward, s.scaling.reward));
    ev.push({ type: 'enemyKilled', enemyId: e.id, kind: e.kind });
    if (!e.minion && s.rng.chance(def.lootChance)) dropLoot(s, { x: e.pos.x, y: e.pos.y }, s.scaling.luck + (def.lootLuck ?? 0), ev);
    if (def.splitInto !== undefined) split(s, e, def.splitInto, ev);
    return;
  }
  if (def.boss !== undefined && !e.enraged && e.hp <= e.maxHp * def.boss.enrageAt) {
    e.enraged = true;
    ev.push({ type: 'enraged', enemyId: e.id });
  }
  // zásah prebudí aj spiaceho audítora
  if (e.phase === 'idle') {
    e.phase = 'chase';
    ev.push({ type: 'aggro', enemyId: e.id, kind: e.kind });
  }
  if (e.phase === 'windup' && def.staggerable) {
    e.phase = 'recover';
    e.phaseMs = def.recoverMs * 0.6;
  }
}

/** Sliz sa po smrti rozdelí – kúsky sa rozletia kolmo na smer úderu. */
function split(s: ExpeditionState, e: EnemyState, into: NonNullable<EnemyDef['splitInto']>, ev: ExpeditionEvent[]): void {
  const spawned: number[] = [];
  const base = Math.atan2(e.knock.y, e.knock.x) + Math.PI / 2;
  for (let i = 0; i < into.count; i++) {
    const a = base + (i / into.count) * Math.PI * 2;
    const child = spawnEnemy(s, into.kind, { x: e.pos.x + Math.cos(a) * 0.3, y: e.pos.y + Math.sin(a) * 0.3 }, false);
    child.phase = 'chase';
    child.invulnMs = 250; // ten istý švih ich hneď nezabije
    spawned.push(child.id);
  }
  ev.push({ type: 'split', enemyId: e.id, spawned });
}

function dropLoot(s: ExpeditionState, pos: Vec2, luck: number, ev: ExpeditionEvent[]): void {
  const id = s.nextId++;
  s.drops.push({ id, item: generateItem(s.rng, `loot-${id}`, { luck }), pos });
  ev.push({ type: 'lootDropped', dropId: id });
}

function stepEnemy(s: ExpeditionState, e: EnemyState, dtMs: number, grid: CollisionGrid, ev: ExpeditionEvent[]): void {
  e.invulnMs = Math.max(0, e.invulnMs - dtMs);
  e.phaseMs -= dtMs;
  if (e.phase === 'dead') return;
  stepKnockback(e, grid, dtMs);

  const def = ENEMIES[e.kind];
  const p = s.player;
  const d = distance(e.pos, p.pos);
  const strikeRange = e.radius + def.reach + p.radius;

  if (def.boss !== undefined && e.phase !== 'idle') summon(s, e, def, dtMs, grid, ev);

  switch (e.phase) {
    case 'idle':
      if (d <= def.aggro) {
        e.phase = 'chase';
        ev.push({ type: 'aggro', enemyId: e.id, kind: e.kind });
      }
      break;
    case 'chase': {
      if (def.ranged !== undefined) {
        rangedChase(s, e, def, def.ranged, d, dtMs, grid, ev);
        break;
      }
      if (d <= strikeRange) {
        const a = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
        e.aim.x = a.x;
        e.aim.y = a.y;
        e.phase = 'windup';
        e.phaseMs = windupOf(def, e);
        ev.push({ type: 'windup', enemyId: e.id });
        break;
      }
      const dir = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
      const step = (speedOf(def, e) * dtMs) / 1000;
      const next = moveWithCollision(grid, e.pos, { x: dir.x * step, y: dir.y * step }, e.radius);
      e.pos.x = next.x;
      e.pos.y = next.y;
      break;
    }
    case 'windup':
      if (e.phaseMs > 0) break;
      if (def.ranged !== undefined) {
        const id = s.nextId++;
        const r = def.ranged;
        s.enemyShots.push({
          id,
          pos: { x: e.pos.x + e.aim.x * (e.radius + 0.1), y: e.pos.y + e.aim.y * (e.radius + 0.1) },
          vel: { x: e.aim.x * r.projectileSpeed, y: e.aim.y * r.projectileSpeed },
          travelled: 0,
          damage: Math.round(def.damage * s.scaling.enemyDamage),
          range: r.projectileRange,
        });
        ev.push({ type: 'enemyShot', enemyId: e.id, projectileId: id });
        e.phase = 'recover';
        e.phaseMs = def.recoverMs;
        break;
      }
      {
        const inReach = d <= strikeRange + STRIKE_SLACK;
        const ahead = (p.pos.x - e.pos.x) * e.aim.x + (p.pos.y - e.pos.y) * e.aim.y > 0;
        const damage = Math.round(def.damage * s.scaling.enemyDamage);
        const hit = inReach && ahead && applyHit(p, damage, e.pos, 3, PLAYER.hitInvulnMs);
        ev.push({ type: 'enemyStrike', enemyId: e.id, hit });
        if (hit) ev.push({ type: 'playerHit', amount: damage });
        e.phase = 'recover';
        e.phaseMs = def.recoverMs;
      }
      break;
    case 'recover':
      if (e.phaseMs <= 0) e.phase = 'chase';
      break;
  }
}

/** Strelec: drží si odstup a keď je manažér na dostrel, zamieri (telegrafovaná čiara) a hodí predvolanie. */
function rangedChase(
  s: ExpeditionState,
  e: EnemyState,
  def: EnemyDef,
  r: NonNullable<EnemyDef['ranged']>,
  d: number,
  dtMs: number,
  grid: CollisionGrid,
  ev: ExpeditionEvent[],
): void {
  const p = s.player;
  const toward = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
  if (d <= r.range && d >= r.preferMin * 0.5) {
    e.aim.x = toward.x;
    e.aim.y = toward.y;
    e.phase = 'windup';
    e.phaseMs = windupOf(def, e);
    ev.push({ type: 'windup', enemyId: e.id });
    return;
  }
  const sign = d < r.preferMin ? -1 : d > r.preferMax ? 1 : 0;
  if (sign === 0) return;
  const step = (speedOf(def, e) * dtMs) / 1000;
  const next = moveWithCollision(grid, e.pos, { x: toward.x * step * sign, y: toward.y * step * sign }, e.radius);
  e.pos.x = next.x;
  e.pos.y = next.y;
}

/** Predvolania letia rovno; úskok (nezraniteľnosť) nimi prejde, stena ich zastaví. */
function stepEnemyShots(s: ExpeditionState, dt: number, grid: CollisionGrid, ev: ExpeditionEvent[]): void {
  const p = s.player;
  s.enemyShots = s.enemyShots.filter((pr) => {
    const step = { x: pr.vel.x * dt, y: pr.vel.y * dt };
    pr.pos.x += step.x;
    pr.pos.y += step.y;
    pr.travelled += Math.hypot(step.x, step.y);
    let hit = false;
    if (distance(p.pos, pr.pos) < p.radius + 0.12) {
      hit = applyHit(p, pr.damage, { x: pr.pos.x - pr.vel.x, y: pr.pos.y - pr.vel.y }, 2.5, PLAYER.hitInvulnMs);
      if (hit) ev.push({ type: 'playerHit', amount: pr.damage });
    }
    const gone = hit || pr.travelled >= pr.range || grid.isBlocked(Math.round(pr.pos.x), Math.round(pr.pos.y));
    if (gone) ev.push({ type: 'enemyShotGone', projectileId: pr.id });
    return !gone;
  });
}

/** Boss raz za čas zvolá poradu: okolo neho sa objavia posily (najviac `maxMinions` naraz). */
function summon(s: ExpeditionState, boss: EnemyState, def: EnemyDef, dtMs: number, grid: CollisionGrid, ev: ExpeditionEvent[]): void {
  const b = def.boss;
  if (b === undefined) return;
  boss.summonMs -= dtMs;
  if (boss.summonMs > 0) return;
  boss.summonMs = b.summonEveryMs;
  const alive = aliveEnemies(s).filter((e) => e.minion).length;
  const count = Math.min(b.summonCount, b.maxMinions - alive);
  const spawned: number[] = [];
  for (let i = 0; i < 8 && spawned.length < count; i++) {
    const a = (i / 8) * Math.PI * 2 + s.rng.next();
    const pos = { x: boss.pos.x + Math.cos(a) * 1.2, y: boss.pos.y + Math.sin(a) * 1.2 };
    if (grid.isBlocked(Math.round(pos.x), Math.round(pos.y))) continue;
    spawned.push(spawnEnemy(s, b.summonKind, pos, true).id);
  }
  if (spawned.length > 0) ev.push({ type: 'summon', enemyId: boss.id, spawned });
}

/** Nepriatelia sa nestohujú do jedného bodu – jemne sa od seba odtláčajú. */
function separate(enemies: readonly EnemyState[], grid: CollisionGrid): void {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (b === undefined) continue;
      const min = a.radius + b.radius;
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      // presne na sebe (napr. rovnaký spawn) → deterministický „náhodný“ smer podľa id
      const angle = (a.id * 2.399 + b.id) % (Math.PI * 2);
      const nx = d > 1e-6 ? (dx / d) * push : Math.cos(angle) * push;
      const ny = d > 1e-6 ? (dy / d) * push : Math.sin(angle) * push;
      const na = moveWithCollision(grid, a.pos, { x: -nx, y: -ny }, a.radius);
      const nb = moveWithCollision(grid, b.pos, { x: nx, y: ny }, b.radius);
      a.pos.x = na.x;
      a.pos.y = na.y;
      b.pos.x = nb.x;
      b.pos.y = nb.y;
    }
  }
}
