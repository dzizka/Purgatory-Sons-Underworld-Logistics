import Phaser from 'phaser';
import { ASSET_KEYS, AUDIO, AUDIO_KEYS, assetEntry } from '@/assets/manifest';
import { generatePlaceholder } from '@/assets/placeholders';

/**
 * Načíta assety z manifestu. Čokoľvek chýba (bez `url` alebo 404), nahradí placeholderom,
 * takže hra beží aj s prázdnym `public/assets/`. Chýbajúce audio sa jednoducho neprehrá.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[assets] '${file.key}' sa nenačítal (${file.url}) – použijem náhradu.`);
    });
    for (const key of ASSET_KEYS) {
      const { url, sheet } = assetEntry(key);
      if (url === undefined) continue;
      if (sheet === undefined) this.load.image(key, url);
      else this.load.spritesheet(key, url, { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
    }
    for (const key of AUDIO_KEYS) this.load.audio(key, AUDIO[key].url);
  }

  create(): void {
    for (const key of ASSET_KEYS) {
      if (this.textures.exists(key)) continue;
      const entry = assetEntry(key);
      generatePlaceholder(this, key, entry.placeholder);
      if (entry.sheet !== undefined) {
        // Rovnaké číslované snímky ako skutočný sheet → animácie a varianty fungujú aj s placeholderom.
        const tex = this.textures.get(key);
        const src = tex.getSourceImage();
        for (let i = 0; i < entry.sheet.frames; i++) tex.add(i, 0, 0, 0, src.width, src.height);
      }
    }
    this.scene.start('BaseScene');
  }
}
