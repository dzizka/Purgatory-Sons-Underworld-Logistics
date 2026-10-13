import { TILE_HEIGHT, TILE_WIDTH } from '@/config/constants';

/** Minimálne rozhranie mapy, ktoré pohyb potrebuje – systém nezávisí od konkrétnej triedy. */
export interface CollisionGrid {
  isBlocked(tx: number, ty: number): boolean;
}

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Smer zo vstupu (obrazovkové osi: +x vpravo, +y dole) → world rýchlosť v dlaždiciach/s.
 * Rýchlosť je konštantná v *obrazovkových* pixeloch, takže pohyb vyzerá rovnako rýchly
 * vo všetkých 8 smeroch (inak by v izometrii vodorovný pohyb pôsobil 2× rýchlejší).
 */
export function inputToWorldVelocity(dx: number, dy: number, speedPx: number): Vec2 {
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: 0, y: 0 };
  const sx = (dx / len) * speedPx;
  const sy = (dy / len) * speedPx;
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  return {
    x: (sx / halfW + sy / halfH) / 2,
    y: (sy / halfH - sx / halfW) / 2,
  };
}

/** Prekrýva sa kruh (x, y, r) s niektorou blokovanou dlaždicou? */
export function collides(grid: CollisionGrid, x: number, y: number, radius: number): boolean {
  const minTx = Math.round(x - radius);
  const maxTx = Math.round(x + radius);
  const minTy = Math.round(y - radius);
  const maxTy = Math.round(y + radius);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!grid.isBlocked(tx, ty)) continue;
      const nx = Math.max(tx - 0.5, Math.min(x, tx + 0.5));
      const ny = Math.max(ty - 0.5, Math.min(y, ty + 0.5));
      if ((x - nx) ** 2 + (y - ny) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

/**
 * Posun s kolíziami, osi riešené zvlášť → entita sa „šmýka“ popri stenách.
 * Krok sa delí na menšie podkroky, aby rýchla entita pri nízkom FPS nepreletela cez stenu.
 */
export function moveWithCollision(grid: CollisionGrid, pos: Vec2, delta: Vec2, radius: number): Vec2 {
  const maxStep = radius * 0.5;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y)) / maxStep));
  let { x, y } = pos;
  const stepX = delta.x / steps;
  const stepY = delta.y / steps;
  for (let i = 0; i < steps; i++) {
    if (stepX !== 0 && !collides(grid, x + stepX, y, radius)) x += stepX;
    if (stepY !== 0 && !collides(grid, x, y + stepY, radius)) y += stepY;
  }
  return { x, y };
}
