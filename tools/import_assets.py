"""
Spracuje surové CC0 balíky z `assets-src/` do herných súborov v `public/assets/`.

Použitie (z koreňa repa, potrebuje Python 3 + Pillow a `unar` na .rar):

    unar -o /tmp/soup "assets-src/stone-soup/SBS - Isometric Stone Soup.rar"
    unzip -o assets-src/puny-characters/puny-charactersorcs_included.zip -d /tmp/puny
    python3 tools/import_assets.py --soup /tmp/soup --puny /tmp/puny

Skript je deterministický – výstup sa dá kedykoľvek pregenerovať.
"""

import argparse
import shutil
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "assets"
MUSIC_SRC = Path(__file__).resolve().parent.parent / "assets-src" / "music"

TILE_W, TILE_H = 64, 32
BLOCK = 64  # bunka bloku v Stone Soup sheetoch (64×64)


def magenta_to_alpha(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            if r > 240 and g < 16 and b > 240:
                px[x, y] = (0, 0, 0, 0)
    return im


def strip(cells: list[Image.Image]) -> Image.Image:
    w, h = cells[0].size
    out = Image.new("RGBA", (w * len(cells), h), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        out.paste(c, (i * w, 0))
    return out


def floor_row(sheet: Path, row: int) -> Image.Image:
    im = magenta_to_alpha(Image.open(sheet))
    cols = im.width // TILE_W
    return strip([im.crop((c * TILE_W, row * TILE_H, (c + 1) * TILE_W, (row + 1) * TILE_H)) for c in range(cols)])


def full_blocks(sheet: Path, row: int) -> Image.Image:
    """Riadok blokov: párne stĺpce sú plné bloky, nepárne polovičné; pod každým riadkom sú horné plochy."""
    im = magenta_to_alpha(Image.open(sheet))
    y = row * 2 * BLOCK
    return strip([im.crop((c * BLOCK, y, (c + 1) * BLOCK, y + BLOCK)) for c in range(0, im.width // BLOCK, 2)])


def half_blocks(sheet: Path, row: int, cols: list[int]) -> Image.Image:
    im = magenta_to_alpha(Image.open(sheet))
    y = row * 2 * BLOCK
    return strip([im.crop((c * BLOCK, y, (c + 1) * BLOCK, y + BLOCK)) for c in cols])


def block_at(sheet: Path, row: int, col: int) -> Image.Image:
    im = magenta_to_alpha(Image.open(sheet))
    y = row * 2 * BLOCK
    return im.crop((col * BLOCK, y, (col + 1) * BLOCK, y + BLOCK))


# budova → (sheet, stĺpec plného bloku v riadku 0)
BUILDING_BLOCKS = {
    "intake": ("Stone_Black_Marked", 0),
    "coffee": ("Brick_Brown", 0),
    "copier": ("Lab_Metal", 4),
    "torture": ("Bars_Red", 0),
    "training": ("Church", 0),
}

# nepriatelia na expedíciách
ENEMY_SHEETS = {"auditor": "Orc-Grunt", "compliance": "Orc-Soldier-Red"}

# vzhľady hriešnikov (index = SinnerState.look)
SINNER_SHEETS = ["Human-Worker-Cyan", "Orc-Peon-Cyan", "Orc-Peon-Red", "Mage-Red"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--soup", type=Path, required=True, help="rozbalený Isometric Stone Soup")
    ap.add_argument("--puny", type=Path, required=True, help="rozbalené Puny Characters (verzia s orkami)")
    args = ap.parse_args()

    soup = next(args.soup.rglob("Tile-Sets"))
    puny = next(args.puny.rglob("Puny-Characters"))
    (OUT / "tiles").mkdir(parents=True, exist_ok=True)
    (OUT / "sprites").mkdir(parents=True, exist_ok=True)
    (OUT / "audio").mkdir(parents=True, exist_ok=True)

    floor_row(soup / "Floors" / "ISS_Floor_Rect_Gray-64x32.png", 0).save(OUT / "tiles" / "floor_office.png")
    full_blocks(soup / "Walls" / "Block" / "ISS_Block_Brick_Dark-64x64.png", 0).save(OUT / "tiles" / "wall_brick_dark.png")
    full_blocks(soup / "Walls" / "Block" / "ISS_Block_Hell-64x64.png", 0).save(OUT / "tiles" / "block_hell.png")
    # polovičné kovové bloky = „kancelárske stoly“ (nepárne stĺpce = polovičné bloky)
    half_blocks(soup / "Walls" / "Block" / "ISS_Block_Lab_Metal-64x64.png", 0, [1, 3]).save(OUT / "tiles" / "desk_metal.png")

    (OUT / "buildings").mkdir(parents=True, exist_ok=True)
    for name, (sheet, col) in BUILDING_BLOCKS.items():
        block_at(soup / "Walls" / "Block" / f"ISS_Block_{sheet}-64x64.png", 0, col).save(OUT / "buildings" / f"{name}.png")

    shutil.copy(puny / "Human-Worker-Red.png", OUT / "sprites" / "manager.png")
    for i, sheet in enumerate(SINNER_SHEETS):
        shutil.copy(puny / f"{sheet}.png", OUT / "sprites" / f"sinner_{i}.png")

    # Oddelenie reklamácií (expedícia)
    floor_row(soup / "Floors" / "ISS_Floor_Rough_Red-64x32.png", 0).save(OUT / "tiles" / "floor_complaints.png")
    full_blocks(soup / "Walls" / "Block" / "ISS_Block_Pebble_Red-64x64.png", 0).save(OUT / "tiles" / "wall_pebble_red.png")
    floor_row(soup / "Floors" / "ISS_Floor_Tutorial_Pad-64x32.png", 0).save(OUT / "tiles" / "elevator.png")
    for name, sheet in ENEMY_SHEETS.items():
        shutil.copy(puny / f"{sheet}.png", OUT / "sprites" / f"enemy_{name}.png")

    shutil.copy(MUSIC_SRC / "Searching.ogg", OUT / "audio" / "music_base.ogg")
    shutil.copy(MUSIC_SRC / "Insistent.ogg", OUT / "audio" / "music_expedition.ogg")

    for f in sorted(OUT.rglob("*.*")):
        print(f.relative_to(OUT), Image.open(f).size if f.suffix == ".png" else f"{f.stat().st_size // 1024} kB")


if __name__ == "__main__":
    main()
