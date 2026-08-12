from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


WORK_IDS = ("heungbu", "chunhyang", "honggildong", "simcheong", "byeoljubu", "jeonwoochi")
ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "public" / "assets" / "classics"
OUTPUT_ROOT = ROOT / "tmp" / "imagegen" / "pose-references"


def build_sheet(work_id: str) -> Path:
    cell_size = 512
    sheet = Image.new("RGB", (cell_size * 3, cell_size * 2), "#e8edf3")
    draw = ImageDraw.Draw(sheet)

    for index in range(6):
        source = ASSET_ROOT / work_id / "characters" / f"character-{index + 1:02d}.webp"
        with Image.open(source).convert("RGBA") as character:
            character.thumbnail((cell_size - 48, cell_size - 48), Image.Resampling.LANCZOS)
            x = (index % 3) * cell_size + (cell_size - character.width) // 2
            y = (index // 3) * cell_size + cell_size - character.height - 20
            sheet.paste(character, (x, y), character)

        left = (index % 3) * cell_size
        top = (index // 3) * cell_size
        draw.rectangle((left, top, left + cell_size - 1, top + cell_size - 1), outline="#aab4c2", width=2)

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_ROOT / f"{work_id}-standing-reference.webp"
    sheet.save(output, "WEBP", quality=92, method=6)
    return output


if __name__ == "__main__":
    for work in WORK_IDS:
        print(build_sheet(work))
