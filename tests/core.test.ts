import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/EventBus';
import { Rng } from '@/core/rng';

describe('Rng', () => {
  it('rovnaký seed = rovnaká sekvencia, aj po obnovení zo stavu', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    const resumed = new Rng(a.seed);
    expect(resumed.next()).toBe(a.next());
  });

  it('int je v rozsahu vrátane hraníc a pokryje ho celý', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = r.int(1, 4);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(4);
      seen.add(v);
    }
    expect(seen.size).toBe(4);
  });

  it('sample vráti rôzne prvky', () => {
    const s = new Rng(3).sample([1, 2, 3, 4, 5], 3);
    expect(new Set(s).size).toBe(3);
  });

  it('pick z prázdneho zoznamu hodí chybu', () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });
});

describe('EventBus', () => {
  it('doručí payload, odhlásenie funguje', () => {
    const bus = new EventBus<{ ping: number }>();
    const h = vi.fn();
    const off = bus.on('ping', h);
    bus.emit('ping', 5);
    off();
    bus.emit('ping', 6);
    expect(h).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledWith(5);
  });
});
