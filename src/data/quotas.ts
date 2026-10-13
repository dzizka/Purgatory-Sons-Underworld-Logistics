import type { EnemyKind } from '@/data/enemies';
import type { ResourceAmounts, ResourceId } from '@/data/resources';

/** Denné kvóty od vedenia: tri krátke ciele na každý deň (podľa miestneho dátumu). */

export const QUOTAS_PER_DAY = 3;
/** Séria splnených dní zvyšuje odmeny o 10 % za deň, najviac o 50 %. */
export const STREAK_BONUS = 0.1;
export const STREAK_MAX = 5;

export type Quota =
  | { readonly kind: 'produce'; readonly resource: ResourceId; readonly target: number }
  | { readonly kind: 'kills'; readonly target: number }
  | { readonly kind: 'killKind'; readonly enemy: EnemyKind; readonly target: number }
  | { readonly kind: 'depth'; readonly target: number }
  | { readonly kind: 'hire'; readonly target: number }
  | { readonly kind: 'shred'; readonly target: number }
  | { readonly kind: 'boss'; readonly target: number };

export type QuotaKind = Quota['kind'];
export const QUOTA_KINDS: readonly QuotaKind[] = ['produce', 'kills', 'killKind', 'depth', 'hire', 'shred', 'boss'];

/** Základná odmena za typ kvóty (pred násobením hĺbkou a sériou). */
export const QUOTA_REWARD: Readonly<Record<QuotaKind, ResourceAmounts>> = {
  produce: { sulfur: 15, coffee: 2 },
  kills: { sulfur: 20, forms: 10 },
  killKind: { sulfur: 25, forms: 10 },
  depth: { sulfur: 30, souls: 5 },
  hire: { forms: 15, coffee: 3 },
  shred: { forms: 10, souls: 3 },
  boss: { sulfur: 60, souls: 10, forms: 20 },
};

/** Bonus za splnenie všetkých troch kvót dňa: navyše predmet so šťastím. */
export const DAILY_BONUS: ResourceAmounts = { sulfur: 25, coffee: 3 };
export const DAILY_BONUS_LUCK = 1.5;

const ENEMY_PLURAL: Partial<Record<EnemyKind, string>> = {
  auditor: 'audítorov',
  compliance: 'compliance officerov',
  slime: 'byrokratických slizov',
  counsel: 'právnikov protistrany',
};
const RESOURCE_ACC: Readonly<Record<ResourceId, string>> = { souls: 'duší', forms: 'formulárov', sulfur: 'síry', coffee: 'šálok kávy' };

export function quotaText(q: Quota): string {
  switch (q.kind) {
    case 'produce':
      return `Vyrobiť ${q.target} ${RESOURCE_ACC[q.resource]}`;
    case 'kills':
      return `Vybaviť ${q.target} reklamácií (návrat živý)`;
    case 'killKind':
      return `Vybaviť ${q.target} ${ENEMY_PLURAL[q.enemy] ?? q.enemy}`;
    case 'depth':
      return `Vrátiť sa živý z poschodia ${q.target}+`;
    case 'hire':
      return `Nabrať ${q.target} hriešnikov`;
    case 'shred':
      return `Skartovať ${q.target} predmety`;
    case 'boss':
      return 'Poraziť CEO a vrátiť sa';
  }
}
