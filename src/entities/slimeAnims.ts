import type Phaser from 'phaser';
import type { AssetKey } from '@/assets/manifest';
import { punyAnimKey, type PunyClip } from '@/entities/punyAnims';
import { FACING } from '@/systems/movement/direction';

/**
 * Puny Slime má jediný riadok bez smerov: 0 pokoj, 1–2 sploštenie, 3–5 výskok,
 * 6 a 9 biely záblesk, 10–14 rozpad. Klipy registrujeme pod kľúčmi `punyAnimKey`
 * pre všetky smery, aby scéna nemusela slizy rozlišovať.
 */
const CLIPS: Readonly<Record<PunyClip, { frames: readonly number[]; rate: number; repeat: number }>> = {
  idle: { frames: [0, 1, 0, 2], rate: 4, repeat: -1 },
  walk: { frames: [0, 1, 2, 1], rate: 8, repeat: -1 },
  sword: { frames: [3, 4, 5, 4, 3], rate: 12, repeat: 0 },
  work: { frames: [0, 1], rate: 4, repeat: -1 },
  throw: { frames: [3, 4, 5], rate: 12, repeat: 0 },
  hurt: { frames: [6, 0], rate: 12, repeat: 0 },
  death: { frames: [10, 11, 12, 13, 14], rate: 10, repeat: 0 },
};

export function registerSlimeAnims(scene: Phaser.Scene, texture: AssetKey): void {
  for (const facing of FACING) {
    for (const [clip, def] of Object.entries(CLIPS) as [PunyClip, (typeof CLIPS)[PunyClip]][]) {
      const key = punyAnimKey(texture, clip, facing);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({ key, frames: def.frames.map((frame) => ({ key: texture, frame })), frameRate: def.rate, repeat: def.repeat });
    }
  }
}
