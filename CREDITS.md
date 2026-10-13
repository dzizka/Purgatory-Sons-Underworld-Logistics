# Credits & licencie assetov

Projekt používa **výhradne CC0 / Public Domain** assety. Každý pridaný asset musí mať záznam tu.
Surové balíky sú v `assets-src/` (nenasadzujú sa), herné súbory v `public/assets/` generuje `tools/import_assets.py`.

| Asset v hre | Zdroj | Autor | Licencia |
|---|---|---|---|
| `tiles/*.png` (okrem kancelárie) | [Isometric Stone Soup](https://opengameart.org/content/isometric-stone-soup) (konverzia [Dungeon Crawl Stone Soup](https://opengameart.org/content/dungeon-crawl-32x32-tiles-supplemental) tilesetu) | Screaming Brain Studios | CC0 1.0 (`License.txt` v balíku) |
| `sprites/manager.png` (Human-Worker-Red), `sprites/sinner_0–7.png` (Human-Worker-Cyan, Orc-Peon-Cyan, Orc-Peon-Red, Mage-Red, Character-Base, Mage-Cyan, Archer-Purple, Archer-Green), `sprites/enemy_*.png` (Orc-Grunt, Orc-Soldier-Red, Soldier-Yellow, Slime) | [Puny Characters](https://opengameart.org/content/puny-characters) | Shade | CC0 1.0 |
| `sprites/boss_ceo.png` (boss „CEO“, výrez a poskladanie animácií Idle, Walk, Combo, Damaged, Die) | [8 Directional 2D Businessman Character](https://hormelz.itch.io/8-directional-2d-businessman-character) | Hormelz | CC0 1.0 |
| `buildings/*.png`, `tiles/desk_office.png` (stoly, monitory, regály, kartotéky, krabice, kávovar, „kopírka“, „centrifúga“, televízor – poskladané a zmenšené) | [Furniture Kit](https://kenney.nl/assets/furniture-kit) | Kenney | CC0 1.0 (`License.txt` v balíku) |
| `tiles/floor_office.png` (drevené parkety) | [Isometric Floor Tiles – Small](https://opengameart.org/content/1000-isometric-floor-tiles) | Screaming Brain Studios | CC0 1.0 |
| `audio/music_base.ogg` („Searching“) | [OpenGameArt – Searching](https://opengameart.org/content/searching) | yd | CC0 1.0 |
| `audio/music_expedition.ogg` („Insistent“) | [OpenGameArt – Insistent](https://opengameart.org/content/insistent-background-loop) | yd | CC0 1.0 |

Zvukové efekty (švih, zásah, korisť, stavba…) sú syntetizované priamo v kóde (`src/audio/sfx.ts`, Web Audio) – nie sú to súbory a nevzťahuje sa na ne licencia tretích strán.

Uložené v `assets-src/`, zatiaľ nepoužité (z `businessman/` sa používa iba 5 animácií):

| Balík | Zdroj | Autor | Licencia |
|---|---|---|---|
| `sbs_-_isometric_wall_pack_-_small.zip`, `sbs_-_floor_tile_update_*` (steny, autotiles, voda) | [Screaming Brain Studios](https://screamingbrainstudios.itch.io) | Screaming Brain Studios | CC0 1.0 |
| `puny-characters/` – ďalšie postavy (napr. nové typy nepriateľov) | [Puny Characters](https://opengameart.org/content/puny-characters) | Shade | CC0 1.0 |

Ďalšie overené CC0 zdroje: [Kenney.nl](https://kenney.nl/assets) (napr. Interface Sounds, Impact Sounds).
Pozor: Incompetech (Kevin MacLeod) je prevažne **CC-BY**, nie CC0 – uprednostni FreePD / OpenGameArt s filtrom CC0.
