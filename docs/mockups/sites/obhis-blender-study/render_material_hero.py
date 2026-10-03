"""Render the existing material composition. Never model, save, or export."""
from pathlib import Path
import time
import bpy

scene = bpy.data.scenes["Olive material composition"]
scene.render.resolution_x = 1200
scene.render.resolution_y = 750
scene.render.resolution_percentage = 100
scene.cycles.samples = 24
scene.render.filepath = str(Path(__file__).resolve().parent / "material-hero.png")
started = time.monotonic()
bpy.ops.render.render(write_still=True, scene=scene.name)
result = {
    "file": scene.render.filepath,
    "seconds": round(time.monotonic() - started, 2),
    "active_scene": bpy.context.scene.name,
    "blend_saved": False,
}
