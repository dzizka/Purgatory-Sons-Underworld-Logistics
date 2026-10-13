import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { CHATTER_IDLE, CHATTER_LEAD, CHATTER_TIRED, OFFICE_EVENTS } from '@/data/chatter';
import type { SinnerState } from '@/state/GameState';
import { pickChatter, pickOfficeEvent } from '@/systems/staff/chatter';

const sinner = (extra: Partial<SinnerState> = {}): SinnerState => ({
  id: 's',
  name: 'Test',
  kind: 'clerk',
  sin: '-',
  traits: [],
  look: 0,
  xp: 0,
  role: 'worker',
  fatigue: 0,
  assignedTo: null,
  ...extra,
});

describe('repliky hriešnikov', () => {
  it('nepridelený hovorí o čakárni, unavený o káve, vedúci o synergii', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 50; i++) {
      expect(CHATTER_IDLE).toContain(pickChatter(sinner(), null, rng));
      expect(CHATTER_LEAD).toContain(pickChatter(sinner({ role: 'lead', assignedTo: 'b' }), 'intake', rng));
    }
    const tiredLines = Array.from({ length: 100 }, () => pickChatter(sinner({ fatigue: 1, assignedTo: 'b' }), 'intake', rng));
    expect(tiredLines.filter((l) => CHATTER_TIRED.includes(l)).length).toBeGreaterThan(50);
  });

  it('vlastnosti a typ sa občas prejavia', () => {
    const rng = new Rng(2);
    const lines = new Set(Array.from({ length: 200 }, () => pickChatter(sinner({ traits: ['vegan'], kind: 'lawyer', assignedTo: 'b' }), 'torture', rng)));
    expect([...lines].some((l) => l.includes('vegán'))).toBe(true);
    expect([...lines].some((l) => l.includes('advokát') || l.includes('zmluve'))).toBe(true);
  });

  it('kancelárske udalosti: len tie, čo dávajú zmysel, a nie dvakrát po sebe', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 100; i++) {
      const e = pickOfficeEvent(new Set(), rng, 'fire');
      expect(e.needs).toBeUndefined();
      expect(e.id).not.toBe('fire');
    }
    expect(OFFICE_EVENTS.every((e) => e.who.length > 0)).toBe(true);
  });
});
