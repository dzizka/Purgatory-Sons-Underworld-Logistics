import type Phaser from 'phaser';
import type { AssetKey } from '@/assets/manifest';
import { punyAnimKey, type PunyClip } from '@/entities/punyAnims';
import { FACING, facingRow } from '@/systems/movement/direction';

/**
 * Sheet bossa CEO: pre každý smer (v poradí `FACING`) za sebou snímky animácií
 * Idle, Walk, Combo, Damaged, Die – presne ako ich skladá `tools/import_assets.py`.
 */
const SEGMENTS = { idle: 11, walk: 12, combo: 13, damaged: 6, die: 11 } as const;
export const CEO_FRAMES_PER_DIR = Object.values(SEGMENTS).reduce((a, b) => a + b, 0);

type Segment = keyof typeof SEGMENTS;

function segmentStart(seg: Segment): number {
  let start = 0;
  for (const [k, n] of Object.entries(SEGMENTS) as [Segment, number][]) {
    if (k === seg) return start;
    start += n;
  }
  return start;
}

/** Klipy majú rovnaké mená ako pri Puny postavách, aby scéna nemusela rozlišovať. */
const CLIPS: Readonly<Record<PunyClip, { seg: Segment; rate: number; repeat: number }>> = {
  idle: { seg: 'idle', rate: 6, repeat: -1 },
  walk: { seg: 'walk', rate: 12, repeat: -1 },
  sword: { seg: 'combo', rate: 13, repeat: 0 },
  work: { seg: 'idle', rate: 6, repeat: -1 },
  throw: { seg: 'combo', rate: 13, repeat: 0 },
  hurt: { seg: 'damaged', rate: 12, repeat: 0 },
  death: { seg: 'die', rate: 10, repeat: 0 },
};

/** Zaregistruje klipy × 8 smerov pod rovnakými kľúčmi ako `punyAnimKey` (idempotentné). */
export function registerCeoAnims(scene: Phaser.Scene, texture: AssetKey): void {
  for (const facing of FACING) {
    const base = facingRow(facing) * CEO_FRAMES_PER_DIR;
    for (const [clip, def] of Object.entries(CLIPS) as [PunyClip, (typeof CLIPS)[PunyClip]][]) {
      const key = punyAnimKey(texture, clip, facing);
      if (scene.anims.exists(key)) continue;
      const start = base + segmentStart(def.seg);
      scene.anims.create({
        key,
        frames: Array.from({ length: SEGMENTS[def.seg] }, (_, i) => ({ key: texture, frame: start + i })),
        frameRate: def.rate,
        repeat: def.repeat,
      });
    }
  }
}
