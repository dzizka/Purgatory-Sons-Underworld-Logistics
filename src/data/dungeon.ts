/** Procedurálne poschodia Oddelenia reklamácií: názvy, témy a krivka obtiažnosti. */

export type FloorTheme = 'complaints' | 'archive' | 'it' | 'board';

const FLOORS: readonly { readonly name: string; readonly theme: FloorTheme }[] = [
  { name: 'Oddelenie reklamácií', theme: 'complaints' },
  { name: 'Archív sťažností', theme: 'archive' },
  { name: 'IT podpora (ticket čaká)', theme: 'it' },
  { name: 'Kancelária vedenia', theme: 'board' },
];

export function floorName(depth: number): string {
  const f = FLOORS[depth - 1];
  return f !== undefined ? f.name : `Kancelária vedenia, suterén −${depth - FLOORS.length}`;
}

export function floorTheme(depth: number): FloorTheme {
  return (FLOORS[Math.min(depth, FLOORS.length) - 1] ?? FLOORS[0])?.theme ?? 'complaints';
}

export interface DepthScaling {
  readonly enemyHp: number;
  readonly enemyDamage: number;
  /** Násobok surovín za zabitie a za vybavenie poschodia. */
  readonly reward: number;
  /** Šťastie pri drope (vyššia šanca na vzácne predmety). */
  readonly luck: number;
  readonly enemyCount: number;
  /** Podiel compliance officerov medzi nepriateľmi. */
  readonly complianceShare: number;
}

/** Každé poschodie nižšie je ťažšie – a štedrejšie. */
export function depthScaling(depth: number): DepthScaling {
  const d = Math.max(0, depth - 1);
  return {
    enemyHp: 1 + 0.18 * d,
    enemyDamage: 1 + 0.12 * d,
    reward: 1 + 0.3 * d,
    luck: 0.25 * d,
    enemyCount: Math.min(30, 8 + 3 * d),
    complianceShare: Math.min(0.5, 0.15 + 0.07 * d),
  };
}
