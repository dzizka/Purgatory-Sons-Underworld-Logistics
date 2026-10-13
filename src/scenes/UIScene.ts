import Phaser from 'phaser';
import { BASE_EVENTS, type TileInfo } from '@/scenes/BaseScene';
import type { TileKind } from '@/world/TileGrid';

const TILE_LABEL: Readonly<Record<TileKind, string>> = {
  floor: 'Podlaha (nepovinne umytá)',
  wall: 'Nosná stena (nosí hlavne výčitky)',
  pillar: 'Stĺp firemných hodnôt',
  desk: 'Pracovný stôl, model „Večný Open-space“',
  void: 'Nič',
};

/**
 * HUD overlay. Beží ako samostatná scéna s vlastnou kamerou, takže zoom
 * hernej kamery ho neškáluje.
 */
export class UIScene extends Phaser.Scene {
  private hoverText!: Phaser.GameObjects.Text;
  private selectText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const style = { fontFamily: 'monospace', fontSize: '14px', color: '#e8a33d' };
    this.add.text(16, 16, 'PURGATORY & LOGISTICS\nOddelenie spracovania duší', style);
    this.hoverText = this.add.text(16, 60, '', { ...style, fontSize: '12px', color: '#c9a0a8' });
    this.selectText = this.add.text(16, 78, '', { ...style, fontSize: '12px', color: '#c9a0a8' });
    this.add.text(16, this.scale.height - 28, 'WASD / šípky – pohyb · koliesko – zoom · klik – inšpekcia dlaždice', {
      ...style,
      fontSize: '12px',
      color: '#8a5a66',
    });

    const base = this.scene.get('BaseScene');
    base.events.on(BASE_EVENTS.tileHover, (t: TileInfo) => {
      this.hoverText.setText(`Kurzor: [${t.tx}, ${t.ty}] ${TILE_LABEL[t.kind]}`);
    });
    base.events.on(BASE_EVENTS.tileSelect, (t: TileInfo) => {
      const verdict = t.walkable ? 'priechodné' : 'nepriechodné – podajte žiadosť na odstránenie';
      this.selectText.setText(`Inšpekcia: [${t.tx}, ${t.ty}] ${verdict}`);
    });
  }
}
