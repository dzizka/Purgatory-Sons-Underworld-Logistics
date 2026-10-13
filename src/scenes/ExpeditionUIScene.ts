import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/constants';
import { formatAmounts, RESOURCE_IDS, RESOURCE_INFO } from '@/data/resources';
import type { ExpeditionOutcome, ExpeditionScene } from '@/scenes/ExpeditionScene';
import { session } from '@/state/session';
import { aliveEnemies } from '@/systems/combat/expedition';
import { floorName } from '@/data/dungeon';

const STYLE = (size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'monospace',
  fontSize: `${size}px`,
  color,
});

/** HUD expedície: zdravie, úskok, zostávajúce reklamácie, odmeny a čo medzitým robí základňa. */
export class ExpeditionUIScene extends Phaser.Scene {
  private bars!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private base!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'ExpeditionUIScene' });
  }

  create(): void {
    this.add.rectangle(8, 8, 300, 82, 0x140a10, 0.85).setOrigin(0, 0);
    const exp0 = this.expedition();
    const depth = exp0.sim.depth;
    this.add.text(16, 12, `${floorName(depth).toUpperCase()} · poschodie ${depth}`, STYLE(12, '#e8a33d'));
    this.add
      .text(GAME_WIDTH - 12, 44, `seed ${exp0.seed} · rekord: poschodie ${session.store.state.progress.deepestFloor}`, STYLE(10, '#5a3a46'))
      .setOrigin(1, 0);
    this.bars = this.add.graphics();
    this.status = this.add.text(16, 56, '', STYLE(11, '#e6d3d8')).setLineSpacing(2);
    this.base = this.add.text(GAME_WIDTH - 12, 12, '', STYLE(10, '#8a5a66')).setOrigin(1, 0).setAlign('right');
    this.hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 44, '', STYLE(12, '#7da8ff')).setOrigin(0.5, 0);
    this.add
      .text(
        12,
        GAME_HEIGHT - 20,
        `WASD pohyb · ĽTM ${this.expedition().sim.loadout.melee.name} · PTM ${this.expedition().sim.loadout.ranged.name} · Medzera úskok · E výťah`,
        STYLE(11, '#8a5a66'),
      )
      .setDepth(1);

    const exp = this.expedition();
    exp.events.once('finished', (o: ExpeditionOutcome) => this.showOutcome(o));
  }

  private expedition(): ExpeditionScene {
    return this.scene.get('ExpeditionScene') as ExpeditionScene;
  }

  override update(): void {
    const exp = this.expedition();
    const s = exp.sim;
    const p = s.player;

    this.bars.clear();
    this.bars.fillStyle(0x000000, 0.8).fillRect(16, 32, 200, 10);
    this.bars.fillStyle(p.hp > p.maxHp * 0.3 ? 0xc03030 : 0xff5050, 1).fillRect(16, 32, 200 * (p.hp / p.maxHp), 10);
    const dashReady = 1 - p.dashCdMs / s.loadout.dashCooldownMs;
    this.bars.fillStyle(0x000000, 0.8).fillRect(16, 46, 200, 4);
    this.bars.fillStyle(dashReady >= 1 ? 0x7da8ff : 0x3a4a70, 1).fillRect(16, 46, 200 * dashReady, 4);

    const left = aliveEnemies(s).length;
    const rewards = formatAmounts(s.rewards);
    this.status.setText(
      `Zdravie ${Math.ceil(p.hp)}/${p.maxHp}   Úskok ${dashReady >= 1 ? 'pripravený' : '…'}\n` +
        `${left === 0 ? 'Všetko vybavené!' : `Nevybavené reklamácie: ${left}`} · Korisť: ${rewards}` +
        (s.loot.length > 0 ? ` · predmety: ${s.loot.length}` : ''),
    );

    // Zeigarnik: základňa medzitým pracuje ďalej
    const r = session.store.state.resources;
    this.base.setText(`Základňa (beží ďalej)\n${RESOURCE_IDS.map((id) => `${RESOURCE_INFO[id].name} ${Math.floor(r[id])}`).join('  ')}`);

    const next = s.depth + 1;
    this.hint.setText(
      s.status !== 'active'
        ? ''
        : exp.onElevator
          ? left === 0
            ? 'E – odísť výťahom domov s korisťou a bonusom'
            : 'E – odísť výťahom domov (korisť si nesiete, bonus za vybavenie nie)'
          : exp.onStairs
            ? left === 0
              ? `E – zostúpiť na poschodie ${next}: ${floorName(next)} (ťažšie, lepšia korisť, smrť = všetko prepadá)`
              : `Schodisko je zamknuté, kým sú tu nevybavené reklamácie (${left}).`
            : left === 0
              ? 'Poschodie vybavené. Výťah (modrý) = domov · schodisko (oranžové) = hlbšie.'
              : '',
    );
  }

  private showOutcome(o: ExpeditionOutcome): void {
    const won = o.result === 'won';
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, won ? 0.3 : 0.6).setOrigin(0, 0);
    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 30,
        won ? 'NÁVRAT NA ZÁKLADŇU' : 'DISCIPLINÁRNE KONANIE',
        STYLE(26, won ? '#9be37a' : '#ff6b6b'),
      )
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 10,
        won
          ? `Vybavené: ${o.kills} · Odmena: ${formatAmounts(o.rewards)}`
          : 'Zamestnanec bol zhodnotený ako „nespĺňa očakávania“.\nKorisť prepadá v prospech vedenia. Návrat do kancelárie…',
        STYLE(13, '#e6d3d8'),
      )
      .setOrigin(0.5)
      .setAlign('center');
  }
}
