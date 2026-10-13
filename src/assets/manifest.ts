/**
 * Centrálny zoznam assetov. Kód používa iba kľúče (`AssetKey`), nikdy cesty.
 *
 * Ak `url` chýba alebo sa súbor nepodarí načítať, BootScene vygeneruje placeholder
 * podľa `placeholder`. Nový CC0 asset = doplniť `url` (cesta v `public/`) + riadok v CREDITS.md.
 */

import { TILE_HEIGHT } from '@/config/constants';

export type PlaceholderSpec =
  | { readonly kind: 'tile'; readonly fill: number; readonly stroke: number }
  | { readonly kind: 'outline'; readonly color: number }
  | {
      readonly kind: 'block';
      readonly height: number;
      /** Šírka podstavy ako zlomok dlaždice (1 = celá dlaždica). */
      readonly footprint: number;
      readonly top: number;
      readonly left: number;
      readonly right: number;
    }
  | { readonly kind: 'capsule'; readonly width: number; readonly height: number; readonly fill: number; readonly outline: number }
  | { readonly kind: 'shadow'; readonly width: number; readonly height: number };

export interface AssetEntry {
  readonly url?: string;
  /** Bod textúry (0–1), ktorý leží na world pozícii entity – pri dlaždiciach jej stred. */
  readonly origin: { readonly x: number; readonly y: number };
  readonly placeholder: PlaceholderSpec;
}

const BLOCK_ORIGIN_Y = (height: number): number => {
  // Textúra bloku má výšku TILE_HEIGHT + height, stred podstavy je TILE_HEIGHT/2 nad spodkom.
  const h = TILE_HEIGHT + height;
  return (h - TILE_HEIGHT / 2) / h;
};

export const ASSETS = {
  tile_floor_a: { origin: { x: 0.5, y: 0.5 }, placeholder: { kind: 'tile', fill: 0x3a1f2b, stroke: 0x4d2837 } },
  tile_floor_b: { origin: { x: 0.5, y: 0.5 }, placeholder: { kind: 'tile', fill: 0x331b26, stroke: 0x4d2837 } },
  tile_highlight: { origin: { x: 0.5, y: 0.5 }, placeholder: { kind: 'outline', color: 0xe8a33d } },
  block_wall: {
    origin: { x: 0.5, y: BLOCK_ORIGIN_Y(48) },
    placeholder: { kind: 'block', height: 48, footprint: 1, top: 0x6b2f3f, left: 0x4a1f2c, right: 0x3a1822 },
  },
  block_pillar: {
    origin: { x: 0.5, y: BLOCK_ORIGIN_Y(72) },
    placeholder: { kind: 'block', height: 72, footprint: 0.5, top: 0x8a7a6a, left: 0x5e5248, right: 0x483f37 },
  },
  block_desk: {
    origin: { x: 0.5, y: BLOCK_ORIGIN_Y(18) },
    placeholder: { kind: 'block', height: 18, footprint: 0.85, top: 0x7a5236, left: 0x5a3b26, right: 0x46301f },
  },
  char_player: {
    origin: { x: 0.5, y: 0.95 },
    placeholder: { kind: 'capsule', width: 18, height: 34, fill: 0xe8a33d, outline: 0x2a1408 },
  },
  fx_shadow: { origin: { x: 0.5, y: 0.5 }, placeholder: { kind: 'shadow', width: 22, height: 10 } },
} as const satisfies Record<string, AssetEntry>;

export type AssetKey = keyof typeof ASSETS;

export const ASSET_KEYS = Object.keys(ASSETS) as AssetKey[];

export function assetEntry(key: AssetKey): AssetEntry {
  return ASSETS[key];
}
