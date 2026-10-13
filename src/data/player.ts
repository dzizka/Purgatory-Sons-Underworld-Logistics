/** Parametre manažéra – spoločné pre základňu aj expedície. */
export const PLAYER = {
  /** Rýchlosť v obrazovkových pixeloch za sekundu. */
  speedPx: 150,
  /** Polomer kolízie v dlaždiciach. */
  radius: 0.28,
  maxHp: 100,
  /** Neporaziteľnosť po zásahu (ms) – čas na únik, nie na kávu. */
  hitInvulnMs: 650,
  /** Úskok: rýchlosť v dlaždiciach/s (≈ 1,9 dlaždice za úskok). */
  dash: { durationMs: 170, speed: 11, invulnMs: 260, cooldownMs: 750 },
} as const;
