"""
Spracuje surové CC0 balíky z `assets-src/` do herných súborov v `public/assets/`.

Použitie (z koreňa repa, potrebuje Python 3 + Pillow a `unar` na .rar):

    unar -o /tmp/soup "assets-src/stone-soup/SBS - Isometric Stone Soup.rar"
    unzip -o assets-src/puny-characters/puny-charactersorcs_included.zip -d /tmp/puny
    unzip -o assets-src/kenney_furniturePack.zip -d /tmp/kenney
    unzip -o "assets-src/sbs_-_isometric_floor_tiles_-_small_128x64.zip" -d /tmp/sbsfloor
    python3 tools/import_assets.py --soup /tmp/soup --puny /tmp/puny --kenney /tmp/kenney --sbs-floors /tmp/sbsfloor

Skript je deterministický – výstup sa dá kedykoľvek pregenerovať.
"""

import argparse
import io
import json
import shutil
import zipfile
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "assets"
MUSIC_SRC = Path(__file__).resolve().parent.parent / "assets-src" / "music"
BUSINESSMAN_SRC = Path(__file__).resolve().parent.parent / "assets-src" / "businessman"
ASSETS_SRC = Path(__file__).resolve().parent.parent / "assets-src"

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


def floor_tile(sheet: Path, row: int, col: int) -> Image.Image:
    im = magenta_to_alpha(Image.open(sheet))
    return im.crop((col * TILE_W, row * TILE_H, (col + 1) * TILE_W, (row + 1) * TILE_H))


# hlbšie poschodia procedurálneho dungeonu: (názov, podlaha, stena)
DEPTH_THEMES = [
    ("archive", "Tomb", "Undead"),
    ("it", "Black_Cobalt", "Cobalt_Stone"),
    ("board", "Demonic_Red", "Volcanic_Wall"),
]


# budova → (sheet, stĺpec plného bloku v riadku 0)

# nepriatelia na expedíciách
# slime: jeden riadok 15 snímok bez smerov (pozri src/entities/slimeAnims.ts)
ENEMY_SHEETS = {"auditor": "Orc-Grunt", "compliance": "Orc-Soldier-Red", "counsel": "Soldier-Yellow", "slime": "Slime"}

# vzhľady hriešnikov (index = SinnerState.look)
# 0–3 úradníci, 4 stážista, 5 účtovník, 6 právnik, 7 barista (pozri src/data/sinnerKinds.ts)
SINNER_SHEETS = [
    "Human-Worker-Cyan",
    "Orc-Peon-Cyan",
    "Orc-Peon-Red",
    "Mage-Red",
    "Character-Base",
    "Mage-Cyan",
    "Archer-Purple",
    "Archer-Green",
]


# Boss „CEO“ z 8 Directional 2D Businessman (snímky 256×256, postava ~50×65 px pri spodku stredu).
# Výrez spoločný pre všetky animácie (aj ležiacu smrť), päty na y = 135.
CEO_CROP = (56, 70, 200, 166)  # 144×96
CEO_COLUMNS = 16
# smer dirN zo zdroja v poradí FACING hry (S, SE, E, NE, N, NW, W, SW)
CEO_DIRS = [8, 7, 6, 5, 4, 3, 2, 1]
# (animácia, krok podvzorkovania) – poradie a počty musia sedieť s `CEO_CLIPS` v src/entities/ceoAnims.ts
CEO_ANIMS = [("Idle", 2), ("Walk", 1), ("Combo", 2), ("Damaged", 2), ("Die", 3)]


def ceo_sheet() -> Image.Image:
    """Jeden sheet: pre každý smer za sebou všetky snímky všetkých animácií, zalomené po CEO_COLUMNS."""
    frames: list[Image.Image] = []
    counts: dict[str, int] = {}
    for d in CEO_DIRS:
        for anim, step in CEO_ANIMS:
            with zipfile.ZipFile(BUSINESSMAN_SRC / f"{anim}.zip") as z:
                sheet = Image.open(io.BytesIO(z.read(f"{anim}/Businessman_{anim}_dir{d}.png"))).convert("RGBA")
                meta = json.loads(z.read(f"{anim}/Businessman_{anim}_dir{d}.json"))
            picked = meta["frames"][::step]
            counts[anim] = len(picked)
            for f in picked:
                r = f["frame"]
                x0, y0, x1, y1 = CEO_CROP
                frames.append(sheet.crop((r["x"] + x0, r["y"] + y0, r["x"] + x1, r["y"] + y1)))
    w, h = CEO_CROP[2] - CEO_CROP[0], CEO_CROP[3] - CEO_CROP[1]
    rows = (len(frames) + CEO_COLUMNS - 1) // CEO_COLUMNS
    out = Image.new("RGBA", (w * CEO_COLUMNS, h * rows), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, ((i % CEO_COLUMNS) * w, (i // CEO_COLUMNS) * h))
    print("CEO snímky na smer:", counts)
    return out


# ---------------------------------------------------------------- nábytok (Kenney Furniture Kit, CC0)
# Kenney rendery sú vyhladené 3D – zmenšíme ich (podlaha Kenney ≈ 151 px → ~75 px), mierne stmavíme
# do pekelnej palety a poskladáme na plátno 64×96: stred podstavy dlaždice na (32, 80), predný roh na y = 96.
FURN_SCALE = 0.5
FURN_W, FURN_H = 64, 96
FURN_DARKEN = 0.82

# budovy na základni: zoznam (predmet, smer, posun x, posun y) – kreslí sa v poradí (zadné prvé)
BUILDING_FURNITURE = {
    "intake": [("desk", "SE", 0, 0), ("computerScreen", "SE", -3, -20), ("chairDesk", "SE", 8, 6)],
    "coffee": [("kitchenCabinet", "SE", 0, 0), ("kitchenCoffeeMachine", "SE", 0, -27)],
    "copier": [("sideTableDrawers", "SE", 0, 0), ("kitchenMicrowave", "SE", 0, -24)],
    "torture": [("washerDryerStacked", "SE", 0, 0)],
    "training": [("tableCoffee", "SE", 0, 2), ("televisionVintage", "SE", 0, -12)],
}
# varianty pre „stôl“ (D) – v kancelárii aj v archívoch dungeonu (tileVariant vyberá podľa súradníc)
DESK_FURNITURE = [
    [("desk", "SE", 0, 0), ("computerScreen", "SE", -3, -20)],
    [("bookcaseClosed", "SE", 0, 0)],
    [("bookcaseOpen", "SE", 0, 0)],
    [("sideTableDrawers", "SE", 0, 0), ("cardboardBoxClosed", "SE", 2, -22)],
    [("cardboardBoxClosed", "SE", -6, 0), ("cardboardBoxOpen", "SE", 7, 4)],
    [("desk", "SW", 0, 0), ("laptop", "SW", 2, -18)],
]


def diamond_tile(im: Image.Image) -> Image.Image:
    """SBS dlaždice 128×64 sú RGB s čiernym pozadím → zmenšiť na 64×32 a orezať na kosoštvorec."""
    tile = im.convert("RGBA").resize((TILE_W, TILE_H), Image.LANCZOS)
    px = tile.load()
    for y in range(TILE_H):
        for x in range(TILE_W):
            inside = abs(x + 0.5 - TILE_W / 2) / (TILE_W / 2) + abs(y + 0.5 - TILE_H / 2) / (TILE_H / 2) <= 1.0
            if not inside:
                px[x, y] = (0, 0, 0, 0)
    return tile

# dekorácie kancelárie (poradie = snímky `deco_office`, pozri BASE_DECOR v src/world/maps.ts)
DECOR_FURNITURE = [
    [("pottedPlant", "SE", 0, 0)],
    [("trashcan", "SE", 0, 0)],
    [("coatRackStanding", "SE", 0, 0)],
    [("kitchenFridge", "SE", 0, 0)],
    [("cabinetTelevision", "SE", 0, 0), ("televisionModern", "SE", 0, -20)],
    [("loungeSofa", "SE", 0, 4)],
    [("sideTable", "SE", 0, 0), ("radio", "SE", 0, -14)],
    [("bookcaseClosedWide", "SE", 0, 0)],
]


def kenney(kit: Path, name: str, direction: str) -> Image.Image:
    im = Image.open(kit / f"{name}_{direction}.png").convert("RGBA")
    w, h = max(1, round(im.width * FURN_SCALE)), max(1, round(im.height * FURN_SCALE))
    im = im.resize((w, h), Image.LANCZOS)
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # tvrdé okraje ako v pixel arte + stmavenie
            a = 255 if a >= 128 else 0
            px[x, y] = (int(r * FURN_DARKEN), int(g * FURN_DARKEN), int(b * FURN_DARKEN), a)
    return im


def furniture(kit: Path, parts: list[tuple[str, str, int, int]]) -> Image.Image:
    out = Image.new("RGBA", (FURN_W, FURN_H), (0, 0, 0, 0))
    for name, direction, dx, dy in parts:
        im = kenney(kit, name, direction)
        # spodok predmetu kúsok nad predným rohom dlaždice
        out.alpha_composite(im, (FURN_W // 2 - im.width // 2 + dx, 92 - im.height + dy))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--soup", type=Path, required=True, help="rozbalený Isometric Stone Soup")
    ap.add_argument("--puny", type=Path, required=True, help="rozbalené Puny Characters (verzia s orkami)")
    ap.add_argument("--kenney", type=Path, required=True, help="rozbalený Kenney Furniture Kit (kenney_furniturePack.zip)")
    ap.add_argument("--sbs-floors", type=Path, required=True, help="rozbalené SBS Isometric Floor Tiles – Small 128x64")
    args = ap.parse_args()

    soup = next(args.soup.rglob("Tile-Sets"))
    puny = next(args.puny.rglob("Puny-Characters"))
    (OUT / "tiles").mkdir(parents=True, exist_ok=True)
    (OUT / "sprites").mkdir(parents=True, exist_ok=True)
    (OUT / "audio").mkdir(parents=True, exist_ok=True)

    full_blocks(soup / "Walls" / "Block" / "ISS_Block_Brick_Dark-64x64.png", 0).save(OUT / "tiles" / "wall_brick_dark.png")
    full_blocks(soup / "Walls" / "Block" / "ISS_Block_Hell-64x64.png", 0).save(OUT / "tiles" / "block_hell.png")

    (OUT / "buildings").mkdir(parents=True, exist_ok=True)
    kit = next(args.kenney.rglob("Isometric"))
    for name, parts in BUILDING_FURNITURE.items():
        furniture(kit, parts).save(OUT / "buildings" / f"{name}.png")
    strip([furniture(kit, parts) for parts in DESK_FURNITURE]).save(OUT / "tiles" / "desk_office.png")
    strip([furniture(kit, parts) for parts in DECOR_FURNITURE]).save(OUT / "tiles" / "deco_office.png")

    # podlaha kancelárie: drevené parkety SBS (128×64 → 64×32)
    interior = next(args.sbs_floors.rglob("Interior"))
    wood = Image.open(interior / "1 Floor - Wood 128x64.png").convert("RGBA")
    strip([diamond_tile(wood.crop((c * 128, 0, (c + 1) * 128, 64))) for c in range(3)]).save(
        OUT / "tiles" / "floor_office.png"
    )

    shutil.copy(puny / "Human-Worker-Red.png", OUT / "sprites" / "manager.png")
    for i, sheet in enumerate(SINNER_SHEETS):
        shutil.copy(puny / f"{sheet}.png", OUT / "sprites" / f"sinner_{i}.png")

    # Oddelenie reklamácií (expedícia)
    floor_row(soup / "Floors" / "ISS_Floor_Rough_Red-64x32.png", 0).save(OUT / "tiles" / "floor_complaints.png")
    full_blocks(soup / "Walls" / "Block" / "ISS_Block_Pebble_Red-64x64.png", 0).save(OUT / "tiles" / "wall_pebble_red.png")
    floor_row(soup / "Floors" / "ISS_Floor_Tutorial_Pad-64x32.png", 0).save(OUT / "tiles" / "elevator.png")
    floor_tile(soup / "Floors" / "ISS_Floor_Stairs-64x32.png", 1, 1).save(OUT / "tiles" / "stairs.png")
    for name, floor, wall in DEPTH_THEMES:
        floor_row(soup / "Floors" / f"ISS_Floor_{floor}-64x32.png", 0).save(OUT / "tiles" / f"floor_{name}.png")
        full_blocks(soup / "Walls" / "Block" / f"ISS_Block_{wall}-64x64.png", 0).save(OUT / "tiles" / f"wall_{name}.png")
    for name, sheet in ENEMY_SHEETS.items():
        shutil.copy(puny / f"{sheet}.png", OUT / "sprites" / f"enemy_{name}.png")

    ceo_sheet().save(OUT / "sprites" / "boss_ceo.png", optimize=True)

    shutil.copy(MUSIC_SRC / "Searching.ogg", OUT / "audio" / "music_base.ogg")
    shutil.copy(MUSIC_SRC / "Insistent.ogg", OUT / "audio" / "music_expedition.ogg")

    for f in sorted(OUT.rglob("*.*")):
        print(f.relative_to(OUT), Image.open(f).size if f.suffix == ".png" else f"{f.stat().st_size // 1024} kB")


if __name__ == "__main__":
    main()
