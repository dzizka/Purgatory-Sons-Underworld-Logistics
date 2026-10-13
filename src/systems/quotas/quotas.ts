import { Rng } from '@/core/rng';
import type { EnemyKind } from '@/data/enemies';
import {
  DAILY_BONUS,
  QUOTA_REWARD,
  QUOTAS_PER_DAY,
  type Quota,
  STREAK_BONUS,
  STREAK_MAX,
} from '@/data/quotas';
import type { ResourceAmounts, ResourceId } from '@/data/resources';
import type { ProgressState } from '@/state/GameState';

export interface QuotaEntry {
  readonly quota: Quota;
  progress: number;
  claimed: boolean;
}

/** Tabuľa kvót na jeden deň. */
export interface QuotaBoard {
  /** Miestny dátum `YYYY-MM-DD`. */
  readonly day: string;
  readonly entries: QuotaEntry[];
  /** Koľko dní po sebe boli splnené všetky kvóty (pred dneškom). */
  readonly streak: number;
  /** Bonus za všetky tri kvóty už bol vyzdvihnutý. */
  bonusClaimed: boolean;
}

/** Udalosti, ktoré posúvajú kvóty. */
export type QuotaEvent =
  | { readonly type: 'produced'; readonly amounts: ResourceAmounts }
  | { readonly type: 'expedition'; readonly kills: number; readonly killsByKind: Partial<Record<EnemyKind, number>>; readonly depth: number; readonly bossKills: number }
  | { readonly type: 'hired' }
  | { readonly type: 'shredded' };

/** Miestny dátum ako kľúč dňa. */
export function dayKey(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Je `prev` deň tesne pred `day`? (oba `YYYY-MM-DD`) */
export function isDayBefore(prev: string, day: string): boolean {
  const parse = (k: string): number => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  };
  return parse(day) - parse(prev) === 24 * 60 * 60 * 1000;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Tri rôzne kvóty na deň – deterministicky pre (seed, deň). Ponúka len to, čo hráč už vie splniť
 * (právnici až po 3. poschodí, CEO až po 5.), a ciele rastú s najhlbším poschodím.
 */
export function generateQuotas(seed: number, day: string, progress: ProgressState): Quota[] {
  const rng = new Rng((seed ^ hash(day)) >>> 0);
  const deep = Math.max(1, progress.deepestFloor);
  const g = 1 + 0.15 * Math.min(deep, 10);
  const produce = (resource: ResourceId, base: number): Quota => ({ kind: 'produce', resource, target: Math.round(base * g) });
  const pool: Quota[][] = [
    [produce('souls', 25), produce('forms', 40), produce('coffee', 12), ...(progress.expeditionsWon >= 1 ? [produce('sulfur', 30)] : [])],
    [{ kind: 'kills', target: Math.round(10 * g) }],
    [
      { kind: 'killKind', enemy: 'compliance', target: Math.round(3 * g) },
      ...(deep >= 2 ? [{ kind: 'killKind', enemy: 'slime', target: Math.round(4 * g) } as const] : []),
      ...(deep >= 3 ? [{ kind: 'killKind', enemy: 'counsel', target: Math.round(3 * g) } as const] : []),
    ],
    // vrátiť sa aspoň z rekordného poschodia (najmenej z 2.)
    [{ kind: 'depth', target: Math.max(2, deep) }],
    [{ kind: 'hire', target: 2 }],
    [{ kind: 'shred', target: 3 }],
    ...(deep >= 5 ? [[{ kind: 'boss', target: 1 } as const]] : []),
  ];
  // z každej skupiny najviac jedna kvóta → tri rôzne typy
  return rng.sample(pool, QUOTAS_PER_DAY).map((group) => rng.pick(group));
}

export function createBoard(seed: number, day: string, progress: ProgressState, previous: QuotaBoard | null): QuotaBoard {
  const streak = previous !== null && previous.bonusClaimed && isDayBefore(previous.day, day) ? previous.streak + 1 : 0;
  return {
    day,
    entries: generateQuotas(seed, day, progress).map((quota) => ({ quota, progress: 0, claimed: false })),
    streak,
    bonusClaimed: false,
  };
}

export function isDone(e: QuotaEntry): boolean {
  return e.progress >= e.quota.target;
}

/** Posunie kvóty podľa udalosti. Vráti kvóty, ktoré sa práve splnili. */
export function applyQuotaEvent(board: QuotaBoard, ev: QuotaEvent): QuotaEntry[] {
  const finished: QuotaEntry[] = [];
  for (const e of board.entries) {
    if (isDone(e)) continue;
    const q = e.quota;
    let add = 0;
    let set: number | null = null;
    if (ev.type === 'produced' && q.kind === 'produce') add = ev.amounts[q.resource] ?? 0;
    else if (ev.type === 'expedition') {
      if (q.kind === 'kills') add = ev.kills;
      else if (q.kind === 'killKind') add = ev.killsByKind[q.enemy] ?? 0;
      else if (q.kind === 'depth') set = Math.max(e.progress, ev.depth);
      else if (q.kind === 'boss') add = ev.bossKills;
    } else if (ev.type === 'hired' && q.kind === 'hire') add = 1;
    else if (ev.type === 'shredded' && q.kind === 'shred') add = 1;
    if (add === 0 && set === null) continue;
    e.progress = Math.min(q.target, set ?? e.progress + add);
    if (isDone(e)) finished.push(e);
  }
  return finished;
}

function scale(a: ResourceAmounts, mult: number): ResourceAmounts {
  const out: ResourceAmounts = {};
  for (const id of Object.keys(a) as ResourceId[]) out[id] = Math.round((a[id] ?? 0) * mult);
  return out;
}

/** Násobok odmien: hĺbka (do 10. poschodia) a séria. */
export function rewardMult(board: QuotaBoard, progress: ProgressState): number {
  return (1 + 0.2 * Math.min(progress.deepestFloor, 10)) * (1 + STREAK_BONUS * Math.min(board.streak, STREAK_MAX));
}

export function quotaReward(e: QuotaEntry, board: QuotaBoard, progress: ProgressState): ResourceAmounts {
  return scale(QUOTA_REWARD[e.quota.kind], rewardMult(board, progress));
}

export function dailyBonus(board: QuotaBoard, progress: ProgressState): ResourceAmounts {
  return scale(DAILY_BONUS, rewardMult(board, progress));
}

/** Všetky kvóty dňa splnené a vyzdvihnuté → dá sa vyzdvihnúť bonus. */
export function bonusReady(board: QuotaBoard): boolean {
  return !board.bonusClaimed && board.entries.every((e) => e.claimed);
}
