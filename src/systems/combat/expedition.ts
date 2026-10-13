import { CLEAR_BONUS, ENEMIES, type EnemyKind } from '@/data/enemies';
import { PLAYER } from '@/data/player';
import { emptyResources, gain, type Resources } from '@/data/resources';
import { WEAPONS } from '@/data/weapons';
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
}

export interface Projectile {
  readonly id: number;
  pos: MutVec;
  readonly vel: Vec2;
  travelled: number;
}

export type ExpeditionStatus = 'active' | 'won' | 'lost';

export interface ExpeditionState {
  player: PlayerCombat;
  enemies: EnemyState[];
  projectiles: Projectile[];
  nextId: number;
  kills: number;
  /** Odmeny, ktoré sa pripíšu základni pri návrate výťahom. Pri smrti prepadnú. */
  rewards: Resources;
  cleared: boolean;
  status: ExpeditionStatus;
  timeMs: number;
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
  | { readonly type: 'enemyStrike'; readonly enemyId: number; readonly hit: boolean }
  | { readonly type: 'playerHit'; readonly amount: number }
  | { readonly type: 'playerDied' }
  | { readonly type: 'dash' }
  | { readonly type: 'cleared' };

export function createExpedition(spawn: Vec2, enemies: readonly { kind: EnemyKind; tx: number; ty: number }[]): ExpeditionState {
  let nextId = 1;
  return {
    player: {
      pos: { x: spawn.x, y: spawn.y },
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
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
    enemies: enemies.map((e) => {
      const def = ENEMIES[e.kind];
      return {
        id: nextId++,
        kind: e.kind,
        pos: { x: e.tx, y: e.ty },
        hp: def.maxHp,
        maxHp: def.maxHp,
        radius: def.radius,
        invulnMs: 0,
        knock: { x: 0, y: 0 },
        phase: 'idle',
        phaseMs: 0,
        aim: { x: 0, y: 1 },
      };
    }),
    projectiles: [],
    nextId,
    kills: 0,
    rewards: emptyResources(),
    cleared: enemies.length === 0,
    status: 'active',
    timeMs: 0,
  };
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
  const walk = inputToWorldVelocity(input.move.x, input.move.y, PLAYER.speedPx);
  if (input.dash && p.dashCdMs === 0 && p.dashMs === 0) {
    const dir = walk.x !== 0 || walk.y !== 0 ? normalize(walk) : p.aim;
    p.dashDir.x = dir.x * PLAYER.dash.speed;
    p.dashDir.y = dir.y * PLAYER.dash.speed;
    p.dashMs = PLAYER.dash.durationMs;
    p.dashCdMs = PLAYER.dash.cooldownMs;
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
    const w = WEAPONS.puncher;
    p.meleeCdMs = w.cooldownMs;
    ev.push({ type: 'swing', aim: { ...p.aim } });
    for (const e of aliveEnemies(s)) {
      if (inArc(p.pos, p.aim, w.range, (w.halfArcDeg * Math.PI) / 180, e.pos, e.radius)) {
        hitEnemy(s, e, w.damage, p.pos, w.knockback, ev);
      }
    }
  }
  if (input.ranged && p.rangedCdMs === 0) {
    const w = WEAPONS.stapler;
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
    const w = WEAPONS.stapler;
    if (hit !== undefined) {
      hitEnemy(s, hit, w.damage, { x: pr.pos.x - pr.vel.x, y: pr.pos.y - pr.vel.y }, w.knockback, ev);
    }
    const gone = hit !== undefined || pr.travelled >= w.range || grid.isBlocked(Math.round(pr.pos.x), Math.round(pr.pos.y));
    if (gone) ev.push({ type: 'projectileGone', projectileId: pr.id });
    return !gone;
  });

  // --- nepriatelia ---
  for (const e of s.enemies) stepEnemy(s, e, dtMs, grid, ev);
  separate(aliveEnemies(s), grid);
  s.enemies = s.enemies.filter((e) => e.phase !== 'dead' || e.phaseMs > 0);

  // --- koniec ---
  if (p.hp <= 0) {
    s.status = 'lost';
    ev.push({ type: 'playerDied' });
  } else if (!s.cleared && aliveEnemies(s).length === 0) {
    s.cleared = true;
    gain(s.rewards, CLEAR_BONUS);
    ev.push({ type: 'cleared' });
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
    gain(s.rewards, def.reward);
    ev.push({ type: 'enemyKilled', enemyId: e.id, kind: e.kind });
    return;
  }
  // zásah prebudí aj spiaceho audítora
  if (e.phase === 'idle') e.phase = 'chase';
  if (e.phase === 'windup' && def.staggerable) {
    e.phase = 'recover';
    e.phaseMs = def.recoverMs * 0.6;
  }
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

  switch (e.phase) {
    case 'idle':
      if (d <= def.aggro) e.phase = 'chase';
      break;
    case 'chase': {
      if (d <= strikeRange) {
        const a = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
        e.aim.x = a.x;
        e.aim.y = a.y;
        e.phase = 'windup';
        e.phaseMs = def.windupMs;
        ev.push({ type: 'windup', enemyId: e.id });
        break;
      }
      const dir = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
      const step = (def.speed * dtMs) / 1000;
      const next = moveWithCollision(grid, e.pos, { x: dir.x * step, y: dir.y * step }, e.radius);
      e.pos.x = next.x;
      e.pos.y = next.y;
      break;
    }
    case 'windup':
      if (e.phaseMs > 0) break;
      {
        const inReach = d <= strikeRange + STRIKE_SLACK;
        const ahead = (p.pos.x - e.pos.x) * e.aim.x + (p.pos.y - e.pos.y) * e.aim.y > 0;
        const hit = inReach && ahead && applyHit(p, def.damage, e.pos, 3, PLAYER.hitInvulnMs);
        ev.push({ type: 'enemyStrike', enemyId: e.id, hit });
        if (hit) ev.push({ type: 'playerHit', amount: def.damage });
        e.phase = 'recover';
        e.phaseMs = def.recoverMs;
      }
      break;
    case 'recover':
      if (e.phaseMs <= 0) e.phase = 'chase';
      break;
  }
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
