import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { ENEMIES } from '@/data/enemies';
import { AFFIXES, BASE_ITEMS, type Item, RARITIES, RARITY } from '@/data/items';
import { PLAYER } from '@/data/player';
import { createInitialState, GameStore } from '@/state/store';
import { createExpedition, stepExpedition } from '@/systems/combat/expedition';
import { describeMods, generateItem, itemName, resolveLoadout, rollRarity } from '@/systems/loot/loot';
import { parseMap } from '@/world/TileGrid';

const item = (base: Item['base'], affixes: Item['affixes'] = [], rarity: Item['rarity'] = 'common'): Item => ({
  id: 'x',
  base,
  rarity,
  affixes,
});

describe('rarity', () => {
  it('rozdelenie dropov zodpovedá váham (±1,5 p. b.)', () => {
    const rng = new Rng(2024);
    const n = 40_000;
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<(typeof RARITIES)[number], number>;
    for (let i = 0; i < n; i++) counts[rollRarity(rng)] += 1;
    const total = RARITIES.reduce((s, r) => s + RARITY[r].weight, 0);
    for (const r of RARITIES) expect(Math.abs(counts[r] / n - RARITY[r].weight / total), r).toBeLessThan(0.015);
  });

  it('šťastie (luck) zvyšuje podiel vzácnych predmetov', () => {
    const share = (luck: number): number => {
      const rng = new Rng(7);
      let rare = 0;
      for (let i = 0; i < 10_000; i++) if (rollRarity(rng, luck) !== 'common') rare++;
      return rare / 10_000;
    };
    expect(share(1.5)).toBeGreaterThan(share(0) + 0.15);
  });
});

describe('generovanie predmetov', () => {
  it('počet afixov sedí s raritou; kliatby iba na prekliatych', () => {
    const rng = new Rng(11);
    for (let i = 0; i < 2000; i++) {
      const it = generateItem(rng, `i${i}`);
      const def = RARITY[it.rarity];
      const curses = it.affixes.filter((a) => AFFIXES[a].curse).length;
      expect(curses).toBe(def.curses);
      expect(it.affixes.length).toBeLessThanOrEqual(def.goodAffixes + def.curses);
      // najviac jeden prefix a jeden suffix
      const pos = it.affixes.map((a) => AFFIXES[a].position);
      expect(new Set(pos).size).toBe(pos.length);
      // afix sa hodí na slot
      for (const a of it.affixes) expect(AFFIXES[a].slots as readonly string[]).toContain(BASE_ITEMS[it.base].slot);
    }
  });

  it('je deterministické pri rovnakom seede', () => {
    expect(generateItem(new Rng(5), 'a')).toEqual(generateItem(new Rng(5), 'a'));
  });
});

describe('názvy', () => {
  it('prívlastok sa zhoduje v rode, suffix sa pripojí', () => {
    expect(itemName(item('puncher', ['procrastinating']))).toBe('Prokrastinujúca dierovačka');
    expect(itemName(item('rubber_band', ['urgent']))).toBe('Urgentný gumičkomet');
    expect(itemName(item('pen', ['certified', 'meeting']))).toBe('Certifikované vrhacie pero z porady, ktorá mohla byť e-mail');
    expect(itemName(item('stapler', ['employee_of_month']))).toBe('Sponkovačka zamestnanca mesiaca (posmrtne)');
  });
});

describe('výbava → štatistiky', () => {
  it('bez výbavy = základná dierovačka a sponkovačka', () => {
    const l = resolveLoadout({});
    expect(l.melee.damage).toBe(BASE_ITEMS.puncher.stats.damage);
    expect(l.ranged.damage).toBe(BASE_ITEMS.stapler.stats.damage);
    expect(l.maxHp).toBe(PLAYER.maxHp);
  });

  it('prokrastinujúca zbraň: +50 % poškodenie, pomalší útok', () => {
    const l = resolveLoadout({ melee: item('puncher', ['procrastinating']) });
    expect(l.melee.damage).toBe(18);
    expect(l.melee.cooldownMs).toBe(Math.round(380 * 1.35));
    expect(describeMods(item('puncher', ['procrastinating']))).toContain('+50 % poškodenie');
  });

  it('talizman a afixy menia zdravie, pohyb a úskok', () => {
    const l = resolveLoadout({ trinket: item('lanyard', ['laminated']) });
    expect(l.maxHp).toBe(PLAYER.maxHp + 35);
    expect(resolveLoadout({ trinket: item('mug') }).speedPx).toBeCloseTo(PLAYER.speedPx * 1.1);
    expect(resolveLoadout({ trinket: item('stress_ball') }).dashCooldownMs).toBeCloseTo(PLAYER.dash.cooldownMs * 0.8);
  });

  it('kliatba: veľká výhoda za cenu – zdravie nikdy pod 10', () => {
    const l = resolveLoadout({
      melee: item('puncher', ['cc_everyone'], 'cursed'),
      ranged: item('stapler', ['cc_everyone'], 'cursed'),
      trinket: item('mug', ['cc_everyone'], 'cursed'),
    });
    expect(l.melee.damage).toBeGreaterThan(BASE_ITEMS.puncher.stats.damage * 1.5);
    expect(l.maxHp).toBe(10);
  });

  it('výbava mení boj: silnejšia zbraň zabije audítora skôr', () => {
    const arena = parseMap(['#######', '#.@a..#', '#######']).grid;
    const hitsToKill = (melee: Item): number => {
      const s = createExpedition({ x: 2, y: 1 }, [{ kind: 'auditor', tx: 3, ty: 1 }], { loadout: resolveLoadout({ melee }) });
      let swings = 0;
      for (let t = 0; t < 10_000 && s.kills === 0; t += 16) {
        const ev = stepExpedition(s, { move: { x: 0, y: 0 }, aimAt: { x: 3, y: 1 }, melee: true, ranged: false, dash: false }, 16, arena);
        swings += ev.filter((e) => e.type === 'swing').length;
        const e = s.enemies[0];
        if (e) e.pos.x = 3; // nech stojí na mieste
        s.player.hp = 1e6;
      }
      return swings;
    };
    expect(hitsToKill(item('heavy_stapler'))).toBeLessThan(hitsToKill(item('puncher')));
  });
});

describe('korisť na expedícii', () => {
  const arena = parseMap(['########', '#.@....#', '########']).grid;
  const idle = { move: { x: 0, y: 0 }, aimAt: { x: 5, y: 1 }, melee: false, ranged: false, dash: false };

  it('vybavenie mapy dropne garantovaný predmet; prejdením sa zdvihne', () => {
    const s = createExpedition({ x: 2, y: 1 }, [{ kind: 'auditor', tx: 3, ty: 1 }], { seed: 3 });
    const e = s.enemies[0];
    if (e) e.hp = 1;
    stepExpedition(s, { ...idle, aimAt: { x: 3, y: 1 }, melee: true }, 16, arena);
    expect(s.cleared).toBe(true);
    expect(s.drops.length).toBeGreaterThanOrEqual(1);
    const drop = s.drops[s.drops.length - 1];
    if (drop === undefined) throw new Error('chýba drop');
    s.player.pos.x = drop.pos.x;
    s.player.pos.y = drop.pos.y;
    const ev = stepExpedition(s, idle, 16, arena);
    expect(ev.some((x) => x.type === 'lootPicked')).toBe(true);
    expect(s.loot.length).toBeGreaterThanOrEqual(1);
  });

  it('nepriatelia dropujú približne podľa šance', () => {
    let drops = 0;
    const runs = 400;
    for (let seed = 1; seed <= runs; seed++) {
      const s = createExpedition({ x: 2, y: 1 }, [{ kind: 'compliance', tx: 3, ty: 1 }, { kind: 'compliance', tx: 6, ty: 1 }], { seed });
      const e = s.enemies[0];
      if (e) e.hp = 1;
      const ev = stepExpedition(s, { ...idle, aimAt: { x: 3, y: 1 }, melee: true }, 16, arena);
      drops += ev.filter((x) => x.type === 'lootDropped').length;
    }
    expect(Math.abs(drops / runs - ENEMIES.compliance.lootChance)).toBeLessThan(0.08);
  });
});

describe('sklad a progresia', () => {
  it('štart: dierovačka a sponkovačka v sklade aj na sebe', () => {
    const store = new GameStore(createInitialState(1));
    expect(store.state.inventory).toHaveLength(2);
    expect(store.loadout().melee.name).toBe('Dierovačka');
  });

  it('nasadenie, skartovanie a ochrana nasadenej výbavy', () => {
    const store = new GameStore(createInitialState(1));
    const { added } = store.addLoot([item('heavy_stapler', [], 'legendary'), item('mug')]);
    const [heavy, mug] = added;
    if (!heavy || !mug) throw new Error('chýba predmet');
    expect(store.equip(heavy.id).ok).toBe(true);
    expect(store.loadout().melee.name).toBe('Priemyselná zošívačka');
    expect(store.shred(heavy.id).ok).toBe(false);
    const forms = store.state.resources.forms;
    expect(store.shred('i-start-melee').ok).toBe(true);
    expect(store.state.resources.forms).toBe(forms + RARITY.common.shredValue);
    store.equip(mug.id);
    expect(store.state.equipment.trinket).toBe(mug.id);
    store.unequipTrinket();
    expect(store.state.equipment.trinket).toBeNull();
  });

  it('plný sklad skartuje prebytok na formuláre', () => {
    const store = new GameStore(createInitialState(1));
    const many = Array.from({ length: 20 }, () => item('pen'));
    const { added, shredded } = store.addLoot(many);
    expect(store.state.inventory).toHaveLength(16);
    expect(added.length + shredded.length).toBe(20);
    expect(shredded.length).toBe(6);
  });

  it('mučiareň sa odomkne po prvej úspešnej expedícii, školenie po 10 zabitiach', () => {
    const store = new GameStore(createInitialState(1));
    store.state.resources.sulfur = 500;
    store.state.resources.forms = 500;
    expect(store.isUnlocked('torture')).toBe(false);
    expect(store.build('torture', 1, 1).ok).toBe(false);
    const unlocked: string[] = [];
    store.events.on('buildingUnlocked', (t) => unlocked.push(t));
    store.recordExpedition(false, 4);
    expect(store.isUnlocked('torture')).toBe(false);
    store.recordExpedition(true, 6);
    expect(unlocked).toEqual(['torture', 'training']);
    expect(store.build('torture', 1, 1).ok).toBe(true);
  });
});
