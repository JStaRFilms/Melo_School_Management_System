"""Crop empty studio space and compress A's supplied image. Keep its shadows."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
source = ROOT / "you-source.png"
output = ROOT / "you-hero.webp"
with Image.open(source) as image:
    assert image.size == (1402, 1122)
    artwork = image.convert("RGB").crop((0, 280, 1402, 980))
    artwork.save(output, "WEBP", quality=90, method=6)
manifest = {
    "original": "E:/Downloads/ChatGPT Image Sep 30, 2026, 11_43_55 AM.png",
    "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "source_dimensions": [1402, 1122],
    "crop": [0, 280, 1402, 980],
    "dimensions": artwork.size,
    "output": output.name,
    "bytes": output.stat().st_size,
    "processing": "Empty space cropped above/below; full width, colours and contact shadows retained. RGB WebP, no transparency requested or invented.",
    "publication_status": "Private prototype. Imagined artwork, not actual school facilities or pupil work.",
}
(ROOT / "you-provenance.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))
