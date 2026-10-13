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
- Texty v hre po slovensky, cynický korporátny humor.
