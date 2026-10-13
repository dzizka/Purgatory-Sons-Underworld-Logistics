# Architektúra – Purgatory & Logistics

## 1. Výber frameworku: Phaser 3 vs. PixiJS

| Kritérium | Phaser 3 | PixiJS (v8) |
|---|---|---|
| Typ | Kompletný herný framework | Iba renderer (scene graph + WebGL/WebGPU) |
| Scény, herná slučka, časovače, tweeny | ✅ vstavané | ❌ musíme dopísať |
| Input (klávesnica, myš, gamepad, touch) | ✅ vstavaný | ⚠️ iba pointer eventy |
| Asset loader (sprite sheety, atlasy, audio, JSON) | ✅ `this.load.*` + progress eventy | ⚠️ `Assets`, bez audia |
| Audio | ✅ WebAudio + HTML5 fallback | ❌ treba `@pixi/sound` / Howler |
| Tilemapy (Tiled, izometrické) | ✅ vstavaná podpora iso máp | ❌ externá knižnica |
| Kamera (follow, zoom, shake, bounds) | ✅ | ❌ dopísať |
| Fyzika / kolízie | ✅ Arcade (pre ARPG úplne stačí) | ❌ |
| Depth sorting | ✅ `setDepth()` per objekt | ✅ `zIndex` + `sortableChildren` |
| Výkon pri tisícoch spritov | dobrý | o niečo lepší |
| Veľkosť bundlu | ~1.2 MB (≈320 kB gzip) | ~450 kB |
| TypeScript typy | oficiálne, kompletné | oficiálne, výborné |

**Odporúčanie: Phaser 3 (3.90).**
Hra je hybrid ARPG + manažér – potrebujeme scény (Základňa / Expedícia / UI overlay), input, audio, kameru, tweeny, kolízie a loader. V PixiJS by sme to všetko písali sami a tým by sme zjedli prvé 2–3 míľniky. Výkonnostný rozdiel je pre stovky entít irelevantný. Y-sorting a izometrickú matematiku máme aj tak vlastnú (`src/core/iso.ts`), takže nie sme zviazaní s Phaser tilemap implementáciou.

> Poznámka: Phaser 4 je už vydaný, ale ekosystém tutoriálov, pluginov a príkladov je stále primárne na v3. Migrácia je neskôr možná, pretože herná logika (ECS-lite systémy, stav, save) bude od Phaseru oddelená.

## 2. Kľúčové princípy

1. **Logika ≠ renderovanie.** `src/systems/*` a `src/state/*` neimportujú Phaser. Sú to čisté TS funkcie/triedy → testovateľné vo Vitest bez canvasu.
2. **Jeden zdroj pravdy:** `GameState` (in-memory), serializovateľný do JSON. Scény ho iba čítajú a posielajú príkazy.
3. **Izometria je vlastná:** world súradnice (x, y, z) v dlaždiciach; prevod `worldToScreen` / `screenToWorld`; hĺbka `isoDepth()` = Y-sort.
4. **Assety cez manifest:** `src/assets/manifest.ts` mapuje kľúč → súbor. Ak súbor chýba, loader vygeneruje placeholder textúru (farebný kosoštvorec/kapsula), takže hra beží vždy.
5. **Event bus:** typované eventy (`EventMap`) medzi systémami a UI – žiadne priame volania naprieč vrstvami.

## 3. Izometrická matematika

```
ScreenX = (WorldX - WorldY) * (TileWidth  / 2)
ScreenY = (WorldX + WorldY) * (TileHeight / 2) - WorldZ
Depth   = (WorldX + WorldY) * 100 + WorldZ * 0.01
```

Dlaždica 64×32 px (2:1). Inverzia (myš → dlaždica) na rovine z = 0:

```
WorldX = (ScreenX / (TW/2) + ScreenY / (TH/2)) / 2
WorldY = (ScreenY / (TH/2) - ScreenX / (TW/2)) / 2
```

## 4. Cieľová štruktúra repozitára

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI: typecheck + build + deploy na GitHub Pages
├── docs/
│   ├── ARCHITECTURE.md           # tento dokument
│   └── ROADMAP.md                # míľniky + Definition of Done
├── assets-src/                   # surové CC0 balíky (nenasadzujú sa)
├── tools/
│   └── import_assets.py          # assets-src → public/assets (výrez, priehľadnosť)
├── public/
│   └── assets/                   # spracované CC0 assety (kopírujú sa 1:1 do dist)
│       ├── sprites/              #   postavy, nepriatelia, NPC (sprite sheety / atlasy)
│       ├── tiles/                #   izometrické dlaždice, budovy
│       ├── ui/                   #   panely, ikony, fonty (bitmap)
│       ├── audio/
│       │   ├── music/            #   FreePD / CC0 hudba
│       │   └── sfx/
│       └── data/                 #   Tiled mapy (.json)
├── src/
│   ├── main.ts                   # bootstrap Phaser.Game
│   ├── config/
│   │   ├── constants.ts          # rozmery dlaždíc, farby, rozlíšenie
│   │   └── balance.ts            # herné čísla (HP, ceny, časy produkcie)
│   ├── core/                     # engine-agnostické jadro
│   │   ├── iso.ts                # izometrická matematika + depth
│   │   ├── EventBus.ts           # typovaný pub/sub
│   │   ├── rng.ts                # seedovateľný RNG (mulberry32) pre loot a generovanie
│   │   └── time.ts               # herný čas, tick scheduler (offline progres)
│   ├── assets/
│   │   ├── manifest.ts           # kľúč → cesta, typ, frame rozmery
│   │   └── placeholders.ts       # generovanie fallback textúr
│   ├── scenes/
│   │   ├── BootScene.ts          # preload + placeholdery
│   │   ├── BaseScene.ts          # základňa (manažment)
│   │   ├── ExpeditionScene.ts    # ARPG expedícia
│   │   └── UIScene.ts            # HUD overlay (beží paralelne)
│   ├── world/                    # renderovacia vrstva sveta (Phaser)
│   │   ├── IsoMap.ts             # dlaždicová mapa, pathfinding grid
│   │   ├── IsoSprite.ts          # GameObject s world pozíciou + auto-depth
│   │   └── Camera.ts
│   ├── entities/
│   │   ├── Player.ts
│   │   ├── Sinner.ts             # hriešnik/zamestnanec (vizuál + väzba na dáta)
│   │   └── Enemy.ts
│   ├── systems/                  # čistá logika (bez Phaseru)
│   │   ├── movement/             #   input → velocity, kolízie s gridom
│   │   ├── combat/               #   zbrane, damage, hitboxy, AI nepriateľov
│   │   ├── loot/                 #   tabuľky lootu, afixy („Prokrastinujúci“, „S výpoveďou“)
│   │   ├── base/                 #   budovy, produkčné reťazce, zdroje
│   │   └── staff/                #   generovanie hriešnikov, traity, tréning, priradenie
│   ├── state/
│   │   ├── GameState.ts          # typy celého stavu
│   │   ├── store.ts              # in-memory store + príkazy
│   │   ├── session.ts            # aktívna relácia: store + zdieľaný stav UI (režim, výber)
│   │   └── save.ts               # localStorage, verzie, migrácie (Fáza 6)
│   ├── ui/                       # HUD komponenty, okná, tooltipy
│   ├── data/                     # statické definície (JSON/TS): budovy, zbrane, traity, texty
│   └── types/                    # zdieľané typy
├── tests/                        # Vitest unit testy pre core/ a systems/
├── index.html
├── package.json
├── tsconfig.json                 # browser kód (strict)
├── tsconfig.node.json            # vite.config.ts
├── vite.config.ts
├── CREDITS.md                    # evidencia licencií assetov
└── README.md
```

Priečinky sa pridávajú až vo fáze, ktorá ich potrebuje – nevytvárame prázdne kostry dopredu.
