/**
 * Seedovateľný RNG (mulberry32). Stav je jedno 32-bit číslo → dá sa uložiť do savu
 * a hra po načítaní pokračuje v rovnakej sekvencii.
 */
export class Rng {
  constructor(private state: number) {
    this.state = state >>> 0;
  }

  /** Aktuálny stav – pre serializáciu. */
  get seed(): number {
    return this.state;
  }

  /** Rovnomerne v [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Celé číslo v [min, max] vrátane. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) throw new Error('Rng.pick: prázdny zoznam');
    return item;
  }

  /** `count` rôznych prvkov v náhodnom poradí. */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    while (out.length < count && pool.length > 0) {
      const [item] = pool.splice(Math.floor(this.next() * pool.length), 1);
      if (item !== undefined) out.push(item);
    }
    return out;
  }
}
