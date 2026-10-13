import { describe, expect, it } from 'vitest';
import { BUILDING_TYPES } from '@/data/buildings';
import { MAX_LEVEL } from '@/data/careers';
import { INVENTORY_LIMIT } from '@/data/items';
import { SINNER_KINDS } from '@/data/sinnerKinds';
import { addItem, grantAll, killAll, maxLevelAll, setFatigueAll, unlockAll } from '@/dev/cheats';
import { createInitialState, GameStore } from '@/state/store';
import { createExpedition, stepExpedition } from '@/systems/combat/expedition';
import { levelFromXp } from '@/systems/staff/sinners';
import { parseMap } from '@/world/TileGrid';

const store = (): GameStore => new GameStore(createInitialState(11));
const ARENA = parseMap(['########', '#......#', '#.@....#', '#......#', '########']).grid;
const idle = { move: { x: 0, y: 0 }, aimAt: { x: 5, y: 2 }, melee: false, ranged: false, dash: false };

describe('dev cheaty – základňa', () => {
  it('suroviny, odomknutie, úroveň, únava', () => {
    const st = store();
    const souls = st.state.resources.souls;
    grantAll(st, 100);
    expect(st.state.resources.souls).toBe(souls + 100);
    unlockAll(st);
    expect(BUILDING_TYPES.every((t) => st.isUnlocked(t))).toBe(true);
    expect(SINNER_KINDS.every((k) => st.isKindUnlocked(k))).toBe(true);
    maxLevelAll(st);
    expect(st.state.sinners.every((s) => levelFromXp(s.xp) === MAX_LEVEL)).toBe(true);
    setFatigueAll(st, 1);
    expect(st.state.sinners.every((s) => s.fatigue === 1)).toBe(true);
  });

  it('predmet sa pridá len do voľného skladu', () => {
    const st = store();
    while (st.state.inventory.length < INVENTORY_LIMIT) expect(addItem(st, 'legendary')).toBe(true);
    expect(st.state.inventory.some((i) => i.rarity === 'legendary')).toBe(true);
    expect(addItem(st, 'cursed')).toBe(false);
    expect(st.state.inventory).toHaveLength(INVENTORY_LIMIT);
  });
});

describe('dev cheaty – expedícia', () => {
  it('zabiť všetkých → poschodie sa v ďalšom kroku vybaví', () => {
    const s = createExpedition({ x: 2, y: 2 }, [
      { kind: 'auditor', tx: 5, ty: 1 },
      { kind: 'compliance', tx: 5, ty: 3 },
    ]);
    expect(killAll(s)).toBe(2);
    const ev = stepExpedition(s, idle, 16, ARENA);
    expect(ev.some((e) => e.type === 'cleared')).toBe(true);
  });

  it('zabitý CEO sa započíta do výpravy', () => {
    const s = createExpedition({ x: 2, y: 2 }, [{ kind: 'ceo', tx: 5, ty: 2 }], { depth: 5 });
    killAll(s);
    expect(s.bossKills).toBe(1);
  });

  it('nesmrteľnosť: smrteľný zásah manažéra nezabije', () => {
    const s = createExpedition({ x: 2, y: 2 }, [{ kind: 'ceo', tx: 3, ty: 2 }], { depth: 30 });
    s.godMode = true;
    s.player.hp = 1;
    for (let t = 0; t < 10_000; t += 16) stepExpedition(s, idle, 16, ARENA);
    expect(s.status).toBe('active');
    expect(s.player.hp).toBeGreaterThan(0);
  });
});
