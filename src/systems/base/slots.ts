import type { Vec2 } from '@/systems/movement/movement';

/** Susedné dlaždice v poradí preferencie – najprv tie „pred“ budovou (bližšie ku kamere). */
const NEIGHBORS: readonly Vec2[] = [
  { x: 1, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: -1 },
];

/** Ako hlboko do susednej dlaždice pracovník stojí (0.5 = presne na hrane). */
const REACH = 0.62;

/**
 * Miesta, kde stoja pracovníci budovy na (tx, ty): vždy na priechodnej susednej dlaždici,
 * nikdy v stene ani v inej budove. Ak voľných susedov nie je dosť, miesta sa opakujú.
 */
export function workerSlots(tx: number, ty: number, count: number, isFree: (tx: number, ty: number) => boolean): Vec2[] {
  const free = NEIGHBORS.filter((d) => isFree(tx + d.x, ty + d.y));
  const dirs = free.length > 0 ? free : NEIGHBORS.slice(0, 1);
  return Array.from({ length: count }, (_, i) => {
    const d = dirs[i % dirs.length] ?? { x: 1, y: 1 };
    return { x: tx + d.x * REACH, y: ty + d.y * REACH };
  });
}
