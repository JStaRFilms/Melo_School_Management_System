"""Build one material-led Olive proof scene. Never render, save, or export."""
from pathlib import Path
import math
import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
SCENE = bpy.data.scenes.new("Olive material composition")
PREFIX = "Olive material / "
SCALE = 0.16


def colour(value):
    channels = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x < 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in channels) + (1,)


def material(name, value, roughness):
    mat = bpy.data.materials.new(PREFIX + name)
    mat.use_nodes = True
    mat.diffuse_color = colour(value)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    shader.inputs["Roughness"].default_value = roughness
    return mat, shader


def grain(mat, shader, frequency, distance, strength):
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = frequency
    noise.inputs["Detail"].default_value = 3
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value = distance
    bump.inputs["Strength"].default_value = strength
    links.new(coordinates.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])


cyan, shader = material("cyan painted lacquer", "#20ABC2", 0.3)
shader.inputs["Coat Weight"].default_value = 0.32
shader.inputs["Coat Roughness"].default_value = 0.2
grain(cyan, shader, 280, 0.00006, 0.18)
coral, shader = material("coral paper backdrop", "#EF704D", 0.84)
grain(coral, shader, 240, 0.00008, 0.35)
paper, shader = material("uncoated white paper", "#FFFDF5", 0.73)
shader.inputs["Subsurface Weight"].default_value = 0.025
grain(paper, shader, 360, 0.00009, 0.48)
clay, shader = material("coral pigment paper", "#EF704D", 0.76)
grain(clay, shader, 320, 0.00008, 0.4)
gold, shader = material("ochre pigment paper", "#D8AC4C", 0.78)
grain(gold, shader, 320, 0.00008, 0.4)
ink, shader = material("deep blue edge", "#163949", 0.5)
thread, shader = material("cotton hem thread", "#DFD6C3", 0.83)
shader.inputs["Sheen Weight"].default_value = 0.25

cloth, shader = material("woven patterned cotton", "#203644", 0.78)
shader.inputs["Sheen Weight"].default_value = 0.42
shader.inputs["Sheen Roughness"].default_value = 0.65
nt = cloth.node_tree
uv = nt.nodes.new("ShaderNodeTexCoord")
repeat = nt.nodes.new("ShaderNodeVectorMath")
repeat.operation = "MULTIPLY"
repeat.inputs[1].default_value = (0.65, 0.65, 1)
image = nt.nodes.new("ShaderNodeTexImage")
image.image = bpy.data.images.load(str(ROOT / "uniform-inspired-pattern.png"), check_existing=True)
image.extension = "REPEAT"
nt.links.new(uv.outputs["UV"], repeat.inputs[0])
nt.links.new(repeat.outputs["Vector"], image.inputs["Vector"])
nt.links.new(image.outputs["Color"], shader.inputs["Base Color"])
warp = nt.nodes.new("ShaderNodeTexWave")
warp.wave_type = "BANDS"
warp.bands_direction = "X"
warp.inputs["Scale"].default_value = 120
warp.inputs["Distortion"].default_value = 1.2
weft = nt.nodes.new("ShaderNodeTexWave")
weft.wave_type = "BANDS"
weft.bands_direction = "Y"
weft.inputs["Scale"].default_value = 120
multiply = nt.nodes.new("ShaderNodeMath")
multiply.operation = "MULTIPLY"
bump = nt.nodes.new("ShaderNodeBump")
bump.inputs["Distance"].default_value = 0.00032
bump.inputs["Strength"].default_value = 0.75
nt.links.new(uv.outputs["UV"], warp.inputs["Vector"])
nt.links.new(uv.outputs["UV"], weft.inputs["Vector"])
nt.links.new(warp.outputs["Color"], multiply.inputs[0])
nt.links.new(weft.outputs["Color"], multiply.inputs[1])
nt.links.new(multiply.outputs[0], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], shader.inputs["Normal"])


def mesh_object(name, vertices, faces, mat, smooth=False):
    mesh = bpy.data.meshes.new(PREFIX + name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(PREFIX + name, mesh)
    SCENE.collection.objects.link(obj)
    mesh.materials.append(mat)
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return obj


def rounded_box(name, dimensions, location, mat, radius):
    mesh = bpy.data.meshes.new(PREFIX + name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for vertex in bm.verts:
        for axis in range(3):
            vertex.co[axis] *= dimensions[axis]
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(PREFIX + name, mesh)
    SCENE.collection.objects.link(obj)
    obj.location = location
    mesh.materials.append(mat)
    mod = obj.modifiers.new("Soft edge", "BEVEL")
    mod.width = radius
    mod.segments = 8
    obj.modifiers.new("Surface normals", "WEIGHTED_NORMAL")
    return obj


# A close-up section of a coloured work surface, not miniature furniture.
rounded_box("cyan lacquer work surface", (6.9, 4.5, 0.29), (0, 0, 0.19), cyan, 0.13)
rounded_box("deep blue underside", (6.72, 4.3, 0.11), (0, 0, 0.06), ink, 0.05)
rounded_box("coral ground", (180, 180, 0.2), (0, 0, -0.2), coral, 0)


# Authored paper lettering gives the material study a subject, not generic props.
# This is draft lettering, not a replacement for the school's official logo.
font = bpy.data.fonts.load('C:/Windows/Fonts/ARLRDBD.TTF')
for layer in range(8):
    curve = bpy.data.curves.new(PREFIX + "paper lettering", "FONT")
    curve.body = "olive"
    curve.font = font
    curve.size = 1.62
    curve.space_character = 1.03
    curve.extrude = 0.013
    curve.bevel_depth = 0.009
    curve.bevel_resolution = 4
    curve.resolution_u = 16
    curve.materials.append(paper if layer == 0 else (gold if layer % 3 == 0 else paper))
    obj = bpy.data.objects.new(PREFIX + "paper lettering layer " + str(layer + 1), curve)
    SCENE.collection.objects.link(obj)
    obj.location = (-1.86, -0.65 + layer * 0.035, 0.35)
    obj.rotation_euler.x = math.pi / 2


def cloth_point(t, u):
    x = -3.43 + 6.36 * t
    y = -1.12 + 1.65 * t + 0.25 * math.sin(t * math.pi * 2) + u * 1.25
    z = 0.35 + 1.50 * math.exp(-((t - 0.26) / 0.12) ** 2)
    z += 0.045 * math.sin(u * math.pi * 5 + t * 11) * math.sin(t * math.pi)
    z += 0.022 * math.cos(u * math.pi * 2)
    return x, y, z


length_steps, width_steps = 220, 32
vertices = [cloth_point(i / length_steps, j / width_steps - 0.5) for i in range(length_steps + 1) for j in range(width_steps + 1)]
faces = []
for i in range(length_steps):
    for j in range(width_steps):
        a = i * (width_steps + 1) + j
        faces.append((a, a + 1, a + width_steps + 2, a + width_steps + 1))
ribbon = mesh_object("folded cotton ribbon", vertices, faces, cloth, True)
uv_layer = ribbon.data.uv_layers.new(name="Continuous cloth weave")
for polygon in ribbon.data.polygons:
    for loop_index in polygon.loop_indices:
        vi = ribbon.data.loops[loop_index].vertex_index
        uv_layer.data[loop_index].uv = ((vi % (width_steps + 1)) / width_steps, (vi // (width_steps + 1)) / length_steps * 6.36)
solid = ribbon.modifiers.new("Cotton thickness", "SOLIDIFY")
solid.thickness = 0.004


def seam(name, points, radius):
    curve = bpy.data.curves.new(PREFIX + name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(PREFIX + name, curve)
    SCENE.collection.objects.link(obj)
    curve.materials.append(thread)


for edge in (-0.47, 0.47):
    for stitch in range(65):
        points = []
        for j in range(4):
            t = (stitch + 0.22 + j * 0.15) / 65
            x, y, z = cloth_point(t, edge)
            points.append((x, y, z + 0.009))
        seam("cotton edge stitch", points, 0.003)


# A fan of pigmented paper catches the foreground light and exposes its edges.
for index in range(18):
    turn = math.radians(-22 + index * 2.4)
    sheet = rounded_box("pigmented paper fan " + str(index), (1.60, 0.93, 0.011), (2.1, -1.32, 0.37 + index * 0.016), paper if index == 17 else (gold if index % 3 else clay), 0.004)
    sheet.rotation_euler.z = turn

world = bpy.data.worlds.new(PREFIX + "studio world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.88, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.18
SCENE.world = world


def area(name, position, energy, dimensions, tint, target=(0, 0, 0.8)):
    light = bpy.data.lights.new(PREFIX + name, "AREA")
    light.shape = "RECTANGLE"
    light.energy = energy * SCALE ** 2
    light.size = dimensions[0] * SCALE
    light.size_y = dimensions[1] * SCALE
    light.color = tint
    obj = bpy.data.objects.new(PREFIX + name, light)
    SCENE.collection.objects.link(obj)
    obj.location = Vector(position) * SCALE
    obj.rotation_euler = (Vector(target) * SCALE - obj.location).to_track_quat("-Z", "Y").to_euler()


# Scale the authored sculpture to tabletop still-life dimensions for depth of field.
for obj in list(SCENE.objects):
    obj.location *= SCALE
    obj.scale *= SCALE
area("soft window key", (-3.5, -3.0, 7), 850, (4.0, 5.0), (1, 0.94, 0.85))
area("edge strip", (2.5, 4.5, 5), 950, (0.8, 4.0), (0.84, 0.94, 1))
area("gentle front fill", (5, -3.5, 3.0), 120, (3, 3), (1, 0.87, 0.76))

focus = bpy.data.objects.new(PREFIX + "material focus", None)
SCENE.collection.objects.link(focus)
focus.location = Vector((-0.5, 0.1, 0.85)) * SCALE
camera_data = bpy.data.cameras.new(PREFIX + "perspective camera")
camera = bpy.data.objects.new(PREFIX + "perspective camera", camera_data)
SCENE.collection.objects.link(camera)
camera.location = Vector((4.8, -8.0, 4.0)) * SCALE
camera.rotation_euler = (Vector((-0.1, 0, 0.83)) * SCALE - camera.location).to_track_quat("-Z", "Y").to_euler()
camera_data.type = "PERSP"
camera_data.lens = 52
camera_data.clip_start = 0.01
camera_data.dof.use_dof = True
camera_data.dof.focus_object = focus
camera_data.dof.aperture_fstop = 5.0
SCENE.camera = camera
SCENE.render.engine = "CYCLES"
SCENE.cycles.device = "CPU"
SCENE.cycles.samples = 16
SCENE.cycles.use_denoising = True
SCENE.cycles.max_bounces = 6
SCENE.render.threads_mode = "FIXED"
SCENE.render.threads = 4
SCENE.render.resolution_x = 640
SCENE.render.resolution_y = 400
SCENE.render.resolution_percentage = 100
SCENE.render.image_settings.file_format = "PNG"
SCENE.render.image_settings.color_mode = "RGB"
SCENE.view_settings.view_transform = "AgX"
SCENE.view_settings.look = "AgX - Medium High Contrast"
SCENE.view_settings.exposure = 0
SCENE.render.film_transparent = False
result = {"scene": SCENE.name, "objects": len(SCENE.objects), "engine": SCENE.render.engine, "saved": False, "rendered": False, "active_scene": bpy.context.scene.name}
