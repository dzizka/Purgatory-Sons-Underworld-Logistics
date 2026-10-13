/**
 * Ručne kreslené mapy. Riadok = world y, stĺpec = world x.
 * `.` podlaha · `#` stena · `P` stĺp · `D` stôl · `o` dekorácia · `@` spawn · `X` výťah · `v` schodisko · `L` korisť
 * `a` audítor · `c` compliance officer · medzera = prázdno
 * Expedičné poschodia generuje `systems/dungeon/generate.ts` v rovnakom formáte.
 */
export const PROCESSING_OFFICE: readonly string[] = [
  '########################',
  '#...........X..........#',
  '#..P.....P......P....P.#',
  '#......................#',
  '#..DDD..DDD....DDD..DD.#',
  '#......................#',
  '#..DDD..DDD....DDD..DD.#',
  '#..........@...........#',
  '#..P.....P......P....P.#',
  '#......................#',
  '#####.......############',
  '    #.......#           ',
  '    #...P...#           ',
  '    #.......#           ',
  '    #########           ',
];

/** Snímky sheetu `deco_office`. */
export const DECOR = { plant: 0, trash: 1, coatRack: 2, fridge: 3, tv: 4, sofa: 5, radio: 6, shelf: 7 } as const;
export type DecorKind = keyof typeof DECOR;

/**
 * Dekorácie kancelárie – pri stenách, mimo cesty k výťahu. Sú to prekážky a nedá sa na ne stavať.
 * (Výťah je na (12, 1), čakáreň x 5–11, y 11–13.)
 */
export const BASE_DECOR: readonly { readonly kind: DecorKind; readonly tx: number; readonly ty: number }[] = [
  { kind: 'plant', tx: 1, ty: 1 },
  { kind: 'fridge', tx: 5, ty: 1 },
  { kind: 'tv', tx: 8, ty: 1 },
  { kind: 'radio', tx: 16, ty: 1 },
  { kind: 'shelf', tx: 19, ty: 1 },
  { kind: 'plant', tx: 22, ty: 1 },
  { kind: 'coatRack', tx: 1, ty: 5 },
  { kind: 'trash', tx: 1, ty: 9 },
  { kind: 'trash', tx: 22, ty: 7 },
  { kind: 'plant', tx: 22, ty: 9 },
  { kind: 'sofa', tx: 11, ty: 13 },
  { kind: 'plant', tx: 5, ty: 13 },
];

/** Kde sa manažér objaví po návrate z expedície (pred výťahom pri zadnej stene). */
export const BASE_ELEVATOR_ARRIVAL = { x: 12, y: 2 } as const;

/** Čakáreň (dolná miestnosť): kde postávajú nepridelení hriešnici. Stavať sa tu nedá. */
export const LOUNGE_AREA = { minX: 5, maxX: 11, minY: 11, maxY: 13 } as const;

export const LOUNGE_SPOTS: readonly { x: number; y: number }[] = [
  { x: 6, y: 11.2 }, { x: 7.2, y: 11.4 }, { x: 9, y: 11.2 }, { x: 10.2, y: 11.5 },
  { x: 6.3, y: 12.6 }, { x: 10, y: 12.7 }, { x: 6.8, y: 13.2 }, { x: 9.4, y: 13.1 },
  { x: 7.6, y: 12.9 }, { x: 8.6, y: 11.6 },
];

export function inLounge(tx: number, ty: number): boolean {
  const a = LOUNGE_AREA;
  return tx >= a.minX && tx <= a.maxX && ty >= a.minY && ty <= a.maxY;
}
