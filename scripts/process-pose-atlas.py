from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


def crop_cell(image: Image.Image, index: int) -> Image.Image:
    column = index % 3
    row = index // 3
    left = round(image.width * column / 3)
    top = round(image.height * row / 2)
    right = round(image.width * (column + 1) / 3)
    bottom = round(image.height * (row + 1) / 2)
    return image.crop((left, top, right, bottom))


def save_character(image: Image.Image, output: Path) -> None:
    contained = ImageOps.contain(image, (512, 512), method=Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(contained.convert("RGBA"), ((512 - contained.width) // 2, (512 - contained.height) // 2))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, "WEBP", quality=86, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", type=Path, required=True)
    parser.add_argument("--work", required=True)
    parser.add_argument("--pose", choices=("sitting", "kneeling"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    with Image.open(args.atlas).convert("RGBA") as atlas:
        for index in range(6):
            output = args.output / args.work / "characters" / "poses" / args.pose / f"character-{index + 1:02d}.webp"
            save_character(crop_cell(atlas, index), output)
            print(output)


if __name__ == "__main__":
    main()
