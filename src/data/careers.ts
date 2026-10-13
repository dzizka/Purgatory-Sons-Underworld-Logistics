/** Kariéra hriešnika: strop úrovne, vedúci, dôchodok a vyhorenie. */

export const SINNER_ROLES = ['worker', 'lead'] as const;
export type SinnerRole = (typeof SINNER_ROLES)[number];

/** Najvyššia úroveň. Vyššie už sa dá iba povýšiť – alebo odísť. */
export const MAX_LEVEL = 10;

/** Vedúci sám nepracuje, ale budova s ním ide o toľko rýchlejšie. Viac vedúcich v jednej budove sa nesčíta. */
export const LEAD_BONUS = 1.25;

/** Každý dôchodca v dôchodkovom fonde zrýchli celú výrobu o 5 %, najviac 10 dôchodcov. */
export const PENSION_BONUS = 0.05;
export const PENSION_MAX = 10;

/** Za koľko práce bez prestávky je únava 100 %. */
export const FATIGUE_MS = 90_000;
/** Od tejto únavy si pracovník dá kávu (ak nejaká je) a začne odznova. */
export const COFFEE_BREAK_AT = 0.6;
/** Za koľko sa v čakárni zotaví zo 100 % únavy na nulu. */
export const RECOVER_MS = 30_000;
/** Výkon pri úplnom vyhorení. */
export const BURNOUT_MIN_MULT = 0.5;
