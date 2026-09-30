"""Prepare a browser cutout from the supplied PNG pair. Sources stay unchanged."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
background = ROOT / "hero-background-source.png"
cutout = ROOT / "hero-cutout-source.png"
with Image.open(background) as source:
    artwork = source.convert("RGBA")
with Image.open(cutout) as source:
    assert source.size == artwork.size
    assert source.mode == "RGBA"
    alpha = source.getchannel("A")

# The supplied cutout altered interior colours and left faint background pixels.
# Keep the original artwork's RGB and use only the cutout's transparency mask.
alpha = alpha.point([0 if value <= 12 else 255 if value >= 240 else round((value - 12) * 255 / 228) for value in range(256)])
alpha = alpha.filter(ImageFilter.MinFilter(3))
artwork.putalpha(alpha)
bounds = alpha.getbbox()
assert bounds is not None
crop = (0, max(0, bounds[1] - 16), artwork.width, artwork.height)
artwork = artwork.crop(crop)
output = ROOT / "hero-cutout.webp"
artwork.save(output, "WEBP", quality=88, method=6)
manifest = {
    "source": "User-supplied ChatGPT image-generation outputs; backend/model not independently verified",
    "background_original": "E:/Downloads/ChatGPT Image Sep 30, 2026, 06_29_29 AM.png",
    "cutout_original": "E:/Downloads/ChatGPT Image Sep 30, 2026, 06_29_23 AM.png",
    "source_sha256": {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in (background, cutout)},
    "processing": "Original background-version RGB; supplied alpha remapped at 12/240; one-pixel mask inset; empty top cropped with 16px clearance",
    "crop": crop,
    "dimensions": artwork.size,
    "output": output.name,
    "bytes": output.stat().st_size,
    "publication_status": "Private prototype. Imagined artwork, not real facilities or pupil work.",
}
(ROOT / "provenance.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: manifest[key] for key in ("crop", "dimensions", "bytes")}, indent=2))
