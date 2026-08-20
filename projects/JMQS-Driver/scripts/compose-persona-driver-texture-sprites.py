"""Compose the Persona Driver sprite sequence from the approved element textures."""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


PROJECT = Path(__file__).resolve().parents[1]
ELEMENTS = PROJECT / "public" / "driver-textures"
OUTPUT = PROJECT / "public" / "driver-textures" / "frames"
SIZE = 1024


def cutout(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox:
        image = image.crop(bbox)
    return image


def fit_height(image: Image.Image, height: int) -> Image.Image:
    ratio = height / image.height
    return image.resize((max(1, round(image.width * ratio)), height), Image.Resampling.LANCZOS)


def fit_width(image: Image.Image, width: int) -> Image.Image:
    ratio = width / image.width
    return image.resize((width, max(1, round(image.height * ratio))), Image.Resampling.LANCZOS)


def paste_center(canvas: Image.Image, image: Image.Image, center_x: float, center_y: float) -> None:
    canvas.alpha_composite(image, (round(center_x - image.width / 2), round(center_y - image.height / 2)))


def glow_for(image: Image.Image, color: tuple[int, int, int], strength: float, blur: float) -> Image.Image:
    alpha = image.getchannel("A").filter(ImageFilter.GaussianBlur(blur))
    tint = Image.new("RGBA", image.size, (*color, 0))
    tint.putalpha(alpha.point(lambda value: round(value * strength)))
    return tint


def make_card(progress: float) -> Image.Image:
    width, height = 152, 244
    card = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle((2, 2, width - 3, height - 3), radius=12, fill=(9, 12, 18, 255), outline=(166, 181, 202, 255), width=4)
    draw.rounded_rectangle((14, 14, width - 15, height - 15), radius=7, outline=(46, 58, 76, 255), width=3)
    draw.rectangle((26, 34, width - 27, 40), fill=(239, 48, 72, 235))
    draw.ellipse((55, 88, width - 56, 142), fill=(42, 51, 65, 255), outline=(179, 190, 207, 255), width=3)
    for x, bar_height in ((47, 53), (67, 68), (87, 61), (107, 49)):
        draw.rounded_rectangle((x, 170 - bar_height, x + 8, 170), radius=3, fill=(196, 205, 218, 245))
    draw.rectangle((38, height - 34, width - 39, height - 27), fill=(239, 48, 72, 240))
    return card


def base_belt() -> Image.Image:
    belt = fit_width(cutout(ELEMENTS / "belt-v1.png"), 950)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    paste_center(canvas, belt, SIZE / 2, 535)
    return canvas


def make_foreground_layer() -> None:
    source = Image.open(ELEMENTS / "belt-v1.png").convert("RGBA")
    pixels = source.load()
    width, height = source.size
    overlay = Image.new("RGBA", source.size, (0, 0, 0, 0))
    output = overlay.load()
    left, right = round(width * 0.34), round(width * 0.66)
    top, bottom = round(height * 0.18), round(height * 0.84)
    for y in range(top, bottom):
        for x in range(left, right):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            spread = max(red, green, blue) - min(red, green, blue)
            is_scan_red = red > 82 and red > green * 1.34 and red > blue * 1.18
            is_silver_edge = red > 120 and green > 120 and blue > 120 and spread < 62
            if is_scan_red or is_silver_edge:
                output[x, y] = (red, green, blue, alpha)
    overlay.save(ELEMENTS / "belt-foreground-v1.png", format="PNG", optimize=True)


def add_rod(canvas: Image.Image, source: Image.Image, center_x: float, center_y: float, angle: float) -> Image.Image:
    rod = fit_height(source, 310).rotate(angle, Image.Resampling.BICUBIC, expand=True)
    paste_center(canvas, rod, center_x, center_y)
    return rod


def compose(card_progress: float | None = None, energy: bool = False, skill: bool = False, activation: float = 0.0) -> Image.Image:
    canvas = base_belt()
    energy_source = cutout(ELEMENTS / "energy-rod-v1.png")
    skill_source = cutout(ELEMENTS / "skill-rod-v1.png")

    if card_progress is not None:
        card = make_card(card_progress)
        card_y = 510 - round((1 - card_progress) * 270)
        paste_center(canvas, card, 512, card_y)

    if energy:
        energy_x = 366 + round(activation * 40)
        energy_angle = 12 - activation * 8
        rod = add_rod(canvas, energy_source, energy_x, 513, energy_angle)
        canvas.alpha_composite(glow_for(rod, (38, 214, 229), 0.23, 15), (round(energy_x - rod.width / 2), round(513 - rod.height / 2)))
    if skill:
        skill_x = 658 - round(activation * 40)
        skill_angle = -12 + activation * 8
        rod = add_rod(canvas, skill_source, skill_x, 513, skill_angle)
        canvas.alpha_composite(glow_for(rod, (242, 151, 56), 0.2, 15), (round(skill_x - rod.width / 2), round(513 - rod.height / 2)))

    if activation > 0:
        aura = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        aura_draw = ImageDraw.Draw(aura)
        radius = 164 + round(activation * 34)
        aura_draw.ellipse((512 - radius, 512 - radius, 512 + radius, 512 + radius), fill=(239, 48, 72, round(52 * activation)))
        aura = aura.filter(ImageFilter.GaussianBlur(32))
        canvas.alpha_composite(aura)
        canvas = ImageEnhance.Contrast(canvas).enhance(1 + activation * 0.14)
        canvas = ImageEnhance.Brightness(canvas).enhance(1 + activation * 0.08)

    return canvas


def write_frame(name: str, image: Image.Image) -> None:
    image.save(OUTPUT / name, format="PNG", optimize=True)


OUTPUT.mkdir(parents=True, exist_ok=True)
make_foreground_layer()
for old in OUTPUT.glob("*.png"):
    old.unlink()

write_frame("belt-empty.png", compose())
for index in range(8):
    write_frame(f"insert-{index:02d}.png", compose(card_progress=index / 7))
write_frame("loaded-energy.png", compose(card_progress=1, energy=True))
write_frame("loaded-skill.png", compose(card_progress=1, skill=True))
for index in range(12):
    write_frame(f"activate-{index:02d}.png", compose(card_progress=1, energy=True, skill=True, activation=index / 11))

manifest = {
    "schema": "persona-driver-sprites/v1",
    "source": "approved element textures in public/driver-textures",
    "size": [SIZE, SIZE],
    "empty": "/driver-textures/frames/belt-empty.png",
    "insert": [f"/driver-textures/frames/insert-{index:02d}.png" for index in range(8)],
    "loadedEnergy": "/driver-textures/frames/loaded-energy.png",
    "loadedSkill": "/driver-textures/frames/loaded-skill.png",
    "activate": [f"/driver-textures/frames/activate-{index:02d}.png" for index in range(12)],
}
(OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print("composed 23 sprites from approved element textures")
