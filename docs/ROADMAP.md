# Roadmap – Purgatory & Logistics

Každá fáza = samostatný PR do `main`, po merge sa automaticky nasadí na GitHub Pages.

---

## Fáza 1 – Kickoff: Toolchain & prázdny canvas ✅
**Cieľ:** Repozitár, ktorý sa builduje, typuje a deployuje.

- Vite + TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Phaser 3 inicializovaný s `pixelArt: true` a FIT škálovaním
- `src/core/iso.ts` – world ↔ screen prevod a `isoDepth()`
- `BootScene` vykreslí 10×10 izometrickú mriežku + placeholder postavu s Y-sortom
- GitHub Actions: `npm ci` → typecheck → build → deploy na Pages

**Definition of Done**
- [x] `npm run dev` spustí hru s HMR
- [x] `npm run build` prejde bez chýb typov
- [x] V prehliadači je vidieť izometrická mriežka, žiadne chyby v konzole
- [x] Push do `main` nasadí build na `https://dzizka.github.io/Purgatory-Sons-Underworld-Logistics/`

---

## Fáza 2 – Izometrický svet & pohyb ✅
**Cieľ:** Hráč (stredný manažér) chodí po mape.

- `assets/manifest.ts` + `placeholders.ts` (fallback textúry, ak asset chýba)
- Prvé CC0 assety, zápis do `CREDITS.md` – Isometric Stone Soup (dlaždice, steny), Puny Characters (8-smerový manažér), hudba „Searching“
- `IsoMap` – načítanie mapy (Tiled JSON alebo TS definícia), walkable grid, kolízie
- `IsoSprite` – entita s world pozíciou, automatický depth každý frame
- Pohyb WASD/šípky v izometrických smeroch (8-smerný), normalizácia diagonál
- Kamera sleduje hráča, zoom kolieskom; klik na dlaždicu = highlight (`screenToWorld`)
- Vitest + testy pre `iso.ts` (round-trip prevod, depth poradie)

**Definition of Done**
- [x] Hráč sa pohybuje plynulo, nevojde do stien (šmýka sa popri nich)
- [x] Hráč správne zachádza „za“ a „pred“ objekty (stĺpy, stoly) – Y-sort overený; bloky pred hráčom sa spriehľadnia
- [x] Chýbajúci asset nezhodí hru, zobrazí placeholder
- [x] Unit testy prechádzajú v CI

---

## Fáza 3 – Základňa: Zdroje, budovy & hriešnici ✅
**Cieľ:** Manažérska slučka (IKEA efekt + Zeigarnik).

- `GameState` + `store` (čistý TS), typovaný `EventBus`
- Zdroje: *Duše*, *Formuláre*, *Síra*, *Káva (nekonečne chýbajúca)*
- Budovy: Podateľňa, Kávovar, Kopírka utrpenia, Open-space mučiareň, Školiaca miestnosť – stavba na gride, produkčné cykly, blokovanie pri chýbajúcich vstupoch
- Hriešnici: generátor s traitmi (seedovaný RNG) – napr. *Mikromanažér*, *Odpovedá „reply all“*, *Vegán v pekle*
- Priraďovanie hriešnikov k budovám, tréning (XP → lepší výkon)
- `UIScene` HUD: zdroje, Personálne oddelenie, stavebná lišta, detail budovy (stav, recept, efektivita pracovníkov), hlášky s cynickým flavor textom
- Produkcia beží v `systems/base` nezávisle od aktívnej scény

**Definition of Done**
- [x] Postavím budovu, priradím hriešnika, vidím rast zdrojov v HUD
- [x] Traity merateľne menia produkciu (pokryté unit testami)
- [x] Systémy v `systems/` (aj `core/`, `state/`, `data/`) neimportujú `phaser` (kontrolované testom)

---

## Fáza 4 – Expedícia: ARPG boj
**Cieľ:** Akčná slučka.

- `ExpeditionScene` – generovaná/ručná mapa „Oddelenie reklamácií“
- Zbrane: definície v `data/`, útok na myš (melee oblúk, projektil), cooldowny
- Nepriatelia: jednoduchá AI (idle → chase → attack), HP, knockback, smrť
- Hráčove HP, úhyb (dash s i-frames), game over = „Disciplinárne konanie“
- Kamera shake, hit-stop, damage čísla
- Prechod Základňa ↔ Expedícia; produkcia na základni beží ďalej (Zeigarnik)

**Definition of Done**
- [ ] Viem dokončiť expedíciu (zabiť všetkých / dôjsť k výťahu) a vrátiť sa
- [ ] Boj je čitateľný (feedback na zásah, telegrafované útoky nepriateľov)
- [ ] Stabilných 60 FPS pri 50+ nepriateľoch na desktope

---

## Fáza 5 – Loot & progresia
**Cieľ:** Variable reward schedule.

- Loot tabuľky s váhami a raritami (Bežné / Byrokratické / Legendárne / Prekliate)
- Generované afixy s humorom: *„…zamestnanca mesiaca (posmrtne)“*, *„Prokrastinujúca“* (+50 % dmg, útočí s oneskorením)
- Inventár + vybavenie, porovnanie štatistík
- Expedičné odmeny → suroviny pre základňu (prepojenie slučiek)
- Odomykanie nových budov a typov hriešnikov

**Definition of Done**
- [ ] Každá expedícia dropne náhodný loot, rarita je viditeľná
- [ ] Rozdelenie dropov zodpovedá váham (štatistický unit test na seedovanom RNG)
- [ ] Vybavenie mení štatistiky v boji

---

## Fáza 6 – Ukladanie, offline progres & polish
**Cieľ:** Hra, ku ktorej sa oplatí vrátiť.

- `state/save.ts`: JSON serializácia do `localStorage`, `saveVersion` + migrácie, autosave (interval + pri `visibilitychange`)
- Offline progres: pri načítaní dopočítať produkciu za čas neprítomnosti (s limitom)
- Export/import save ako súbor (záloha)
- Hlavné menu, nastavenia (hlasitosť, zoom), CC0 hudba a SFX
- Onboarding: „Školenie nového zamestnanca“ (tutoriál ako HR prezentácia)

**Definition of Done**
- [ ] Refresh stránky zachová celý progres
- [ ] Poškodený/starý save sa nenačíta s pádom – migrácia alebo bezpečný reset s varovaním
- [ ] Návrat po hodine ukáže „Kým ste boli preč…“ súhrn
- [ ] Všetky assety sú v `CREDITS.md` s CC0/PD licenciou
