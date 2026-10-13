import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Herná logika musí byť testovateľná bez canvasu → v týchto priečinkoch je Phaser zakázaný. */
const PURE_DIRS = ['src/core', 'src/systems', 'src/state', 'src/data'];

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('architektúra', () => {
  it.each(PURE_DIRS)('%s neimportuje phaser', (dir) => {
    for (const file of tsFiles(dir)) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from\s+['"]phaser['"]/);
    }
  });
});
