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

## Fáza 4 – Expedícia: ARPG boj ✅
**Cieľ:** Akčná slučka.

- `ExpeditionScene` – generovaná/ručná mapa „Oddelenie reklamácií“
- Zbrane: definície v `data/`, útok na myš (melee oblúk, projektil), cooldowny
- Nepriatelia: jednoduchá AI (idle → chase → attack), HP, knockback, smrť
- Hráčove HP, úhyb (dash s i-frames), game over = „Disciplinárne konanie“
- Kamera shake, hit-stop, damage čísla
- Prechod Základňa ↔ Expedícia; produkcia na základni beží ďalej (Zeigarnik)

**Definition of Done**
- [x] Viem dokončiť expedíciu (zabiť všetkých / dôjsť k výťahu) a vrátiť sa
- [x] Boj je čitateľný (feedback na zásah, telegrafované útoky nepriateľov)
- [x] Stabilných 60 FPS pri 50+ nepriateľoch na desktope *(simulácia 60 nepriateľov < 4 ms/krok – test v CI; vykresľovanie overiť na reálnom HW)*

---

## Fáza 5 – Loot & progresia ✅
**Cieľ:** Variable reward schedule.

- Loot tabuľky s váhami a raritami (Bežné / Byrokratické / Legendárne / Prekliate)
- Generované afixy s humorom: *„…zamestnanca mesiaca (posmrtne)“*, *„Prokrastinujúca“* (+50 % dmg, útočí s oneskorením)
- Inventár (16 miest) + vybavenie (úder, strela, talizman), porovnanie štatistík, skartovanie na formuláre
- Expedičné odmeny → suroviny pre základňu (prepojenie slučiek); korisť na zemi treba zdvihnúť, pri smrti prepadá
- Odomykanie budov (Mučiareň po 1. úspešnej expedícii, Školiaca miestnosť po 10 vybavených reklamáciách); nové typy hriešnikov presunuté do backlogu

**Definition of Done**
- [x] Každá expedícia dropne náhodný loot (vybavenie mapy = garantovaný predmet so šťastím), rarita je viditeľná farbou
- [x] Rozdelenie dropov zodpovedá váham (štatistický unit test na seedovanom RNG)
- [x] Vybavenie mení štatistiky v boji

---

## Fáza 6 – Ukladanie, offline progres & polish ✅
**Cieľ:** Hra, ku ktorej sa oplatí vrátiť.

- `state/save.ts`: JSON serializácia do `localStorage`, `saveVersion` + migrácie, autosave (interval + pri `visibilitychange`)
- Offline progres: pri načítaní dopočítať produkciu za čas neprítomnosti (s limitom)
- Export/import save ako súbor (záloha)
- Hlavné menu (pokračovať, nová smena s potvrdením, export/import, hlasitosť hudby a efektov, zvuk on/off), Esc = menu
- CC0 hudba; zvukové efekty syntetizované vo Web Audio (bez súborov, bez licencií)
- Dopočítanie výroby aj po návrate do skrytej karty prehliadača
- Onboarding: „Školenie nového zamestnanca“ (tutoriál ako HR prezentácia)

**Definition of Done**
- [x] Refresh stránky zachová celý progres
- [x] Poškodený/starý save sa nenačíta s pádom – migrácia alebo bezpečný reset s varovaním (poškodený save sa odloží do zálohy)
- [x] Návrat po hodine ukáže „Kým ste boli preč…“ súhrn
- [x] Všetky assety sú v `CREDITS.md` s CC0/PD licenciou

---

## Fáza 7 – Procedurálne Oddelenie reklamácií ✅
**Cieľ:** znovuhrateľné expedície s rizikom a odmenou.

- Generátor poschodí (`systems/dungeon/generate.ts`): miestnosti + chodby (minimálna kostra + slučky), typy miestností (štart, východ, archív s pultmi, zasadačka so stĺpmi a stolom, sklad s korisťou), výstup v ASCII formáte pre `parseMap`
- Hĺbka: viac a silnejších nepriateľov, viac compliance officerov, vyššie odmeny a šťastie pri drope; každé poschodie má vlastný názov a tému dlaždíc
- Schodisko dole sa otvorí po vybavení poschodia; korisť, suroviny a zdravie sa nesú ďalej, smrť = všetko prepadá; výťah domov na každom poschodí
- Seed poschodia viditeľný v HUD, rekord najhlbšieho poschodia v save (verzia 2 s migráciou)
- Výťah na základni presunutý k zadnej stene + pravidlo „výťah/schodisko nesmie byť za stenou“ pre všetky mapy

**Definition of Done**
- [x] Každé poschodie je iné, ale pre rovnaký seed rovnaké
- [x] Všetko priechodné je dosiahnuteľné, výťah a schodisko sú vždy viditeľné (test na 600 vygenerovaných poschodiach)
- [x] Hlbšie poschodia sú merateľne ťažšie a štedrejšie (testy)
- [x] Zostup prenesie korisť a zdravie; návrat domov pripíše všetko, smrť všetko vezme

## Fáza 8 – Kariéra hriešnikov & vyváženie ✅
**Cieľ:** hriešnik na maxime nie je slepá ulička, ale rozhodnutie.

- Strop úrovne 10 (XP sa ďalej nezbierajú); na strope hláška a v Personálnom voľba: **[P] povýšiť na vedúceho** (nepracuje, nezaberá miesto, budova +25 %, najviac jeden na budovu), **[R] dôchodok** (odíde, dôchodkový fond = celá výroba +5 % za dôchodcu, najviac +50 %), alebo nechať pracovať
- Vyhorenie: pracovníci sa unavujú, nad 60 % si sami vezmú kávu zo skladu; bez kávy výkon klesá až na polovicu, v čakárni sa zotavia
- Offline progres počíta aj únavu a kávu; strop úrovne obmedzuje nekonečný rast z offline
- Save verzia 3 s migráciou (rola, únava, dôchodkový fond; staré XP sa orežú na strop)

**Definition of Done**
- [x] Úroveň nikdy neprekročí 10, ani po 8 h offline (test)
- [x] Vedúci a dôchodok merateľne zrýchlia výrobu (testy)
- [x] Bez kávy reťazec ide zhruba na polovicu (test)
- [x] Staré savy sa zmigrujú bez straty (test v2 → v3)

## Fáza 9 – Boss „CEO“ ✅
**Cieľ:** hĺbka má míľniky – každé 5. poschodie končí súbojom s vedením.

- Na každom 5. poschodí sedí **CEO** v najvzdialenejšej kancelárii (pri schodisku), bežných nepriateľov je tam o 40 % menej
- Mechaniky: dlhý telegrafovaný úder s komboanimáciou, **porada** (každých 9 s privolá 2 audítorov, najviac 4 naraz), pod 50 % zdravia **rozzúrenie** (rýchlejší, kratší nápriah)
- Privolaní audítori nenesú korisť (CEO sa nedá „farmiť“); CEO dá veľkú odmenu a predmet s vyšším šťastím
- Veľký pruh zdravia v HUD, úvodný banner poschodia, vlastné zvuky (zvonček na poradu, rozzúrenie, fanfára)
- Sprite z balíka 8 Directional 2D Businessman (CC0) – 8 smerov, 5 animácií, generuje `tools/import_assets.py`

**Definition of Done**
- [x] CEO je na poschodiach 5, 10, 15… práve raz a nikde inde (test na generátore)
- [x] Porada rešpektuje strop posíl, rozzúrenie nastane raz, porážka sa započíta aj po zostupe (testy)
- [x] Sprite sedí na mriežku manifestu (test assetov)

## Fáza 10 – Typy hriešnikov ✅
**Cieľ:** nábor je rozhodnutie, nie len tlačidlo.

- Päť typov: **Úradník** (základ), **Stážista** (1 D, 70 % výkon, 2× XP), **Barista** (kávovar +80 %, polovičná únava), **Účtovník** (podateľňa a kopírka +50 %, inde −10 %), **Firemný právnik** (mučiareň +60 %, kolegovia v budove +10 %)
- Odomykanie postupom: zabitia, výpravy, najhlbšie poschodie, porazení CEO (hláška pri odomknutí); vlastnosti (traity) sa pridávajú náhodne ku každému typu
- HR panel: [T] prepína typ náboru, cena a popis typu pri tlačidle; typ v riadku hriešnika a v detaile
- Vlastný vzhľad pre každý nový typ (Puny Characters, CC0)
- Save verzia 4 s migráciou (doterajší hriešnici = úradníci, počítadlo porazených CEO)

**Definition of Done**
- [x] Každý typ merateľne mení výkon tam, kde má (testy)
- [x] Zamknutý typ sa nedá nabrať, odomknutie sa ohlási (testy)
- [x] Staré savy sa zmigrujú (test v3 → v4)

## Fáza 11 – Nové typy nepriateľov + vývojárske nástroje ✅
**Cieľ:** hlbšie poschodia vyžadujú inú taktiku, nie len viac HP.

- **Byrokratický sliz** (od 2. poschodia): pomalý, po smrti sa rozdelí na 2 rýchle **kópie** (bez koristi)
- **Právnik protistrany** (od 3. poschodia): drží si odstup 3–5,5 dlaždice, telegrafuje čiarou a hádže **predvolania** – projektily, ktoré úskok prejde a stena zastaví
- Podiel nových typov rastie s hĺbkou (`depthScaling`), v generátore znaky `s` a `r`
- Sprity Puny Characters (Slime – vlastné animácie bez smerov, Soldier-Yellow)
- **Cheat menu** (F9, iba dev / `?debug`): suroviny, odomknutie, úroveň 10, únava, predmety, offline, nesmrteľnosť, skok na poschodie, zabiť všetkých

**Definition of Done**
- [x] Sliz sa delí práve raz, poschodie sa vybaví až po kópiách (test)
- [x] Právnik ustupuje, strieľa na dostrel; úskok aj stena projektil neprepustia k zraneniu (testy)
- [x] Nové typy sa objavujú až od svojho poschodia (test generátora)

---

## Backlog (po MVP)
- Kancelársky nábytok v pixel arte (dnes polovičné kovové bloky)
