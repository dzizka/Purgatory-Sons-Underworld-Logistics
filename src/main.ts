import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '@/config/constants';
import { BaseScene } from '@/scenes/BaseScene';
import { BootScene } from '@/scenes/BootScene';
import { ExpeditionScene } from '@/scenes/ExpeditionScene';
import { ExpeditionUIScene } from '@/scenes/ExpeditionUIScene';
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
  scene: [BootScene, BaseScene, UIScene, ExpeditionScene, ExpeditionUIScene],
};

const game = new Phaser.Game(config);

// Simulácia základne beží nezávisle od aktívnej scény (aj počas expedícií).
game.events.on(Phaser.Core.Events.STEP, (_time: number, delta: number) => {
  session.store.tick(Math.min(delta, 250));
});

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
    game.destroy(true);
  });
}
