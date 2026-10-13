# Credits & licencie assetov

Projekt používa **výhradne CC0 / Public Domain** assety. Každý pridaný asset musí mať záznam tu.
Surové balíky sú v `assets-src/` (nenasadzujú sa), herné súbory v `public/assets/` generuje `tools/import_assets.py`.

| Asset v hre | Zdroj | Autor | Licencia |
|---|---|---|---|
| `tiles/*.png`, `buildings/*.png` | [Isometric Stone Soup](https://opengameart.org/content/isometric-stone-soup) (konverzia [Dungeon Crawl Stone Soup](https://opengameart.org/content/dungeon-crawl-32x32-tiles-supplemental) tilesetu) | Screaming Brain Studios | CC0 1.0 (`License.txt` v balíku) |
| `sprites/manager.png` (Human-Worker-Red), `sprites/sinner_0–3.png` (Human-Worker-Cyan, Orc-Peon-Cyan, Orc-Peon-Red, Mage-Red), `sprites/enemy_*.png` (Orc-Grunt, Orc-Soldier-Red) | [Puny Characters](https://opengameart.org/content/puny-characters) | Shade | CC0 1.0 |
| `audio/music_base.ogg` („Searching“) | [OpenGameArt – Searching](https://opengameart.org/content/searching) | yd | CC0 1.0 |
| `audio/music_expedition.ogg` („Insistent“) | [OpenGameArt – Insistent](https://opengameart.org/content/insistent-background-loop) | yd | CC0 1.0 |

Zvukové efekty (švih, zásah, korisť, stavba…) sú syntetizované priamo v kóde (`src/audio/sfx.ts`, Web Audio) – nie sú to súbory a nevzťahuje sa na ne licencia tretích strán.

Uložené v `assets-src/`, zatiaľ nepoužité:

| Balík | Zdroj | Autor | Licencia |
|---|---|---|---|
| `businessman/*.zip` (iný štýl – možno boss „CEO“) | [8 Directional 2D Businessman Character](https://hormelz.itch.io/8-directional-2d-businessman-character) | Hormelz | CC0 1.0 |
| `puny-characters/` – ďalšie postavy (plán: nové typy nepriateľov) | [Puny Characters](https://opengameart.org/content/puny-characters) | Shade | CC0 1.0 |

Ďalšie overené CC0 zdroje: [Kenney.nl](https://kenney.nl/assets) (napr. Interface Sounds, Impact Sounds).
Pozor: Incompetech (Kevin MacLeod) je prevažne **CC-BY**, nie CC0 – uprednostni FreePD / OpenGameArt s filtrom CC0.
