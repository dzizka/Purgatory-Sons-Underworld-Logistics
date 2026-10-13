/**
 * Centrálny zoznam assetov. Kód používa iba kľúče (`AssetKey`), nikdy cesty.
 *
 * Ak `url` chýba alebo sa súbor nepodarí načítať, BootScene vygeneruje placeholder
 * podľa `placeholder`. Nový CC0 asset = doplniť `url` (cesta v `public/`) + riadok v CREDITS.md.
 */

import { TILE_HEIGHT } from '@/config/constants';
import type { BuildingType } from '@/data/buildings';

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

/** Mriežka snímok v sprite sheete. */
export interface SheetSpec {
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Počet snímok – placeholder ich vyrobí rovnako veľa, aby animácie fungovali aj bez súboru. */
  readonly frames: number;
}

export interface AssetEntry {
  /** Cesta relatívna k stránke (bez úvodného `/`, aby fungovala aj pod GitHub Pages base path). */
  readonly url?: string;
  readonly sheet?: SheetSpec;
  /** Bod snímky (0–1), ktorý leží na world pozícii entity – pri dlaždiciach jej stred. */
  readonly origin: { readonly x: number; readonly y: number };
  /** Celé číslo – pixel art škálujeme iba celočíselne. */
  readonly scale?: number;
  readonly placeholder: PlaceholderSpec;
}

const BLOCK_ORIGIN_Y = (height: number): number => {
  // Textúra bloku má výšku TILE_HEIGHT + height, stred podstavy je TILE_HEIGHT/2 nad spodkom.
  const h = TILE_HEIGHT + height;
  return (h - TILE_HEIGHT / 2) / h;
};

/** Stone Soup plný blok: bunka 64×64, horná plocha 32 px, boky 32 px. */
const SOUP_BLOCK_SHEET = { frameWidth: 64, frameHeight: 64, frames: 4 } as const;

const punySheet = (url: string, fill: number) =>
  ({
    url,
    sheet: { frameWidth: 32, frameHeight: 32, frames: 24 * 8 },
    origin: { x: 0.5, y: 23 / 32 },
    scale: 2,
    placeholder: { kind: 'capsule', width: 14, height: 18, fill, outline: 0x2a1408 },
  }) as const;

const buildingBlock = (url: string, top: number, left: number, right: number) =>
  ({
    url,
    origin: { x: 0.5, y: BLOCK_ORIGIN_Y(32) },
    placeholder: { kind: 'block', height: 32, footprint: 1, top, left, right },
  }) as const;

export const ASSETS = {
  tile_floor: {
    url: 'assets/tiles/floor_office.png',
    sheet: { frameWidth: 64, frameHeight: 32, frames: 4 },
    origin: { x: 0.5, y: 0.5 },
    placeholder: { kind: 'tile', fill: 0x3a1f2b, stroke: 0x4d2837 },
  },
  tile_highlight: { origin: { x: 0.5, y: 0.5 }, placeholder: { kind: 'outline', color: 0xe8a33d } },
  block_wall: {
    url: 'assets/tiles/wall_brick_dark.png',
    sheet: SOUP_BLOCK_SHEET,
    origin: { x: 0.5, y: BLOCK_ORIGIN_Y(32) },
    placeholder: { kind: 'block', height: 32, footprint: 1, top: 0x6b2f3f, left: 0x4a1f2c, right: 0x3a1822 },
  },
  block_pillar: {
    url: 'assets/tiles/block_hell.png',
    sheet: SOUP_BLOCK_SHEET,
    origin: { x: 0.5, y: BLOCK_ORIGIN_Y(32) },
    placeholder: { kind: 'block', height: 32, footprint: 1, top: 0xb3202a, left: 0x7a1219, right: 0x5c0d12 },
  },
  // Kancelársky nábytok v CC0 izometrickom pixel arte neexistuje → polovičné kovové bloky (výška 16 px).
  block_desk: {
    url: 'assets/tiles/desk_metal.png',
    sheet: { frameWidth: 64, frameHeight: 64, frames: 2 },
    origin: { x: 0.5, y: 0.75 },
    placeholder: { kind: 'block', height: 16, footprint: 0.85, top: 0x7a5236, left: 0x5a3b26, right: 0x46301f },
  },
  /** Puny Characters: 24 stĺpcov (animácie) × 8 riadkov (smery), snímka 32×32. */
  char_player: punySheet('assets/sprites/manager.png', 0xe8a33d),
  char_sinner_0: punySheet('assets/sprites/sinner_0.png', 0x3fa7b5),
  char_sinner_1: punySheet('assets/sprites/sinner_1.png', 0x6a9a3a),
  char_sinner_2: punySheet('assets/sprites/sinner_2.png', 0x9a4a3a),
  char_sinner_3: punySheet('assets/sprites/sinner_3.png', 0xb53f4a),
  bld_intake: buildingBlock('assets/buildings/intake.png', 0x2a2a2a, 0x1a1a1a, 0x101010),
  bld_coffee: buildingBlock('assets/buildings/coffee.png', 0x9a5a2a, 0x7a421c, 0x5c3214),
  bld_copier: buildingBlock('assets/buildings/copier.png', 0x6a5a55, 0x4a3e3a, 0x3a302c),
  bld_torture: buildingBlock('assets/buildings/torture.png', 0xc02030, 0x901820, 0x701018),
  bld_training: buildingBlock('assets/buildings/training.png', 0xd8d0b0, 0xb0a888, 0x908870),
  fx_shadow: { origin: { x: 0.5, y: 0.5 }, placeholder: { kind: 'shadow', width: 22, height: 10 } },
} as const satisfies Record<string, AssetEntry>;

export type AssetKey = keyof typeof ASSETS;

export const ASSET_KEYS = Object.keys(ASSETS) as AssetKey[];

export const BUILDING_TEXTURE = {
  intake: 'bld_intake',
  coffee: 'bld_coffee',
  copier: 'bld_copier',
  torture: 'bld_torture',
  training: 'bld_training',
} as const satisfies Record<BuildingType, AssetKey>;

export const SINNER_TEXTURES = ['char_sinner_0', 'char_sinner_1', 'char_sinner_2', 'char_sinner_3'] as const satisfies readonly AssetKey[];

export function assetEntry(key: AssetKey): AssetEntry {
  return ASSETS[key];
}

/** Počet variantov (snímok) textúry – pre náhodný výber dlaždíc. */
export function variantCount(key: AssetKey): number {
  return assetEntry(key).sheet?.frames ?? 1;
}

export interface AudioEntry {
  readonly url: string;
  readonly volume: number;
}

export const AUDIO = {
  music_base: { url: 'assets/audio/music_base.ogg', volume: 0.35 },
} as const satisfies Record<string, AudioEntry>;

export type AudioKey = keyof typeof AUDIO;

export const AUDIO_KEYS = Object.keys(AUDIO) as AudioKey[];
