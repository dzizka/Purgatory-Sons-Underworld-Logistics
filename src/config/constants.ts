/** Rozmery dlaždice v dimetrickej projekcii 2:1. */
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/** Interné (logické) rozlíšenie – Phaser ho škáluje na veľkosť okna. */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const COLORS = {
  background: 0x120a0f,
  tileFill: 0x3a1f2b,
  tileFillAlt: 0x2e1822,
  tileStroke: 0x6b2f3f,
  accent: 0xe8a33d,
} as const;
