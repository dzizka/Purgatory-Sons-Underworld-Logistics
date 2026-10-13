/**
 * Čistá (Phaser-free) reprezentácia dlaždicovej mapy.
 * Dlaždica (tx, ty) pokrýva world štvorec [tx - 0.5, tx + 0.5] × [ty - 0.5, ty + 0.5].
 */

export type TileKind = 'floor' | 'wall' | 'pillar' | 'desk' | 'elevator' | 'stairs' | 'void';

export interface PropPlacement {
  readonly kind: Exclude<TileKind, 'floor' | 'elevator' | 'stairs' | 'void'>;
  readonly tx: number;
  readonly ty: number;
}

export type EnemySpawnKind = 'auditor' | 'compliance' | 'ceo';

export interface ParsedMap {
  readonly grid: TileGrid;
  readonly spawn: { readonly x: number; readonly y: number };
  readonly props: readonly PropPlacement[];
  readonly elevators: readonly { readonly tx: number; readonly ty: number }[];
  readonly enemies: readonly { readonly kind: EnemySpawnKind; readonly tx: number; readonly ty: number }[];
  /** Schodisko o poschodie nižšie (procedurálny dungeon). */
  readonly stairs: readonly { readonly tx: number; readonly ty: number }[];
  /** Miesta, kde od začiatku leží korisť (sklad). */
  readonly lootSpots: readonly { readonly tx: number; readonly ty: number }[];
}

const LEGEND: Readonly<Record<string, TileKind>> = {
  '.': 'floor',
  '@': 'floor',
  '#': 'wall',
  P: 'pillar',
  D: 'desk',
  X: 'elevator',
  v: 'stairs',
  L: 'floor',
  a: 'floor',
  c: 'floor',
  B: 'floor',
  ' ': 'void',
};

const ENEMY_CHARS: Readonly<Record<string, EnemySpawnKind>> = { a: 'auditor', c: 'compliance', B: 'ceo' };

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

/** Deterministický „náhodný“ variant dlaždice – rovnaká mapa vyzerá vždy rovnako. */
export function tileVariant(tx: number, ty: number, variants: number): number {
  if (variants <= 1) return 0;
  let h = Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) % variants;
}

/**
 * ASCII mapa → grid. Riadok = world y, stĺpec = world x.
 * `.` podlaha, `#` stena, `P` stĺp, `D` stôl, `@` spawn, `X` výťah, `v` schodisko dole, `L` korisť,
 * `a` / `c` nepriateľ (audítor / compliance officer) na podlahe, `B` boss CEO, medzera = prázdno.
 */
export function parseMap(rows: readonly string[]): ParsedMap {
  const height = rows.length;
  const width = Math.max(0, ...rows.map((r) => r.length));
  const tiles: TileKind[] = [];
  const props: PropPlacement[] = [];
  const elevators: { tx: number; ty: number }[] = [];
  const enemies: { kind: EnemySpawnKind; tx: number; ty: number }[] = [];
  const stairs: { tx: number; ty: number }[] = [];
  const lootSpots: { tx: number; ty: number }[] = [];
  let spawn: { x: number; y: number } | undefined;

  for (let ty = 0; ty < height; ty++) {
    const row = rows[ty] ?? '';
    for (let tx = 0; tx < width; tx++) {
      const ch = row[tx] ?? ' ';
      const kind = LEGEND[ch];
      if (kind === undefined) throw new Error(`parseMap: neznámy znak '${ch}' na (${tx}, ${ty})`);
      tiles.push(kind);
      if (ch === '@') spawn = { x: tx, y: ty };
      if (kind === 'elevator') elevators.push({ tx, ty });
      if (kind === 'stairs') stairs.push({ tx, ty });
      if (ch === 'L') lootSpots.push({ tx, ty });
      const enemy = ENEMY_CHARS[ch];
      if (enemy !== undefined) enemies.push({ kind: enemy, tx, ty });
      if (kind === 'wall' || kind === 'pillar' || kind === 'desk') props.push({ kind, tx, ty });
    }
  }

  if (spawn === undefined) throw new Error('parseMap: mapa nemá spawn (@)');
  return { grid: new TileGrid(width, height, tiles), spawn, props, elevators, enemies, stairs, lootSpots };
}

/**
 * Je dlaždica na obrazovke viditeľná? V izometrii sa bloky s väčším x + y kreslia pred ňou –
 * ak niektorý z troch susedov „pred“ dlaždicou je vysoký blok, prekryje ju.
 */
export function isVisibleTile(grid: TileGrid, tx: number, ty: number): boolean {
  const tall = (x: number, y: number): boolean => {
    const k = grid.get(x, y);
    return k === 'wall' || k === 'pillar';
  };
  return !tall(tx + 1, ty) && !tall(tx, ty + 1) && !tall(tx + 1, ty + 1);
}
