export const RESOURCE_IDS = ['souls', 'forms', 'sulfur', 'coffee'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];
export type Resources = Record<ResourceId, number>;
export type ResourceAmounts = Partial<Resources>;

export const RESOURCE_INFO: Readonly<Record<ResourceId, { name: string; short: string; flavor: string }>> = {
  souls: { name: 'Duše', short: 'D', flavor: 'Primárna surovina. Reklamácie neprijímame.' },
  forms: { name: 'Formuláre', short: 'F', flavor: 'Trojmo. Modrým perom. Nie týmto modrým.' },
  sulfur: { name: 'Síra', short: 'S', flavor: 'Mena očistca. Vonia ako pondelok.' },
  coffee: { name: 'Káva', short: 'K', flavor: 'Vždy jej je o jednu šálku menej, než treba.' },
};

export function emptyResources(): Resources {
  return { souls: 0, forms: 0, sulfur: 0, coffee: 0 };
}

export function canAfford(have: Resources, cost: ResourceAmounts): boolean {
  return (Object.keys(cost) as ResourceId[]).every((id) => have[id] >= (cost[id] ?? 0));
}

export function spend(have: Resources, cost: ResourceAmounts): void {
  for (const id of Object.keys(cost) as ResourceId[]) have[id] -= cost[id] ?? 0;
}

export function gain(have: Resources, amount: ResourceAmounts): void {
  for (const id of Object.keys(amount) as ResourceId[]) have[id] += amount[id] ?? 0;
}

/** „10 S, 5 F“ – krátky zápis pre UI. */
export function formatAmounts(a: ResourceAmounts): string {
  const parts = RESOURCE_IDS.filter((id) => (a[id] ?? 0) > 0).map((id) => `${a[id]} ${RESOURCE_INFO[id].short}`);
  return parts.length === 0 ? 'nič' : parts.join(', ');
}
