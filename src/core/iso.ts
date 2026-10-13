import { TILE_HEIGHT, TILE_WIDTH } from '@/config/constants';

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** World (dlaždicové) súradnice → obrazovkové pixely. */
export function worldToScreen(p: WorldPoint): ScreenPoint {
  return {
    x: (p.x - p.y) * (TILE_WIDTH / 2),
    y: (p.x + p.y) * (TILE_HEIGHT / 2) - (p.z ?? 0),
  };
}

/** Obrazovkové pixely → world súradnice (na rovine z = 0). */
export function screenToWorld(p: ScreenPoint): WorldPoint {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  return {
    x: (p.x / halfW + p.y / halfH) / 2,
    y: (p.y / halfH - p.x / halfW) / 2,
  };
}

/**
 * Hĺbka pre Y-sorting. Objekty bližšie ku kamere (väčšie x + y) sa kreslia neskôr.
 * Výška z mierne posúva objekt dopredu, aby skákajúce entity neprepadli pod podlahu.
 */
export function isoDepth(p: WorldPoint): number {
  return (p.x + p.y) * 100 + (p.z ?? 0) * 0.01;
}
