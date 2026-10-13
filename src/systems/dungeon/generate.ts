import { Rng } from '@/core/rng';
import { BOSS_FLOOR_ENEMY_SHARE, depthScaling, isBossFloor } from '@/data/dungeon';

/**
 * Generátor poschodí: miestnosti spojené chodbami (minimálna kostra + pár slučiek).
 * Výstupom je ASCII mapa v rovnakom formáte ako ručné mapy → `parseMap` a zvyšok hry
 * nemusia vedieť, či mapu kreslil človek alebo generátor.
 */

export type RoomKind = 'start' | 'exit' | 'normal' | 'archive' | 'meeting' | 'storage';

export interface Room {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  kind: RoomKind;
}

export interface GeneratedFloor {
  readonly rows: string[];
  readonly rooms: readonly Room[];
  readonly seed: number;
  readonly depth: number;
}

const WALKABLE = new Set(['.', '@', 'X', 'v', 'L', 'a', 'c', 's', 'r', 'B']);
const MAX_ATTEMPTS = 12;

const center = (r: Room): { x: number; y: number } => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) });

class Canvas {
  readonly cells: string[];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = Array.from({ length: w * h }, () => '#');
  }
  inside(x: number, y: number): boolean {
    return x >= 1 && y >= 1 && x < this.w - 1 && y < this.h - 1;
  }
  get(x: number, y: number): string {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? '#' : (this.cells[y * this.w + x] ?? '#');
  }
  set(x: number, y: number, c: string): void {
    if (this.inside(x, y)) this.cells[y * this.w + x] = c;
  }
  rows(): string[] {
    return Array.from({ length: this.h }, (_, y) => this.cells.slice(y * this.w, (y + 1) * this.w).join(''));
  }
}

function overlaps(a: Room, b: Room, gap: number): boolean {
  return a.x - gap < b.x + b.w && b.x - gap < a.x + a.w && a.y - gap < b.y + b.h && b.y - gap < a.y + a.h;
}

/** Chodba v tvare L, široká 2 dlaždice (v izometrii sa úzke chodby zle čítajú). */
function corridor(c: Canvas, rng: Rng, a: Room, b: Room): void {
  const p = center(a);
  const q = center(b);
  const horizontal = (y: number, x0: number, x1: number): void => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (c.get(x, y) === '#') c.set(x, y, '.');
      if (c.get(x, y + 1) === '#') c.set(x, y + 1, '.');
    }
  };
  const vertical = (x: number, y0: number, y1: number): void => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      if (c.get(x, y) === '#') c.set(x, y, '.');
      if (c.get(x + 1, y) === '#') c.set(x + 1, y, '.');
    }
  };
  if (rng.chance(0.5)) {
    horizontal(p.y, p.x, q.x);
    vertical(q.x, p.y, q.y);
  } else {
    vertical(p.x, p.y, q.y);
    horizontal(q.y, p.x, q.x);
  }
}

/** BFS vzdialenosti po priechodných dlaždiciach. */
function distances(c: Canvas, from: { x: number; y: number }): Map<number, number> {
  const dist = new Map<number, number>([[from.y * c.w + from.x, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur === undefined) break;
    const d = dist.get(cur.y * c.w + cur.x) ?? 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      const k = n.y * c.w + n.x;
      if (!dist.has(k) && WALKABLE.has(c.get(n.x, n.y))) {
        dist.set(k, d + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

/** Vnútro miestnosti bez okrajového prstenca – dekorácia tam nikdy nezablokuje vstup. */
function interior(r: Room): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = r.y + 2; y <= r.y + r.h - 3; y++) for (let x = r.x + 2; x <= r.x + r.w - 3; x++) out.push({ x, y });
  return out;
}

function decorate(c: Canvas, rng: Rng, r: Room, depth: number): void {
  switch (r.kind) {
    case 'archive':
      // rady pultov s medzerami
      for (let y = r.y + 2; y <= r.y + r.h - 3; y += 2)
        for (let x = r.x + 2, i = 0; x <= r.x + r.w - 3; x++, i++) if (i % 4 !== 3) c.set(x, y, 'D');
      break;
    case 'meeting': {
      for (const [x, y] of [
        [r.x + 2, r.y + 2],
        [r.x + r.w - 3, r.y + 2],
        [r.x + 2, r.y + r.h - 3],
        [r.x + r.w - 3, r.y + r.h - 3],
      ] as const)
        c.set(x, y, 'P');
      const cy = Math.floor(r.y + r.h / 2);
      for (let x = r.x + 4; x <= r.x + r.w - 5; x++) c.set(x, cy, 'D'); // rokovací stôl
      break;
    }
    case 'storage': {
      const spots = rng.sample(interior(r), depth >= 3 ? 2 : 1);
      for (const s of spots) c.set(s.x, s.y, 'L');
      break;
    }
    case 'normal': {
      for (const s of rng.sample(interior(r), rng.int(0, 2))) if (c.get(s.x, s.y) === '.') c.set(s.x, s.y, 'P');
      break;
    }
    case 'start':
    case 'exit':
      break;
  }
}

function tryGenerate(rng: Rng, depth: number): { rows: string[]; rooms: Room[] } | null {
  const w = Math.min(30 + 2 * depth, 46);
  const h = Math.min(24 + 2 * depth, 38);
  const c = new Canvas(w, h);

  // --- miestnosti ---
  const target = Math.min(5 + depth, 10);
  const rooms: Room[] = [];
  for (let t = 0; t < 400 && rooms.length < target; t++) {
    const rw = rng.int(6, 11);
    const rh = rng.int(5, 9);
    const r: Room = { x: rng.int(1, w - rw - 1), y: rng.int(1, h - rh - 1), w: rw, h: rh, kind: 'normal' };
    if (!rooms.some((o) => overlaps(o, r, 2))) rooms.push(r);
  }
  if (rooms.length < 4) return null;
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) c.set(x, y, '.');

  // --- chodby: Primova kostra podľa vzdialenosti stredov + pár slučiek ---
  const dist = (a: Room, b: Room): number => {
    const p = center(a);
    const q = center(b);
    return Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
  };
  const connected = [rooms[0] as Room];
  const rest = rooms.slice(1);
  while (rest.length > 0) {
    let bestD = Infinity;
    let bestFrom: Room | undefined;
    let bestIdx = -1;
    for (const a of connected) {
      for (let i = 0; i < rest.length; i++) {
        const b = rest[i];
        if (b === undefined) continue;
        const d = dist(a, b);
        if (d < bestD) {
          bestD = d;
          bestFrom = a;
          bestIdx = i;
        }
      }
    }
    const [b] = rest.splice(bestIdx, 1);
    if (bestFrom === undefined || b === undefined) break;
    corridor(c, rng, bestFrom, b);
    connected.push(b);
  }
  for (let i = 0; i < 1 + Math.floor(depth / 3); i++) corridor(c, rng, rng.pick(rooms), rng.pick(rooms));

  // --- typy miestností ---
  const start = rooms.reduce((a, b) => (center(a).x + center(a).y <= center(b).x + center(b).y ? a : b));
  start.kind = 'start';
  const fromStart = distances(c, center(start));
  const exit = rooms
    .filter((r) => r !== start)
    .reduce((a, b) => {
      const da = fromStart.get(center(a).y * w + center(a).x) ?? 0;
      const db = fromStart.get(center(b).y * w + center(b).x) ?? 0;
      return da >= db ? a : b;
    });
  exit.kind = 'exit';
  let storage = false;
  for (const r of rooms) {
    if (r.kind !== 'normal') continue;
    const roll = rng.next();
    if (roll < 0.15 && !storage) {
      r.kind = 'storage';
      storage = true;
    } else if (roll < 0.4) r.kind = 'archive';
    else if (roll < 0.6 && r.w >= 9 && r.h >= 6) r.kind = 'meeting';
  }
  for (const r of rooms) decorate(c, rng, r, depth);

  // --- výťah, spawn, schodisko: v zadnom rohu miestnosti, aby ich nezakryla stena ---
  c.set(start.x + 1, start.y + 1, 'X');
  c.set(start.x + 2, start.y + 2, '@');
  c.set(exit.x + 1, exit.y + 1, 'v');

  // --- boss: CEO v strede najvzdialenejšej kancelárie, ostatní ho nerušia ---
  const boss = isBossFloor(depth);
  if (boss) c.set(Math.floor(exit.x + exit.w / 2), Math.floor(exit.y + exit.h / 2), 'B');

  // --- nepriatelia ---
  const s = depthScaling(depth);
  const enemyCount = boss ? Math.round(s.enemyCount * BOSS_FLOOR_ENEMY_SHARE) : s.enemyCount;
  const spawn = { x: start.x + 2, y: start.y + 2 };
  const candidates = rooms
    .filter((r) => r.kind !== 'start' && !(boss && r === exit))
    .flatMap((r) => {
      const cells: { x: number; y: number }[] = [];
      for (let y = r.y + 1; y < r.y + r.h - 1; y++)
        for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (c.get(x, y) === '.' && Math.hypot(x - spawn.x, y - spawn.y) > 7) cells.push({ x, y });
      // zasadačky sú preplnené (porada, ktorá mohla byť e-mail)
      return r.kind === 'meeting' ? [...cells, ...cells] : cells;
    });
  for (const cell of rng.sample(candidates, enemyCount)) {
    if (c.get(cell.x, cell.y) !== '.') continue;
    const roll = rng.next();
    const kind =
      roll < s.complianceShare ? 'c' : roll < s.complianceShare + s.slimeShare ? 's' : roll < s.complianceShare + s.slimeShare + s.counselShare ? 'r' : 'a';
    c.set(cell.x, cell.y, kind);
  }

  // --- kontrola: všetko priechodné dosiahnuteľné, výťah aj schodisko viditeľné ---
  const reach = distances(c, spawn);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = c.get(x, y);
      if (WALKABLE.has(ch) && !reach.has(y * w + x)) {
        if (ch !== '.') return null; // odrezaný výťah/schodisko/nepriateľ/korisť → nový pokus
        c.set(x, y, '#');
      }
    }
  // rovnaké pravidlo ako `isVisibleTile`: pred dlaždicou nesmie stáť stena ani stĺp
  const tall = (x: number, y: number): boolean => c.get(x, y) === '#' || c.get(x, y) === 'P';
  const visible = (x: number, y: number): boolean => !tall(x + 1, y) && !tall(x, y + 1) && !tall(x + 1, y + 1);
  if (!visible(start.x + 1, start.y + 1) || !visible(exit.x + 1, exit.y + 1)) return null;

  return { rows: c.rows(), rooms };
}

/** Deterministicky: rovnaký seed a hĺbka = rovnaké poschodie. */
export function generateFloor(seed: number, depth: number): GeneratedFloor {
  const rng = new Rng((seed ^ Math.imul(depth, 0x9e3779b1)) >>> 0);
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const r = tryGenerate(rng, depth);
    if (r !== null) return { ...r, seed, depth };
  }
  throw new Error(`generateFloor: nepodarilo sa vygenerovať poschodie (seed ${seed}, hĺbka ${depth})`);
}
