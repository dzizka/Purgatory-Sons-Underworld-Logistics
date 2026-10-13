# Purgatory & Logistics *(pracovný názov)*

Izometrické 2D ARPG × manažment očistca. Si stredný manažér v Pekle: spravuješ hriešnikov, plníš kvóty a medzi poradami chodíš na expedície do Oddelenia reklamácií.

**Stack:** TypeScript (strict) · Phaser 3 · Vite · GitHub Pages

## Spustenie

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit testy (Vitest)
npm run build      # typecheck + produkčný build do dist/
npm run preview    # lokálny náhľad produkčného buildu
```

## Ovládanie

WASD / šípky – pohyb · koliesko myši – zoom · klik – inšpekcia dlaždice · M – hudba on/off

S `?debug` v URL je inštancia hry dostupná v konzole ako `window.__game`.

## Deploy

Každý push do `main` spustí `.github/workflows/deploy.yml` a nasadí hru na GitHub Pages.
Jednorazovo treba v repozitári nastaviť **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Dokumentácia

- [Architektúra a výber frameworku](docs/ARCHITECTURE.md)
- [Roadmap a Definition of Done](docs/ROADMAP.md)
- [Credits a licencie assetov](CREDITS.md)
