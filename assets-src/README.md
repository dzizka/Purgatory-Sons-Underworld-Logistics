# assets-src – surové balíky

Originálne stiahnuté archívy. **Nenasadzujú sa** (Vite kopíruje iba `public/`).
Herné súbory v `public/assets/` sa z nich generujú skriptom:

```bash
unar -o /tmp/soup "assets-src/stone-soup/SBS - Isometric Stone Soup.rar"
unzip -o assets-src/puny-characters/puny-charactersorcs_included.zip -d /tmp/puny
unzip -o assets-src/kenney_furniturePack.zip -d /tmp/kenney
unzip -o "assets-src/sbs_-_isometric_floor_tiles_-_small_128x64.zip" -d /tmp/sbsfloor
python3 tools/import_assets.py --soup /tmp/soup --puny /tmp/puny --kenney /tmp/kenney --sbs-floors /tmp/sbsfloor
```

Potrebuje Python 3 + Pillow (`pip install pillow`) a `unar` (alebo iný rozbaľovač .rar).
Licencie a autori: [`CREDITS.md`](../CREDITS.md).

## Formáty
- **Stone Soup bloky** (`Walls/Block/*-64x64.png`): bunky 64×64, 8 stĺpcov. Párne stĺpce = plný blok, nepárne = polovičný. Každý riadok blokov má pod sebou riadok samotných horných plôch. Pozadie je purpurové (#FF00FF) → skript ho mení na priehľadné.
- **Stone Soup podlahy** (`Floors/*-64x32.png`): dlaždice 64×32.
- **Kenney Furniture Kit** (`Isometric/<predmet>_<SE|SW|NE|NW>.png`): vyhladené rendery, podlaha ≈ 151 px. Skript ich zmenší na 50 %, stvrdí okraje, stmaví a poskladá na plátno 64×96 (stred podstavy na y = 80).
- **SBS Floor Tiles – Small** (`Interior/*.png`): mriežka 3×3 dlaždíc 128×64, RGB s čiernym pozadím → zmenšenie na 64×32 a orezanie na kosoštvorec.
- **Puny Characters**: 768×256, snímky 32×32. Riadky = 8 smerov v smere hodín od „dole“ (S, SE, E, NE, N, NW, W, SW). Stĺpce: 0 státie, 1–4 chôdza, 5–7 meč, 8–12 luk, 13–14 palica, 15–17 hod, 18–20 zásah, 21–23 smrť.
