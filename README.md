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

| Vstup | Akcia |
|---|---|
| WASD / šípky | pohyb manažéra |
| koliesko myši | zoom |
| 1 – 5 | stavebný režim (Podateľňa, Kávovar, Kopírka, Mučiareň, Školiaca miestnosť), Shift + klik = stavať viackrát |
| klik na hriešnika (vo svete alebo v Personálnom) → klik na budovu | pridelenie do práce |
| U | poslať vybraného hriešnika do čakárne |
| H | nábor nového hriešnika (3 duše) |
| klik na budovu | detail: stav, recept, efektivita pracovníkov |
| Esc / pravé tlačidlo | zrušiť režim |
| M | hudba on/off |

**Ekonomika:** Podateľňa → Duše · Kávovar → Káva · Kopírka: Duša → 3 Formuláre · Mučiareň: Duša + 2 Formuláre + Káva → 6 Síry · Školiaca miestnosť: Káva → XP.
Vlastnosti hriešnikov (Workoholik, Prokrastinátor, Mikromanažér, Introvert…) menia výkon; skúsenosti zvyšujú úroveň (+10 % / level).

S `?debug` v URL je inštancia hry dostupná v konzole ako `window.__game`.

## Deploy

Každý push do `main` spustí `.github/workflows/deploy.yml` a nasadí hru na GitHub Pages.
Jednorazovo treba v repozitári nastaviť **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Dokumentácia

- [Architektúra a výber frameworku](docs/ARCHITECTURE.md)
- [Roadmap a Definition of Done](docs/ROADMAP.md)
- [Credits a licencie assetov](CREDITS.md)
