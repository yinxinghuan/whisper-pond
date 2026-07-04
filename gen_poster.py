#!/usr/bin/env python3
"""Generate Physics Pond poster via platform gen-image."""
import json
import os
import ssl
import subprocess
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

API_URL = "https://chat.aiwaves.tech/aigram/api/gen-image"
HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://aigram.app",
    "Referer": "https://aigram.app/",
    "User-Agent": "Mozilla/5.0",
}

HERE = Path(__file__).parent
RAW = HERE / "_poster_raw.png"
OUT_GAME = HERE / "public" / "poster.png"
OUT_LIST = Path("/Users/yin/code/games/games/posters/whisper-pond.png")
SIZE = 1024
_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode = ssl.CERT_NONE

PROMPT = (
    "Square 1:1 full-bleed bright cinematic 3D toy photography with sharp square image corners. "
    "A beautiful tabletop physics machine fills the entire image edge to edge: hundreds of glossy "
    "colorful marble spheres, adjustable pale wooden planks, small ramps and pins, one yellow "
    "collection tray, warm daylight studio lighting, soft shadows, shallow depth of field, polished "
    "product-photography realism, playful and premium. Use a cream and pale wood tabletop setting, "
    "not a dark app icon background. Do not write any text. No letters, no words, no numbers, no "
    "symbols, no logo, no UI, no app icon border, no neon frame, no line around the edge, no "
    "decorative corners, no rounded rectangle."
)

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Avenir Next Condensed.ttc",
    "/System/Library/Fonts/Supplemental/Futura.ttc",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica.ttc",
]


def call_gen_image(prompt, timeout=360, retries=3):
    data = json.dumps({"prompt": prompt}).encode()
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(API_URL, data=data, method="POST", headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as response:
                body = json.loads(response.read())
            url = body.get("url")
            if not url:
                raise RuntimeError(f"gen-image response has no url: {body}")
            return url
        except Exception as exc:
            last = exc
            print(f"retry {attempt + 1}/{retries}: {exc}", flush=True)
            time.sleep(8 * (attempt + 1))
    raise last


def download_image(url, out):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90, context=_SSL) as response:
        data = response.read()
    ext = os.path.splitext(url.split("?")[0])[1].lower() or ".png"
    tmp = out.with_suffix(".download" + ext)
    tmp.write_bytes(data)
    subprocess.run(["sips", "-s", "format", "png", str(tmp), "--out", str(out)], check=True, capture_output=True)
    tmp.unlink()


def fit_square(img):
    img = img.convert("RGB")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    inset = int(os.environ.get("PHYSICS_POSTER_INSET", "92"))
    if inset > 0:
        img = img.crop((inset, inset, side - inset, side - inset))
    return img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def find_font(size):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def fit_font(draw, text, max_width, start_size):
    size = start_size
    while size > 42:
        font = find_font(size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font
        size -= 4
    return find_font(size)


def add_title(img):
    img = img.convert("RGBA")
    title = "Physics Pond"
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    shadow_draw = ImageDraw.Draw(shadow)

    font = fit_font(draw, title, 830, 116)
    bbox = draw.textbbox((0, 0), title, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (SIZE - tw) // 2
    y = 88

    # A soft top scrim gives generated art enough quiet space for the title.
    scrim = Image.new("RGBA", img.size, (0, 0, 0, 0))
    scrim_px = scrim.load()
    for row in range(0, 330):
        alpha = int((1 - row / 330) ** 1.55 * 142)
        for col in range(SIZE):
            scrim_px[col, row] = (4, 13, 22, alpha)
    img = Image.alpha_composite(img, scrim)

    shadow_draw.text((x, y), title, font=font, fill=(0, 229, 255, 160))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    overlay = Image.alpha_composite(shadow, overlay)
    draw = ImageDraw.Draw(overlay)
    draw.text((x + 2, y + 3), title, font=font, fill=(4, 12, 24, 155))
    draw.text((x, y), title, font=font, fill=(255, 255, 248, 255))

    accent_y = y + th + 28
    draw.rounded_rectangle(
        ((SIZE - 248) // 2, accent_y, (SIZE + 248) // 2, accent_y + 6),
        radius=3,
        fill=(0, 229, 255, 215),
    )
    return Image.alpha_composite(img, overlay).convert("RGB")


def compose():
    poster = add_title(fit_square(Image.open(RAW)))
    OUT_GAME.parent.mkdir(parents=True, exist_ok=True)
    OUT_LIST.parent.mkdir(parents=True, exist_ok=True)
    poster.save(OUT_GAME, "PNG", optimize=True)
    poster.save(OUT_LIST, "PNG", optimize=True)
    print(f"wrote {OUT_GAME}")
    print(f"wrote {OUT_LIST}")


def main():
    if os.environ.get("PHYSICS_POSTER_USE_RAW") == "1" and RAW.exists():
        print(f"using existing raw {RAW}", flush=True)
    else:
        print("generating Physics Pond key art...", flush=True)
        url = call_gen_image(PROMPT)
        print(url, flush=True)
        download_image(url, RAW)
    compose()


if __name__ == "__main__":
    main()
