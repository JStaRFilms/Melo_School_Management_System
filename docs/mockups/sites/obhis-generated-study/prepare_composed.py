"""Remove the paper fan from a separate local copy of the imagined Olive artwork.

Uses the existing cyan surface texture. No lettering, fabric or school photo is
regenerated. Requires local Pillow, NumPy and OpenCV; not a product dependency.
"""
from pathlib import Path
import hashlib
import json

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "hero-cutout.webp"
OUTPUT = ROOT / "hero-composed.webp"
original = Image.open(SOURCE).convert("RGBA")
rgb = np.array(original.convert("RGB"))
mask = Image.new("L", original.size)
ImageDraw.Draw(mask).polygon([
    (836, 517), (935, 451), (1348, 528), (1372, 607),
    (1306, 696), (1211, 737), (983, 731), (907, 614),
], fill=255)
mask_array = np.array(mask)
# Keep the original alpha silhouette, including the cyan surface's outer edge.
mask_array[np.array(original.getchannel("A")) < 240] = 0
x, y, width, height = cv2.boundingRect(mask_array)
donor = rgb[452:525, 230:830]
donor = np.concatenate([donor, donor[::-1]], axis=0)
donor = np.tile(donor, (3, 2, 1))[:height, :width]
cloned = cv2.seamlessClone(
    cv2.cvtColor(donor, cv2.COLOR_RGB2BGR),
    cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR),
    mask_array[y:y + height, x:x + width].copy(),
    (x + width // 2, y + height // 2), cv2.NORMAL_CLONE,
)
cloned = Image.fromarray(cv2.cvtColor(cloned, cv2.COLOR_BGR2RGB)).convert("RGBA")
cloned.putalpha(original.getchannel("A"))
blend = Image.fromarray(mask_array).filter(ImageFilter.GaussianBlur(1))
composed = Image.composite(cloned, original, blend)
composed.putalpha(original.getchannel("A"))
outside = np.array(blend) == 0
assert np.array_equal(np.array(original)[outside], np.array(composed)[outside])
# The reference has less empty foreground below the lettering. Only compress
# the plain surface; the lettering and fabric above this row keep their shape.
surface_start = 480
surface_height = 226
surface = composed.crop((0, surface_start, composed.width, composed.height))
surface = surface.resize((composed.width, surface_height), Image.Resampling.LANCZOS)
output = Image.new("RGBA", (composed.width, surface_start + surface_height))
output.paste(composed.crop((0, 0, composed.width, surface_start)), (0, 0))
output.paste(surface, (0, surface_start))
output.save(OUTPUT, "WEBP", lossless=True, exact=True, method=6)
record = {
    "source": SOURCE.name,
    "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "output": OUTPUT.name,
    "output_sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),
    "dimensions": list(output.size),
    "bytes": OUTPUT.stat().st_size,
    "operation": "Local texture clone removing the paper fan, with the plain foreground shortened to match the user's composition reference.",
    "outside_clone_mask_pixels_unchanged_before_surface_resize": True,
    "foreground_resize": {"start_row": surface_start, "original_height": 301, "output_height": surface_height},
    "lettering_and_fabric_not_resized": True,
    "restriction": "Imagined artwork for private review. Original artwork and all school photographs remain unchanged.",
}
(ROOT / "composed-provenance.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps(record))
