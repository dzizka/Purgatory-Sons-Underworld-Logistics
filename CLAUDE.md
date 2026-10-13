# Pokyny pre Claude

## Workflow
- Každá fáza z `docs/ROADMAP.md` = samostatný PR do `main`.
- **Keď je CI na PR zelené (a nie sú otvorené review komentáre), PR rovno mergni** (squash) – netreba čakať na vlastníka repa.
- Pred pushom spusti `npm test` a `npm run build` (obsahuje typecheck).
- Po dokončení fázy aktualizuj checkboxy v `docs/ROADMAP.md`.

## Konvencie
- TypeScript strict, žiadne `any`. Importy cez alias `@/` (= `src/`).
- `src/core/` a `src/systems/` **nesmú importovať Phaser** (stráži `tests/architecture.test.ts`).
- World súradnice sú v dlaždiciach; obrazovkovú pozíciu a hĺbku počíta `IsoSprite` – nenastavuj ich ručne.
- Assety len cez `src/assets/manifest.ts`; každý nový CC0 asset zapíš do `CREDITS.md`.
- Surové balíky patria do `assets-src/`, do `public/assets/` iba spracované súbory, ktoré hra reálne používa (všetko v `public/` sa nasadzuje). Spracovanie: `tools/import_assets.py`.
- Zmena tvaru `GameState` = zvýšiť `SAVE_VERSION` v `src/state/save.ts`, pridať migráciu do `MIGRATIONS` a test v `tests/save.test.ts` – hráčom sa nesmú rozbiť savy.
- Texty v hre po slovensky, cynický korporátny humor.
