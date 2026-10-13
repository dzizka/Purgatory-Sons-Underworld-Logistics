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
| P / R | hriešnik na úrovni 10: povýšiť na vedúceho / poslať do dôchodku |
| H | nábor nového hriešnika (3 duše) |
| klik na budovu | detail: stav, recept, efektivita pracovníkov |
| Esc / pravé tlačidlo | zrušiť režim |
| M | zvuk on/off |
| Esc | zrušiť režim → menu (uloží hru) |
| E na modrej platforme | služobný výťah na expedíciu / späť |
| I | sklad a výbava (klik = nasadiť, pravé tlačidlo = skartovať) |

**Expedícia (Oddelenie reklamácií):** každá výprava je **procedurálne generovaná** – miestnosti, chodby, archívy, zasadačky a sklady s korisťou. Po vybavení poschodia sa otvorí **schodisko** (oranžové) o poschodie nižšie: ťažšie, ale štedrejšie. Výťah (modrý) vás kedykoľvek vráti domov s korisťou – smrť znamená, že prepadne všetko z celej výpravy.

**Ovládanie expedície:** WASD pohyb · ľavé tlačidlo Dierovačka (úder na blízko) · pravé tlačidlo Sponkovačka (strela) · Medzera úskok (krátka nezraniteľnosť) · E na výťahu = návrat s korisťou.
Z nepriateľov padá **korisť** (farebný drahokam = rarita: bežné, byrokratické, legendárne, prekliate) s afixmi ako *„Prokrastinujúca dierovačka z porady, ktorá mohla byť e-mail“*. Vybavenie celej mapy dá garantovaný predmet.
Nepriatelia pred úderom zastanú a pod nimi sa rozsvieti červený výsek – vtedy uskočte. Smrť = disciplinárne konanie a korisť prepadá. Základňa medzitým vyrába ďalej.

**Ekonomika:** Podateľňa → Duše · Kávovar → Káva · Kopírka: Duša → 3 Formuláre · Mučiareň: Duša + 2 Formuláre + Káva → 6 Síry · Školiaca miestnosť: Káva → XP.
Vlastnosti hriešnikov (Workoholik, Prokrastinátor, Mikromanažér, Introvert…) menia výkon; skúsenosti zvyšujú úroveň (+10 % / level, najviac úroveň 10).

**Kariéra:** na úrovni 10 sa dá hriešnik **povýšiť na vedúceho** (sám nepracuje, budova +25 %) alebo poslať do **dôchodku** (zmizne, celá výroba trvalo +5 %, najviac +50 %) – alebo nech robí ďalej. Pracovníci sa unavujú a sami si berú kávu zo skladu; bez kávy **vyhoria** a robia na polovicu.

S `?debug` v URL je inštancia hry dostupná v konzole ako `window.__game`.

## Ukladanie

Hra sa ukladá automaticky do `localStorage` (každých 15 s, pri skrytí karty a pri zatvorení). Pri ďalšom spustení sa dopočíta výroba za čas neprítomnosti (najviac 8 h).
V menu sa dá uložená hra **exportovať** do súboru a **importovať** späť (záloha, prenos medzi počítačmi). Poškodený save hru nezhodí – odloží sa do zálohy (`purgatory-logistics.save.corrupt`) a začne sa nová smena.

## Deploy

Každý push do `main` spustí `.github/workflows/deploy.yml` a nasadí hru na GitHub Pages.
Jednorazovo treba v repozitári nastaviť **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Dokumentácia

- [Architektúra a výber frameworku](docs/ARCHITECTURE.md)
- [Roadmap a Definition of Done](docs/ROADMAP.md)
- [Credits a licencie assetov](CREDITS.md)
