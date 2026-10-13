/** Rozmery dlaždice v dimetrickej projekcii 2:1. */
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/** Interné (logické) rozlíšenie – Phaser ho škáluje na veľkosť okna. */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Hĺbka podlahy – vždy pod všetkými Y-sortovanými objektmi. */
export const FLOOR_DEPTH = -1_000_000;

export const COLORS = {
  background: 0x120a0f,
  accent: 0xe8a33d,
} as const;
