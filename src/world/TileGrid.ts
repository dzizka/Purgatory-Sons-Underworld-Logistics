/**
 * Čistá (Phaser-free) reprezentácia dlaždicovej mapy.
 * Dlaždica (tx, ty) pokrýva world štvorec [tx - 0.5, tx + 0.5] × [ty - 0.5, ty + 0.5].
 */

export type TileKind = 'floor' | 'wall' | 'pillar' | 'desk' | 'void';

export interface PropPlacement {
  readonly kind: Exclude<TileKind, 'floor' | 'void'>;
  readonly tx: number;
  readonly ty: number;
}

export interface ParsedMap {
  readonly grid: TileGrid;
  readonly spawn: { readonly x: number; readonly y: number };
  readonly props: readonly PropPlacement[];
}

const LEGEND: Readonly<Record<string, TileKind>> = {
  '.': 'floor',
  '@': 'floor',
  '#': 'wall',
  P: 'pillar',
  D: 'desk',
  ' ': 'void',
};

const BLOCKING: ReadonlySet<TileKind> = new Set<TileKind>(['wall', 'pillar', 'desk', 'void']);

export class TileGrid {
  constructor(
    readonly width: number,
    readonly height: number,
    private readonly tiles: readonly TileKind[],
  ) {
    if (tiles.length !== width * height) {
      throw new Error(`TileGrid: očakávaných ${width * height} dlaždíc, dostal som ${tiles.length}`);
    }
  }

  inBounds(tx: number, ty: number): boolean {
    return Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  /** Mimo mapy vracia 'void' – okraj sveta je teda vždy nepriechodný. */
  get(tx: number, ty: number): TileKind {
    if (!this.inBounds(tx, ty)) return 'void';
    return this.tiles[ty * this.width + tx] ?? 'void';
  }

  isBlocked(tx: number, ty: number): boolean {
    return BLOCKING.has(this.get(tx, ty));
  }

  /** Dlaždica, do ktorej padá world bod. */
  static tileAt(x: number, y: number): { tx: number; ty: number } {
    return { tx: Math.round(x), ty: Math.round(y) };
  }
}

/**
 * ASCII mapa → grid. Riadok = world y, stĺpec = world x.
 * `.` podlaha, `#` stena, `P` stĺp, `D` stôl, `@` spawn, medzera = prázdno.
 */
export function parseMap(rows: readonly string[]): ParsedMap {
  const height = rows.length;
  const width = Math.max(0, ...rows.map((r) => r.length));
  const tiles: TileKind[] = [];
  const props: PropPlacement[] = [];
  let spawn: { x: number; y: number } | undefined;

  for (let ty = 0; ty < height; ty++) {
    const row = rows[ty] ?? '';
    for (let tx = 0; tx < width; tx++) {
      const ch = row[tx] ?? ' ';
      const kind = LEGEND[ch];
      if (kind === undefined) throw new Error(`parseMap: neznámy znak '${ch}' na (${tx}, ${ty})`);
      tiles.push(kind);
      if (ch === '@') spawn = { x: tx, y: ty };
      if (kind === 'wall' || kind === 'pillar' || kind === 'desk') props.push({ kind, tx, ty });
    }
  }

  if (spawn === undefined) throw new Error('parseMap: mapa nemá spawn (@)');
  return { grid: new TileGrid(width, height, tiles), spawn, props };
}
