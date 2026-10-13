import { describe, expect, it } from 'vitest';
import { BOSS_FLOOR_ENEMY_SHARE, depthScaling, floorName, isBossFloor } from '@/data/dungeon';
import { ENEMIES } from '@/data/enemies';
import {
  bossOf,
  carryOf,
  createExpedition,
  type ExpeditionEvent,
  type ExpeditionInput,
  type ExpeditionState,
  stepExpedition,
} from '@/systems/combat/expedition';
import { generateFloor } from '@/systems/dungeon/generate';
import { parseMap } from '@/world/TileGrid';

const ARENA = parseMap([
  '################',
  '#..............#',
  '#..............#',
  '#.@............#',
  '#..............#',
  '#..............#',
  '################',
]).grid;

const idle = (aimAt = { x: 10, y: 3 }): ExpeditionInput => ({ move: { x: 0, y: 0 }, aimAt, melee: false, ranged: false, dash: false });

function run(s: ExpeditionState, ms: number, input: () => ExpeditionInput = () => idle()): ExpeditionEvent[] {
  const out: ExpeditionEvent[] = [];
  for (let t = 0; t < ms && s.status === 'active'; t += 16) out.push(...stepExpedition(s, input(), 16, ARENA));
  return out;
}

const bossFight = (depth = 5): ExpeditionState => createExpedition({ x: 2, y: 3 }, [{ kind: 'ceo', tx: 8, ty: 3 }], { depth, seed: 7 });

describe('poschodia s bossom', () => {
  it('CEO sedí na každom 5. poschodí, inde nie', () => {
    expect([1, 4, 5, 6, 10, 15].map(isBossFloor)).toEqual([false, false, true, false, true, true]);
    expect(floorName(5)).toContain('CEO');
  });

  it.each([5, 10])('hĺbka %i: práve jeden CEO, ďaleko od štartu, v miestnosti so schodiskom; menej bežných nepriateľov', (depth) => {
    for (let seed = 0; seed < 80; seed++) {
      const m = parseMap(generateFloor(seed, depth).rows);
      const bosses = m.enemies.filter((e) => e.kind === 'ceo');
      expect(bosses, `seed ${seed}`).toHaveLength(1);
      const b = bosses[0];
      const st = m.stairs[0];
      if (b === undefined || st === undefined) throw new Error('chýba boss alebo schodisko');
      expect(Math.hypot(b.tx - m.spawn.x, b.ty - m.spawn.y)).toBeGreaterThan(7);
      expect(Math.hypot(b.tx - st.tx, b.ty - st.ty)).toBeLessThan(8);
      const others = m.enemies.length - 1;
      expect(others).toBeLessThanOrEqual(Math.round(depthScaling(depth).enemyCount * BOSS_FLOOR_ENEMY_SHARE));
    }
  });

  it.each([1, 4, 6, 9])('hĺbka %i: žiadny CEO', (depth) => {
    for (let seed = 0; seed < 30; seed++) expect(parseMap(generateFloor(seed, depth).rows).enemies.some((e) => e.kind === 'ceo')).toBe(false);
  });
});

describe('CEO v boji', () => {
  it('kým o manažérovi nevie, nič nerobí; potom zvoláva poradu – posily najviac po strop', () => {
    const s = createExpedition({ x: 2, y: 3 }, [{ kind: 'ceo', tx: 14, ty: 3 }], { depth: 5, seed: 1 });
    expect(run(s, 3000).filter((e) => e.type === 'summon')).toHaveLength(0); // ďaleko, spí
    const boss = bossOf(s);
    if (boss === undefined) throw new Error('boss chýba');
    boss.phase = 'chase';
    // manažér uteká v kruhu (nesmie zomrieť), boss medzitým privoláva
    const ev = run(s, 40_000, () => idle());
    const def = ENEMIES.ceo.boss;
    if (def === undefined) throw new Error('CEO nemá BossDef');
    expect(ev.some((e) => e.type === 'summon')).toBe(true);
    const minionsEver = s.enemies.filter((e) => e.minion).length;
    expect(minionsEver).toBeLessThanOrEqual(def.maxMinions);
  });

  it('pod polovicou zdravia sa rozzúri (raz)', () => {
    const s = bossFight();
    const boss = bossOf(s);
    if (boss === undefined) throw new Error('boss chýba');
    boss.hp = Math.floor(boss.maxHp * 0.55);
    const ev: ExpeditionEvent[] = [];
    // manažér stojí tesne pri ňom a bije
    s.player.pos.x = boss.pos.x - 0.9;
    s.player.pos.y = boss.pos.y;
    for (let t = 0; t < 3000; t += 16) {
      s.player.hp = s.player.maxHp; // test rozzúrenia, nie prežitia
      ev.push(...stepExpedition(s, { ...idle(boss.pos), melee: true }, 16, ARENA));
    }
    expect(ev.filter((e) => e.type === 'enraged')).toHaveLength(1);
    expect(boss.enraged).toBe(true);
  });

  it('porazený CEO: veľká odmena, garantovaná korisť, počíta sa do výpravy aj po zostupe', () => {
    const s = bossFight();
    const boss = bossOf(s);
    if (boss === undefined) throw new Error('boss chýba');
    boss.hp = 1;
    s.player.pos.x = boss.pos.x - 0.9;
    s.player.pos.y = boss.pos.y;
    const ev = run(s, 500, () => ({ ...idle(boss.pos), melee: true }));
    expect(ev.some((e) => e.type === 'enemyKilled' && e.kind === 'ceo')).toBe(true);
    expect(ev.filter((e) => e.type === 'lootDropped').length).toBeGreaterThanOrEqual(2); // boss + vybavenie poschodia
    expect(s.rewards.sulfur).toBeGreaterThanOrEqual(ENEMIES.ceo.reward.sulfur ?? 0);
    expect(s.bossKills).toBe(1);
    const next = createExpedition({ x: 2, y: 3 }, [], { depth: 6, carry: carryOf(s) });
    expect(next.bossKills).toBe(1);
  });

  it('privolaní audítori nenesú korisť', () => {
    const s = bossFight();
    const boss = bossOf(s);
    if (boss === undefined) throw new Error('boss chýba');
    boss.phase = 'chase';
    boss.summonMs = 0;
    run(s, 32);
    const minions = s.enemies.filter((e) => e.minion);
    expect(minions.length).toBeGreaterThan(0);
    const drops = s.drops.length;
    for (const m of minions) {
      m.hp = 1;
      s.player.pos.x = m.pos.x - 0.6;
      s.player.pos.y = m.pos.y;
      run(s, 450, () => ({ ...idle(m.pos), melee: true }));
    }
    expect(s.drops.length).toBe(drops);
  });
});
