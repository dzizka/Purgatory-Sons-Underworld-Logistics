import { moveWithCollision, type CollisionGrid, type Vec2 } from '@/systems/movement/movement';

export interface MutVec {
  x: number;
  y: number;
}

/** Čokoľvek, čo sa dá udrieť: hráč aj nepriatelia. */
export interface Fighter {
  pos: MutVec;
  hp: number;
  readonly maxHp: number;
  readonly radius: number;
  invulnMs: number;
  /** Aktuálna rýchlosť odhodenia (dlaždice/s), postupne sa tlmí. */
  knock: MutVec;
}

/** Ako rýchlo sa odhodenie utlmí (1/s). */
const KNOCK_DECAY = 9;

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function normalize(v: Vec2): Vec2 {
  const l = length(v);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Zásah. Vráti `false`, ak cieľ už je mŕtvy alebo dočasne nezraniteľný.
 * Odhodenie smeruje od `from` (útočníka) k cieľu.
 */
export function applyHit(f: Fighter, amount: number, from: Vec2, knockback: number, invulnMs: number): boolean {
  if (f.hp <= 0 || f.invulnMs > 0) return false;
  f.hp = Math.max(0, f.hp - amount);
  const d = normalize({ x: f.pos.x - from.x, y: f.pos.y - from.y });
  f.knock.x += d.x * knockback;
  f.knock.y += d.y * knockback;
  f.invulnMs = invulnMs;
  return true;
}

export function stepKnockback(f: Fighter, grid: CollisionGrid, dtMs: number): void {
  if (Math.abs(f.knock.x) + Math.abs(f.knock.y) < 0.01) {
    f.knock.x = 0;
    f.knock.y = 0;
    return;
  }
  const dt = dtMs / 1000;
  const next = moveWithCollision(grid, f.pos, { x: f.knock.x * dt, y: f.knock.y * dt }, f.radius);
  f.pos.x = next.x;
  f.pos.y = next.y;
  const decay = Math.exp(-KNOCK_DECAY * dt);
  f.knock.x *= decay;
  f.knock.y *= decay;
}

/** Je cieľ (kruh) vo výseku pred útočníkom? `aim` musí byť jednotkový vektor. */
export function inArc(origin: Vec2, aim: Vec2, range: number, halfArcRad: number, target: Vec2, targetRadius: number): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const d = Math.hypot(dx, dy);
  if (d > range + targetRadius) return false;
  if (d <= targetRadius) return true; // prekrývajú sa – smer nehrá rolu
  const cos = (dx * aim.x + dy * aim.y) / d;
  // tolerancia o polomer cieľa: okraj tela vo výseku stačí
  return Math.acos(Math.max(-1, Math.min(1, cos))) <= halfArcRad + Math.asin(Math.min(1, targetRadius / d));
}
