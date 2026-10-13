/**
 * Ručne kreslené mapy. Riadok = world y, stĺpec = world x.
 * `.` podlaha · `#` stena · `P` stĺp · `D` stôl · `@` spawn · medzera = prázdno
 */
export const PROCESSING_OFFICE: readonly string[] = [
  '########################',
  '#......................#',
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
