/**
 * 8 smerov pohľadu v poradí riadkov sprite sheetu Puny Characters
 * (v smere hodinových ručičiek od „dole“). Obrazovkové osi: +x vpravo, +y dole.
 */
export const FACING = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'] as const;
export type Facing = (typeof FACING)[number];

// index oktantu atan2 (0 = vpravo, +1 = o 45° v smere hodín) → smer
const OCTANT_TO_FACING: readonly Facing[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

/** Smer pohybu na obrazovke → jeden z 8 smerov. Nulový vstup vráti `null`. */
export function facingFromScreen(dx: number, dy: number): Facing | null {
  if (dx === 0 && dy === 0) return null;
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return OCTANT_TO_FACING[(octant + 8) % 8] ?? 'S';
}

export function facingRow(f: Facing): number {
  return FACING.indexOf(f);
}
