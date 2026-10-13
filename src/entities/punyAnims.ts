import type Phaser from 'phaser';
import type { AssetKey } from '@/assets/manifest';
import { FACING, type Facing, facingRow } from '@/systems/movement/direction';

/** Stĺpce sprite sheetu Puny Characters (24 snímok na riadok). */
const COLUMNS = 24;
const CLIPS = {
  idle: { frames: [0], rate: 1, repeat: -1 },
  walk: { frames: [1, 2, 3, 4], rate: 8, repeat: -1 },
  sword: { frames: [5, 6, 7], rate: 12, repeat: 0 },
  /** „Práca“ = pomalé mávanie mečom. Na papierovanie sa to podobá prekvapivo dobre. */
  work: { frames: [5, 6, 7, 6], rate: 5, repeat: -1 },
  hurt: { frames: [18, 19, 20], rate: 12, repeat: 0 },
  death: { frames: [21, 22, 23], rate: 6, repeat: 0 },
} as const;

export type PunyClip = keyof typeof CLIPS;

export function punyAnimKey(texture: AssetKey, clip: PunyClip, facing: Facing): string {
  return `${texture}:${clip}:${facing}`;
}

/** Zaregistruje všetky klipy × 8 smerov pre daný Puny sheet (idempotentné). */
export function registerPunyAnims(scene: Phaser.Scene, texture: AssetKey): void {
  for (const facing of FACING) {
    const row = facingRow(facing);
    for (const [clip, def] of Object.entries(CLIPS) as [PunyClip, (typeof CLIPS)[PunyClip]][]) {
      const key = punyAnimKey(texture, clip, facing);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: def.frames.map((c) => ({ key: texture, frame: row * COLUMNS + c })),
        frameRate: def.rate,
        repeat: def.repeat,
      });
    }
  }
}
