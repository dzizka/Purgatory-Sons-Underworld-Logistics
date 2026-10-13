import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/config/constants';
import { BaseScene } from '@/scenes/BaseScene';
import { BootScene } from '@/scenes/BootScene';
import { ExpeditionScene } from '@/scenes/ExpeditionScene';
import { ExpeditionUIScene } from '@/scenes/ExpeditionUIScene';
import { MenuScene } from '@/scenes/MenuScene';
import { TutorialScene } from '@/scenes/TutorialScene';
import { UIScene } from '@/scenes/UIScene';
import { session } from '@/state/session';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL s fallbackom na Canvas
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  pixelArt: true, // nearest-neighbour filtrovanie, žiadny antialiasing
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, BaseScene, UIScene, TutorialScene, ExpeditionScene, ExpeditionUIScene],
};

const game = new Phaser.Game(config);

// Simulácia základne beží nezávisle od aktívnej scény (aj počas expedícií a v menu).
game.events.on(Phaser.Core.Events.STEP, (_time: number, delta: number) => {
  session.store.tick(Math.min(delta, 250));
});

// --- ukladanie: priebežne, pri skrytí karty a pri zatváraní ---
const AUTOSAVE_MS = 15_000;
const autosave = window.setInterval(() => session.save(), AUTOSAVE_MS);
let hiddenAt: number | null = null;
const onVisibility = (): void => {
  if (document.visibilityState === 'hidden') {
    session.save();
    hiddenAt = Date.now();
  } else if (hiddenAt !== null) {
    // skrytá karta nedostáva snímky → výrobu za ten čas dopočítame naraz
    session.catchUp(Date.now() - hiddenAt);
    hiddenAt = null;
  }
};
const onPageHide = (): void => {
  session.save();
};
document.addEventListener('visibilitychange', onVisibility);
window.addEventListener('pagehide', onPageHide);

declare global {
  interface Window {
    __game?: Phaser.Game;
  }
}

// Debug handle pre konzolu a smoke testy: v dev móde alebo s ?debug v URL.
if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) {
  window.__game = game;
}

// HMR: pri hot-reloade zničíme starú inštanciu, inak by sa canvasy kopili.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.clearInterval(autosave);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    game.destroy(true);
  });
}
