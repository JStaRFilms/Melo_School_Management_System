"""Render an already-built study. Never creates scenes or saves a blend file."""
from pathlib import Path
import math
import time
import bpy
from mathutils import Vector

OUTPUT = Path(__file__).resolve().parent
scene = bpy.data.scenes["Olive colourful table study"]
scene.render.resolution_x = 960
scene.render.resolution_y = 786
scene.render.resolution_percentage = 100
scene.eevee.taa_render_samples = 24
scene.view_settings.exposure = -0.8
renders = []

for name, position, target, scale, roll in [
    ("table-perspective", (7, -10, 9), (0, 0, 1.2), 10.8, 0),
    ("table-overhead", (0, -1.4, 14), (0, 0, 1.3), 9.5, -9),
]:
    scene.camera.location = position
    scene.camera.rotation_euler = (Vector(target) - scene.camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera.rotation_euler.rotate_axis("Z", math.radians(roll))
    scene.camera.data.ortho_scale = scale
    scene.render.filepath = str(OUTPUT / (name + ".png"))
    started = time.monotonic()
    bpy.ops.render.render(write_still=True, scene=scene.name)
    renders.append({"file": scene.render.filepath, "seconds": round(time.monotonic() - started, 2)})

result = {"renders": renders, "active_scene": bpy.context.scene.name, "blend_saved": False}
