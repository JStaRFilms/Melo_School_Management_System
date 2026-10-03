# Blender table study

The original vector homepage comparison is saved in local commit `03cbd25` on `feature/obhis-website`. This folder contains an original, successfully rendered Blender study. It is an illustrative shared table, not a model of actual school facilities or pupil work.

## Rendered views

- `table-perspective.png`: the table and its open white chair, seen at an angle.
- `table-overhead.png`: the same table seen from above.
- `table-perspective-preview.png`: the initial 640-pixel diagnostic render.

Final images are 960 × 786 transparent PNGs from Eevee at 24 samples. No `.blend` file was saved.

## Confirmed crash trigger

The supplied Blender 5.2.2 crash report records `EXCEPTION_ACCESS_VIOLATION` while executing line 279 of the original `build_table.py`:

```python
bpy.data.libraries.write(str(OUTPUT / "olive-table-study.blend"), {SCENE}, fake_user=True, compress=True)
```

The native stack runs through `bpy_lib_write`, `PartialWriteContext::id_add_copy`, `scene_copy_data`, and `BKE_view_layer_copy_data`. This identifies scene library export as the triggering operation. The report does not identify rendering or an out-of-memory error as the failure. The underlying Blender state or implementation defect has not been established.

The script attempted to create a separate illustrated table scene and export only that scene, without saving over the user's open file. Its automatic export caused Blender to terminate before any rendering step.

## Local correction

Automatic image packing and scene export have been removed. The script now only creates a new in-memory scene and reports its name and object count. It does not save a `.blend` file or render. The pattern PNG is original artwork based on colours observed in the school uniforms, not a scan of the actual textile.

## Verified recovery

After explicit user approval, the corrected modelling-only script executed successfully and created a separate scene named `Olive colourful table study` with 48 objects. A 640-pixel test rendered successfully before the two final views. `render_views.py` then reproduced both final images successfully.

The active scene remained `Scene`, and its original `Cube`, `Light`, and `Camera` were unchanged. The model exists in memory alongside that original scene. No library export or Blender file save was attempted during recovery.

`build_table.py` models only. `render_views.py` renders only and expects the study scene to exist. Both scripts are saved here to reproduce the work. Running the modelling script again creates another scene, so do not rerun it automatically. Continue to separate modelling, rendering, and saving; any future file-save operation needs separate approval and verification.
