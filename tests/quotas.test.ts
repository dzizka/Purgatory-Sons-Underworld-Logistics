import { describe, expect, it } from 'vitest';
import { QUOTAS_PER_DAY } from '@/data/quotas';
import { completeQuotas, nextQuotaDay } from '@/dev/cheats';
import { DEFAULT_SETTINGS, parseSave, serialize } from '@/state/save';
import type { ProgressState } from '@/state/GameState';
import { createInitialState, GameStore } from '@/state/store';
import { applyQuotaEvent, createBoard, dayKey, generateQuotas, isDayBefore } from '@/systems/quotas/quotas';

const fresh: ProgressState = { expeditionsWon: 0, expeditionsLost: 0, kills: 0, deepestFloor: 0, bossesDefeated: 0 };
const veteran: ProgressState = { expeditionsWon: 30, expeditionsLost: 2, kills: 400, deepestFloor: 6, bossesDefeated: 1 };

describe('generovanie kvót', () => {
  it('tri rôzne typy, deterministicky pre deň a seed', () => {
    for (let i = 0; i < 60; i++) {
      const day = `2026-10-${String((i % 28) + 1).padStart(2, '0')}`;
      const q = generateQuotas(i, day, veteran);
      expect(q).toHaveLength(QUOTAS_PER_DAY);
      expect(new Set(q.map((x) => x.kind)).size).toBe(QUOTAS_PER_DAY);
      expect(generateQuotas(i, day, veteran)).toEqual(q);
    }
  });

  it('začiatočník nedostane právnikov, CEO ani síru, ktorú ešte nevie vyrábať', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const q of generateQuotas(seed, '2026-10-13', fresh)) {
        expect(q.kind).not.toBe('boss');
        if (q.kind === 'killKind') expect(q.enemy).toBe('compliance');
        if (q.kind === 'produce') expect(q.resource).not.toBe('sulfur');
      }
    }
  });

  it('dátumy: kľúč dňa a nadväznosť', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isDayBefore('2026-02-28', '2026-03-01')).toBe(true);
    expect(isDayBefore('2026-10-12', '2026-10-14')).toBe(false);
  });
});

describe('plnenie a odmeny', () => {
  it('výroba, výprava (len živý návrat), nábor a skartovanie posúvajú kvóty', () => {
    const board = createBoard(1, '2026-10-13', veteran, null);
    board.entries.splice(0, board.entries.length,
      { quota: { kind: 'produce', resource: 'forms', target: 10 }, progress: 0, claimed: false },
      { quota: { kind: 'killKind', enemy: 'counsel', target: 2 }, progress: 0, claimed: false },
      { quota: { kind: 'depth', target: 4 }, progress: 0, claimed: false },
    );
    expect(applyQuotaEvent(board, { type: 'produced', amounts: { forms: 6 } })).toHaveLength(0);
    expect(applyQuotaEvent(board, { type: 'produced', amounts: { forms: 6, souls: 3 } })).toHaveLength(1);
    const done = applyQuotaEvent(board, { type: 'expedition', kills: 9, killsByKind: { counsel: 3 }, depth: 4, bossKills: 0 });
    expect(done).toHaveLength(2);
    expect(board.entries.map((e) => e.progress)).toEqual([10, 2, 4]);
  });

  it('store: smrť sa nepočíta, odmeny sa vyzdvihnú raz, bonus za všetky tri dá predmet', () => {
    const st = new GameStore(createInitialState(5));
    st.refreshQuotas('2026-10-13');
    const board = st.state.quotas;
    if (board === null) throw new Error('kvóty chýbajú');
    board.entries.splice(0, board.entries.length,
      { quota: { kind: 'kills', target: 5 }, progress: 0, claimed: false },
      { quota: { kind: 'hire', target: 1 }, progress: 0, claimed: false },
      { quota: { kind: 'shred', target: 1 }, progress: 0, claimed: false },
    );
    st.recordExpedition(false, 50, 2);
    expect(board.entries[0]?.progress).toBe(0);
    st.recordExpedition(true, 5, 2);
    st.state.resources.souls = 10;
    st.hire();
    st.addLoot([{ id: 'x', base: 'mug', rarity: 'common', affixes: [] }]);
    const junk = st.state.inventory.find((i) => !st.isEquipped(i.id));
    if (junk === undefined) throw new Error('chýba predmet');
    st.shred(junk.id);
    const sulfur = st.state.resources.sulfur;
    const items = st.state.inventory.length;
    expect(st.claimQuotas()).toBe(3);
    expect(st.state.resources.sulfur).toBeGreaterThan(sulfur);
    expect(st.state.inventory.length).toBe(items + 1);
    expect(board.bonusClaimed).toBe(true);
    expect(st.claimQuotas()).toBe(0);
  });

  it('séria: splnený deň → zajtra +1, vynechaný deň → od nuly', () => {
    const st = new GameStore(createInitialState(6));
    st.refreshQuotas('2026-10-13');
    completeQuotas(st);
    st.claimQuotas();
    nextQuotaDay(st);
    expect(st.state.quotas?.day).toBe('2026-10-14');
    expect(st.state.quotas?.streak).toBe(1);
    st.refreshQuotas('2026-10-16');
    expect(st.state.quotas?.streak).toBe(0);
    expect(st.refreshQuotas('2026-10-16')).toBe(false); // ten istý deň nič nemení
  });
});

describe('save v5', () => {
  it('kvóty prežijú uloženie; v4 save dostane null; poškodené kvóty save nezhodia', () => {
    const st = new GameStore(createInitialState(7));
    st.refreshQuotas('2026-10-13');
    const r = parseSave(serialize(st.state, DEFAULT_SETTINGS, 1));
    if (!r.ok) throw new Error(r.reason);
    expect(r.save.state.quotas).toEqual(st.state.quotas);

    const { quotas: _q, ...v4 } = createInitialState(8);
    const m = parseSave(JSON.stringify({ saveVersion: 4, savedAt: 1, state: v4 }));
    if (!m.ok) throw new Error(m.reason);
    expect(m.migratedFrom).toBe(4);
    expect(m.save.state.quotas).toBeNull();

    const bad = { ...createInitialState(9), quotas: { day: 'včera', entries: 'nie' } };
    const b = parseSave(JSON.stringify({ saveVersion: 5, savedAt: 1, state: bad }));
    expect(b.ok && b.save.state.quotas).toBeNull();
  });
});
