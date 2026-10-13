export type WeaponId = 'puncher' | 'stapler';

interface WeaponBase {
  readonly name: string;
  readonly flavor: string;
  readonly damage: number;
  readonly cooldownMs: number;
  /** Rýchlosť odhodenia zasiahnutého (dlaždice/s). */
  readonly knockback: number;
}

export interface MeleeWeapon extends WeaponBase {
  readonly kind: 'melee';
  readonly range: number;
  /** Polovičný uhol výseku v stupňoch. */
  readonly halfArcDeg: number;
}

export interface RangedWeapon extends WeaponBase {
  readonly kind: 'ranged';
  readonly speed: number;
  readonly range: number;
}

export const WEAPONS = {
  puncher: {
    kind: 'melee',
    name: 'Dierovačka',
    flavor: 'Dve dierky do každého spisu. A do každého audítora.',
    damage: 12,
    cooldownMs: 380,
    knockback: 4,
    range: 1.15,
    halfArcDeg: 60,
  },
  stapler: {
    kind: 'ranged',
    name: 'Sponkovačka',
    flavor: 'Zošije čokoľvek. Aj ústa sťažovateľom.',
    damage: 7,
    cooldownMs: 320,
    knockback: 1.5,
    speed: 9,
    range: 7,
  },
} as const satisfies Record<WeaponId, MeleeWeapon | RangedWeapon>;
