"""Prepare private-review photographs, without changing the school originals."""
from pathlib import Path
import hashlib
import json

from PIL import Image, ImageOps

SOURCE = Path(r"C:\CreativeOS\01_Projects\Clients\OBHIS")
OUTPUT = Path(__file__).resolve().parent
PHOTOS = [
    ("school-friends", "2026-07-12_school_visit/RAW/DSC04736.JPG", None),
    ("classroom-table", "2026-07-12_school_visit/RAW/DSC04757.JPG", None),
    ("cultural-day-abuja", "2025-12-02_cultural_day/images/abuja/DSC02665.JPG", None),
    ("cultural-day-rugam", "2025-12-02_cultural_day/images/Rugam/DSC03099.JPG", None),
    ("uniform-detail", "2026-07-12_school_visit/RAW/DSC04741.JPG", (1800, 3150, 2800, 4200)),
]

records = []
for name, relative_source, crop in PHOTOS:
    source_path = SOURCE / relative_source
    source_hash = hashlib.sha256(source_path.read_bytes()).hexdigest()
    with Image.open(source_path) as original:
        photo = ImageOps.exif_transpose(original).convert("RGB")
        original_size = photo.size
        if crop:
            photo = photo.crop(crop)
        photo.thumbnail((1600, 1200), Image.Resampling.LANCZOS)
        destination = OUTPUT / f"{name}.webp"
        photo.save(destination, "WEBP", quality=86, method=6)
    assert hashlib.sha256(source_path.read_bytes()).hexdigest() == source_hash
    records.append({
        "asset": destination.name,
        "source": relative_source,
        "source_sha256": source_hash,
        "oriented_source_size": list(original_size),
        "crop": list(crop) if crop else None,
        "output_size": list(photo.size),
        "output_bytes": destination.stat().st_size,
        "output_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "publication": "private-review-only; photographer rights and child permissions unconfirmed",
        "processing": "EXIF orientation, optional recorded crop, resize, WebP compression; no recolouring or invented content",
    })

manifest = {
    "source_root": str(SOURCE),
    "scope": "School-visit and cultural-day albums only. No student records or administrative documents.",
    "location_labels": "Abuja and Rugam are supplied album labels, not confirmation of current campus names or addresses.",
    "assets": records,
}
(OUTPUT / "provenance.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
for record in records:
    print(record["asset"], record["output_size"], record["output_bytes"])
