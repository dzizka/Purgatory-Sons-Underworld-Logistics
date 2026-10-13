import { describe, expect, it } from 'vitest';
import {
  CORRUPT_BACKUP_KEY,
  DEFAULT_SETTINGS,
  loadFromStorage,
  parseSave,
  SAVE_KEY,
  SAVE_VERSION,
  serialize,
  type StorageLike,
  writeToStorage,
} from '@/state/save';
import { createInitialState, GameStore } from '@/state/store';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

/** Stav s budovou, pridelením a predmetom – aby round-trip niečo testoval. */
function busyState() {
  const store = new GameStore(createInitialState(42));
  store.build('intake', 3, 3);
  const b = store.buildingAt(3, 3);
  const s = store.state.sinners[0];
  if (b && s) store.assign(s.id, b.id);
  store.addLoot([{ id: 'x', base: 'mug', rarity: 'legendary', affixes: ['ergonomic', 'severance'] }]);
  store.tick(4000);
  return store.state;
}

describe('serializácia', () => {
  it('round-trip zachová celý stav', () => {
    const state = busyState();
    const r = parseSave(serialize(state, DEFAULT_SETTINGS, 1000));
    if (!r.ok) throw new Error(r.reason);
    // status budov sa po načítaní prepočíta, ostatné musí sedieť presne
    expect(r.save.state.buildings.map((b) => ({ ...b, status: 'idle' }))).toEqual(state.buildings.map((b) => ({ ...b, status: 'idle' })));
    expect({ ...r.save.state, buildings: [] }).toEqual({ ...state, buildings: [] });
    expect(r.save.savedAt).toBe(1000);
    expect(r.save.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.migratedFrom).toBeNull();
  });
});

describe('poškodené a cudzie savy', () => {
  it.each([
    ['nie JSON', 'toto nie je json {'],
    ['prázdny objekt', '{}'],
    ['záporné suroviny', JSON.stringify({ saveVersion: 1, savedAt: 0, state: { ...createInitialState(1), resources: { souls: -5, forms: 0, sulfur: 0, coffee: 0 } } })],
    ['neznáma budova', JSON.stringify({ saveVersion: 1, savedAt: 0, state: { ...createInitialState(1), buildings: [{ id: 'b', type: 'casino', tx: 1, ty: 1, progress: 0 }] } })],
    ['neznámy predmet', JSON.stringify({ saveVersion: 1, savedAt: 0, state: { ...createInitialState(1), inventory: [{ id: 'i', base: 'bfg', rarity: 'common', affixes: [] }] } })],
    ['NaN v čase', '{"saveVersion":1,"savedAt":0,"state":{"timeMs":"NaN"}}'],
  ])('%s → odmietnuté s dôvodom, bez výnimky', (_name, json) => {
    const r = parseSave(json);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
  });

  it('save z novšej verzie hry sa odmietne', () => {
    const r = parseSave(JSON.stringify({ saveVersion: SAVE_VERSION + 1, savedAt: 0, state: createInitialState(1) }));
    expect(r.ok).toBe(false);
  });

  it('pridelenie do neexistujúcej budovy a výbava mimo skladu sa opravia, nie zhodia hru', () => {
    const state = createInitialState(1);
    const broken = {
      ...state,
      sinners: state.sinners.map((s) => ({ ...s, assignedTo: 'b-ghost' })),
      equipment: { melee: 'i-ghost', ranged: 'i-start-ranged', trinket: null },
    };
    const r = parseSave(JSON.stringify({ saveVersion: 1, savedAt: 0, state: broken }));
    if (!r.ok) throw new Error(r.reason);
    expect(r.save.state.sinners.every((s) => s.assignedTo === null)).toBe(true);
    expect(r.save.state.equipment.melee).toBeNull();
    expect(r.save.state.equipment.ranged).toBe('i-start-ranged');
  });

  it('chýbajúce nastavenia → predvolené', () => {
    const r = parseSave(JSON.stringify({ saveVersion: 1, savedAt: 0, state: createInitialState(1) }));
    expect(r.ok && r.save.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('migrácie', () => {
  it('save v0 (bez skladu a progresie) sa zmigruje a dostane štartovú výbavu', () => {
    const { inventory: _i, equipment: _e, progress: _p, ...v0 } = createInitialState(3);
    const r = parseSave(JSON.stringify({ saveVersion: 0, savedAt: 5, state: v0 }));
    if (!r.ok) throw new Error(r.reason);
    expect(r.migratedFrom).toBe(0);
    expect(r.save.state.inventory).toHaveLength(2);
    expect(r.save.state.equipment.melee).toBe('i-start-melee');
    expect(r.save.state.progress.kills).toBe(0);
    expect(r.save.state.progress.deepestFloor).toBe(0); // v0 → v1 → v2
  });
});

describe('migrácia v1 → v2', () => {
  it('save v1 bez rekordu poschodia dostane deepestFloor 0', () => {
    const state = createInitialState(4);
    const { deepestFloor: _d, ...progressV1 } = state.progress;
    const r = parseSave(JSON.stringify({ saveVersion: 1, savedAt: 5, state: { ...state, progress: progressV1 } }));
    if (!r.ok) throw new Error(r.reason);
    expect(r.migratedFrom).toBe(1);
    expect(r.save.state.progress.deepestFloor).toBe(0);
  });

  it('rekord sa zapíše iba pri úspešnom návrate a iba keď je hlbší', () => {
    const store = new GameStore(createInitialState(1));
    store.recordExpedition(true, 3, 3);
    store.recordExpedition(false, 9, 6);
    store.recordExpedition(true, 1, 2);
    expect(store.state.progress.deepestFloor).toBe(3);
  });
});

describe('úložisko', () => {
  it('bez savu = none; po zápise = ok', () => {
    const st = memoryStorage();
    expect(loadFromStorage(st).kind).toBe('none');
    expect(writeToStorage(st, serialize(createInitialState(1), DEFAULT_SETTINGS, 1))).toBe(true);
    expect(loadFromStorage(st).kind).toBe('ok');
  });

  it('poškodený save sa odloží do zálohy a hlási sa ako corrupt', () => {
    const st = memoryStorage({ [SAVE_KEY]: '{rozbité' });
    const r = loadFromStorage(st);
    expect(r.kind).toBe('corrupt');
    expect(st.data[CORRUPT_BACKUP_KEY]).toBe('{rozbité');
  });

  it('úložisko, ktoré hádže (súkromné okno), hru nezhodí', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => undefined,
    };
    expect(loadFromStorage(throwing).kind).toBe('none');
    expect(writeToStorage(throwing, '{}')).toBe(false);
    expect(loadFromStorage(null).kind).toBe('none');
  });
});
