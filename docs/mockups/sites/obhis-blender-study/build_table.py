"""Original Olive modelling study. Creates a new scene; never saves or renders."""
from pathlib import Path
import math
import bpy
import bmesh
from mathutils import Vector

OUTPUT = Path(__file__).resolve().parent
OUTPUT.mkdir(parents=True, exist_ok=True)
SCENE = bpy.data.scenes.new("Olive colourful table study")


def linear_hex(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c < 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb) + (1,)


def material(name, colour, roughness=0.5):
    mat = bpy.data.materials.new("Olive / " + name)
    mat.diffuse_color = linear_hex(colour)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    shader.inputs["Roughness"].default_value = roughness
    return mat


CYAN = material("cyan enamel", "#39BCD3", 0.33)
CORAL = material("coral enamel", "#EF704D", 0.4)
NAVY = material("dark blue frame", "#203644", 0.48)
GOLD = material("mustard enamel", "#D5BD55", 0.5)
PINK = material("pink shape", "#EDA9B4", 0.55)
PAPER = material("white paper", "#FFFEFA", 0.7)
WHITE = material("white seat", "#FFFFFF", 0.43)
BLUE = material("blue shape", "#65D7E2", 0.4)

# The pattern is original artwork inspired by uniform colours, not a textile scan.
FABRIC = material("uniform-inspired woven fabric", "#203644", 0.82)
nt = FABRIC.node_tree
shader = nt.nodes.get("Principled BSDF")
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(str(OUTPUT / "uniform-inspired-pattern.png"), check_existing=True)
tex.extension = "REPEAT"
coord = nt.nodes.new("ShaderNodeTexCoord")
scale = nt.nodes.new("ShaderNodeVectorMath")
scale.operation = "MULTIPLY"
scale.inputs[1].default_value = (1.7, 3.4, 1)
nt.links.new(coord.outputs["UV"], scale.inputs[0])
nt.links.new(scale.outputs["Vector"], tex.inputs["Vector"])
nt.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
noise = nt.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 190
bump = nt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.22
bump.inputs["Distance"].default_value = 0.014
nt.links.new(coord.outputs["Generated"], noise.inputs["Vector"])
nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], shader.inputs["Normal"])


def link(name, mesh, mat):
    obj = bpy.data.objects.new("Olive / " + name, mesh)
    SCENE.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def box(name, size, location, mat, bevel=0.04, rotation=0):
    mesh = bpy.data.meshes.new("Olive / " + name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for vertex in bm.verts:
        vertex.co.x *= size[0]
        vertex.co.y *= size[1]
        vertex.co.z *= size[2]
    bm.to_mesh(mesh)
    bm.free()
    if mat == FABRIC:
        uv = mesh.uv_layers.new(name="Seat fabric UV")
        for face in mesh.polygons:
            for loop_index in face.loop_indices:
                vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = (vertex.x / size[0] + 0.5, vertex.y / size[1] + 0.5)
    obj = link(name, mesh, mat)
    obj.location = location
    obj.rotation_euler.z = rotation
    if bevel:
        mod = obj.modifiers.new("Soft manufactured edges", "BEVEL")
        mod.width = bevel
        mod.segments = 6
        obj.modifiers.new("Weighted surface normals", "WEIGHTED_NORMAL")
    return obj


def rod(name, a, b, radius, mat):
    mesh = bpy.data.meshes.new("Olive / " + name)
    bm = bmesh.new()
    length = (Vector(b) - Vector(a)).length
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=radius, radius2=radius, depth=length)
    bm.to_mesh(mesh)
    bm.free()
    obj = link(name, mesh, mat)
    obj.location = (Vector(a) + Vector(b)) / 2
    obj.rotation_euler = (Vector(b) - Vector(a)).to_track_quat("Z", "Y").to_euler()
    for face in mesh.polygons:
        face.use_smooth = True
    return obj


def stroke(name, points, mat, radius=0.012):
    curve = bpy.data.curves.new("Olive / " + name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new("Olive / " + name, curve)
    SCENE.collection.objects.link(obj)
    curve.materials.append(mat)
    return obj


# One shared table, not a model of actual school furniture.
box("cyan tabletop", (5.6, 3.7, 0.23), (0, 0, 2.32), CYAN, 0.11)
box("table apron", (4.65, 2.8, 0.28), (0, 0, 2.12), NAVY, 0.07)
for x in (-2.07, 2.07):
    for y in (-1.18, 1.18):
        rod("table leg", (x * 1.12, y * 1.17, 0.05), (x, y, 2.13), 0.075, NAVY)


# Fabric runner is a continuous curved mesh draped over both table edges.
runner_path = []
for i in range(30):
    y = -1.72 + 3.44 * i / 29
    runner_path.append((y, 2.448 + 0.007 * math.sin(i * 0.45)))
for i in range(1, 13):
    t = math.pi / 2 * i / 12
    runner_path.append((1.72 + 0.22 * math.sin(t), 2.228 + 0.22 * math.cos(t)))
for i in range(1, 15):
    runner_path.append((1.94 + 0.025 * math.sin(i * 0.45), 2.228 - i * 0.07))
left_path = []
for i in range(14, 0, -1):
    left_path.append((-1.94 - 0.025 * math.sin(i * 0.45), 2.228 - i * 0.07))
for i in range(12, 0, -1):
    t = math.pi / 2 * i / 12
    left_path.append((-1.72 - 0.22 * math.sin(t), 2.228 + 0.22 * math.cos(t)))
runner_path = left_path + runner_path
vertices = [(x, y, z) for y, z in runner_path for x in (-2.03, -0.84)]
faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(len(runner_path) - 1)]
mesh = bpy.data.meshes.new("Olive / cloth runner")
mesh.from_pydata(vertices, [], faces)
mesh.update()
uv = mesh.uv_layers.new(name="Fabric UV")
for face in mesh.polygons:
    face.use_smooth = True
    for loop_index in face.loop_indices:
        vi = mesh.loops[loop_index].vertex_index
        uv.data[loop_index].uv = (vi % 2, (vi // 2) / (len(runner_path) - 1))
runner = link("cloth runner", mesh, FABRIC)
solid = runner.modifiers.new("Cloth thickness", "SOLIDIFY")
solid.thickness = 0.009


# Seat backs are softly curved shells instead of flat boxes.
def chair(name, x, y, angle, seat_mat, patterned=False):
    parent = bpy.data.objects.new("Olive / " + name, None)
    SCENE.collection.objects.link(parent)
    parent.location = (x, y, 0)
    parent.rotation_euler.z = angle
    children = []
    children.append(box(name + " seat", (1.18, 1.03, 0.12), (0, 0, 1.08), FABRIC if patterned else seat_mat, 0.057))
    verts = []
    for z in (1.07, 2.0):
        for i in range(25):
            xx = -0.55 + i * 1.1 / 24
            yy = 0.40 + 0.13 * (xx / 0.55) ** 2
            verts.append((xx, yy, z + 0.07 * (1 - (xx / 0.55) ** 2)))
    back_faces = [(i, i + 1, i + 26, i + 25) for i in range(24)]
    back_mesh = bpy.data.meshes.new("Olive / curved chair back")
    back_mesh.from_pydata(verts, [], back_faces)
    back_mesh.update()
    back = link(name + " back", back_mesh, seat_mat)
    for polygon in back_mesh.polygons:
        polygon.use_smooth = True
    mod = back.modifiers.new("Seat shell", "SOLIDIFY")
    mod.thickness = 0.085
    mod = back.modifiers.new("Rounded shell edges", "BEVEL")
    mod.width = 0.045
    mod.segments = 5
    children.append(back)
    for xx in (-0.44, 0.44):
        for yy in (-0.34, 0.34):
            children.append(rod(name + " leg", (xx * 1.18, yy * 1.3, 0.05), (xx, yy, 1.06), 0.033, NAVY))
    for child in children:
        child.parent = parent
    return parent


chair("open white place", 0.35, -2.56, math.pi, WHITE)
chair("coral place", -1.68, 2.45, 0, CORAL, patterned=True)
chair("gold place", 1.65, 2.5, 0, GOLD)
chair("coral side place", 3.41, 0.02, -math.pi / 2, CORAL, patterned=True)


# Abstract cooperative shapes, explicitly illustrative rather than pupil work.
for name, x, y, mat, turn in [
    ("coral composition", 0.0, 0.35, CORAL, -0.16),
    ("gold composition", 0.77, 0.42, GOLD, 0.08),
    ("pink composition", 0.89, -0.31, PINK, 0.08),
    ("white loose composition", -0.03, -0.61, PAPER, -0.30),
]:
    box(name, (0.69, 0.63, 0.105), (x, y, 2.50), mat, 0.02, turn)
box("blue bridge", (0.22, 0.63, 0.12), (0.37, 0.29, 2.56), BLUE, 0.02, -0.16)

# A blank paper fold and authored colour strokes, not a child's drawing.
box("paper colour study", (1.0, 0.58, 0.012), (1.60, -0.83, 2.447), PAPER, 0.006, -0.08)
for index, mat in enumerate((CORAL, CYAN, GOLD)):
    points = []
    for i in range(48):
        t = i / 47
        points.append((1.21 + t * 0.72, -0.99 + index * 0.14 + math.sin(t * math.pi * 2) * 0.045, 2.458))
    stroke("authored colour stroke", points, mat, 0.012)


world = bpy.data.worlds.new("Olive / studio world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.86, 1.0, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
SCENE.world = world


def area(name, position, power, size, colour):
    data = bpy.data.lights.new("Olive / " + name, "AREA")
    data.energy = power
    data.shape = "DISK"
    data.size = size
    data.color = colour
    obj = bpy.data.objects.new("Olive / " + name, data)
    SCENE.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, 1.3)) - obj.location).to_track_quat("-Z", "Y").to_euler()


area("large soft window", (-4, -5, 8), 1250, 5.0, (1.0, 0.95, 0.89))
area("cool fill", (5, -1, 5), 650, 4.0, (0.88, 0.96, 1.0))
area("rim light", (1, 6, 7), 950, 3.5, (1.0, 0.96, 0.90))

camera_data = bpy.data.cameras.new("Olive / study camera")
camera = bpy.data.objects.new("Olive / study camera", camera_data)
SCENE.collection.objects.link(camera)
SCENE.camera = camera
camera_data.type = "ORTHO"
SCENE.render.engine = "BLENDER_EEVEE"
SCENE.render.resolution_x = 960
SCENE.render.resolution_y = 786
SCENE.render.resolution_percentage = 100
SCENE.eevee.taa_render_samples = 24
SCENE.render.image_settings.file_format = "PNG"
SCENE.render.image_settings.color_mode = "RGBA"
SCENE.render.film_transparent = True
SCENE.view_settings.view_transform = "Standard"
SCENE.view_settings.look = "None"
SCENE.view_settings.exposure = -0.8
SCENE.view_settings.gamma = 1
SCENE.render.use_file_extension = True


def set_view(position, target, scale):
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.ortho_scale = scale


set_view((7, -10, 9), (0, 0, 1.2), 10.8)
# Export and rendering must be separate, explicitly approved steps.
# Scene library export crashed this Blender build during native view-layer copying.
result = {
    "scene": SCENE.name,
    "objects": len(SCENE.objects),
    "active_scene_unchanged": bpy.context.scene.name != SCENE.name,
    "saved": False,
    "rendered": False,
}
