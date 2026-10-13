import Phaser from 'phaser';
import { ASSET_KEYS, assetEntry } from '@/assets/manifest';
import { generatePlaceholder } from '@/assets/placeholders';

/**
 * Načíta assety z manifestu. Čokoľvek chýba (bez `url` alebo 404), nahradí placeholderom,
 * takže hra beží aj s prázdnym `public/assets/`.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[assets] '${file.key}' sa nenačítal (${file.url}) – použijem placeholder.`);
    });
    for (const key of ASSET_KEYS) {
      const { url } = assetEntry(key);
      if (url !== undefined) this.load.image(key, url);
    }
  }

  create(): void {
    for (const key of ASSET_KEYS) {
      if (!this.textures.exists(key)) generatePlaceholder(this, key, assetEntry(key).placeholder);
    }
    this.scene.start('BaseScene');
    this.scene.launch('UIScene');
  }
}
