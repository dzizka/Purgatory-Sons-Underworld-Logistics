import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_KEYS, AUDIO, AUDIO_KEYS, assetEntry } from '@/assets/manifest';

const PUBLIC = join(__dirname, '..', 'public');

/** Rozmery PNG z hlavičky IHDR – bez závislosti na knižnici. */
function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('manifest assetov', () => {
  it.each(ASSET_KEYS.filter((k) => assetEntry(k).url !== undefined))('%s: súbor existuje a sedí na mriežku', (key) => {
    const { url, sheet } = assetEntry(key);
    if (url === undefined) return;
    expect(url.startsWith('/'), 'cesta musí byť relatívna kvôli GitHub Pages base path').toBe(false);
    const path = join(PUBLIC, url);
    expect(existsSync(path), path).toBe(true);
    if (sheet !== undefined && url.endsWith('.png')) {
      const { w, h } = pngSize(path);
      expect(w % sheet.frameWidth).toBe(0);
      expect(h % sheet.frameHeight).toBe(0);
      expect((w / sheet.frameWidth) * (h / sheet.frameHeight)).toBe(sheet.frames);
    }
  });

  it.each(AUDIO_KEYS)('audio %s existuje', (key) => {
    expect(existsSync(join(PUBLIC, AUDIO[key].url))).toBe(true);
  });
});
