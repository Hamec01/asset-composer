# Art Studio

Open **Рисование** to use DRAW / RIG / ANIMATE. The existing character and equipment workspaces remain available. Modes share the artwork document, selection, camera, undo history and animation controller. `Detailed Vector Editor` opens the existing vector editing tools.

## DRAW

Create Vector, Raster and nested Group layers. Import Art accepts SVG, PNG, WebP and JPEG; Reference imports a tracing guide only. Guides are never bound, meshed or exported. Native raster resources retain their original format until painted; a completed stroke creates an immutable PNG revision. Live strokes use a working canvas, without encoding on pointer movement.

Brush is smooth; Pencil uses integer pixels. Eraser, Fill, Picker, rectangle selection and lasso operate on the active unlocked raster layer. Painting and selection respect the inverse layer/group transform. Cut/Copy to New Layer preserves pixel placement; Cut is one undo operation. Rasterize Copy explicitly creates pixels from vector or mixed artwork while preserving the original.

Use the inspector for opacity, Move/Scale/Rotate and group parenting. Alt-drag or middle-drag pans; wheel zooms; Fit resets the camera. Changing painted bounds never changes document coordinates or pivots.

## RIG

Create an Empty Rig, Tree Rig, or a copy of an existing skeleton preset. Tree and arbitrary props use `custom_2d_v1` with their own template. New root parts bind rigidly by default. Layers and bones have independent hierarchies.

Select a bone to add children, edit its setup transform, length or parent, or move its pivot. Setup artwork is compensated when the skeleton changes. Delete rejects live dependencies; **Reassign and Delete Bone** explicitly redirects them. Conflicting animation tracks must be resolved first.

Bind to Bone / Rigid preserves setup placement. Use Group Binding / Unbind explicitly removes an independent child binding. A weighted group cannot contain independently bound descendants. Anatomical owner is independent of mesh weights and optional depth binding.

**Make Flexible** extracts alpha boundary components and holes, triangulates them, adds conforming interior vertices and computes normalized geodesic weights (up to four initial influences). Low/Medium/High controls density. One influence follows one bone; several bones are required to bend. Choose influences before recalculation when the automatic bone chain is unsuitable.

Edit Mesh moves vertices, Add Vertex splits a containing triangle, and Delete Selected Vertex retriangulates the neighborhood. Edit Weights supports Add/Subtract/Replace/Smooth, bone selection, numerical selected-vertex weights and a heatmap. Regenerate Mesh and Recalculate Weights are independent, undoable operations. Replacing manual edits requires confirmation. Switching to Rigid retains the previous mesh for Restore Flexible.

After painting outside an untouched automatic mesh, it expands automatically in the same undo transaction; manually painted weights are transferred. Manual topology stays intact. Uncovered pixels are pink in DRAW and produce a warning; explicitly regenerate to include them in deformation.

## ANIMATE

Create or duplicate clips, name them, edit duration/FPS/loop, and add/copy/paste/move/delete position/rotation/scale keys with easing. Auto Key starts off. Editing a built-in clip first makes a private copy. Clip compatibility uses an exact template for arbitrary rigs; character presets remain family-compatible.

Tree Idle Wind is an editable looping clip with phase-shifted branch and foliage chains. Rotation Starter uses unwrapped interpolation from 0° to 360°. Live Rig Preview keeps artwork and animation visible together and updates on painting, binding, mesh/weight edits and timeline seeks. Rig, Depth, Bones, Mesh, Weights, Pivots and Z-Order views expose evaluated geometry. Prop colors are stable per part; character anatomy uses the shared Animation X-Ray palette.

## Storage and exports

Portable JSON and desktop `project.json` use project v3. Legacy SVG records become vector content; only simple image wrappers become native raster. Former exported reference artwork becomes an art layer; tracing remains a guide. Each raster resource is serialized once, and current saves exclude unused history revisions. Undo/Redo retains its referenced revisions in memory.

Autosave uses atomic IndexedDB transactions and imports legacy localStorage sessions. A failed write reports an error and retains the previous successful snapshot. Small UI preferences stay in localStorage. Normal raster exports use evaluated Canvas2D textures and triangles. SVG supports embedded raster and clipped affine triangles. Hybrid part manifests are v3 and include source resources, document layers, bindings and meshes; SVG-only manifests retain v2.

Combat acceptance remains **Rig Colors → Depth → Skeleton → Normal → Accept** in both directions, using the shared Animation Review generator. Color diagnostics do not certify an animation or change its anatomy.

PSD/ORA, advanced filters, image-to-skeleton recognition and physics are outside this delivery.
