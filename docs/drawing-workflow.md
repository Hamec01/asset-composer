# Drawing Character Parts

The drawing workspace supports a blank document for each anatomical body part.
Choose a part, then use the draw-from-scratch action. The document retains the
base part's dimensions, joint alignment and depth. A side-view entity visual
replaces that base part and follows its bone during animation.

Draw separate documents for the head, neck, chest, belly, pelvis, upper arms,
forearms, hands, thighs, calves and feet. The bone selector can reassign a drawing;
known body bones also update the replacement role, depth and local placement.
Pivot fields remain editable for fine joint alignment. This is rigid attachment,
not automatic image segmentation or mesh deformation.

## Tracing

PNG, JPEG and WebP images up to 10 MB can be loaded as a tracing reference.
References have visibility, opacity, centered zoom and X/Y offset controls.
They persist in the editor document and participate in document undo/redo.

`tracingAsset` is distinct from the older `referenceAsset`: the latter may be
actual imported artwork and must retain its existing export behavior. Tracing
references render only with `spriteEditorDocumentToSvg(doc, { preview: true })`.
Applying the drawing to a character and exporting use the default serialization,
which excludes tracing images entirely.

Existing project saving stores these document fields. There is no new automatic
project save or automatic rig inference. Layered Godot rig export remains a
separate feature from this drawing workflow.

## Update Ownership

Face-overlay selection is owned by the dedicated face synchronization effect.
The generic item/body selection effect must not clear it. Competing writers used
to alternate between `none` and `face-overlay`, causing maximum-update-depth
errors when creating or opening a face drawing.

## Traced Reference Example

`referenceChibi.ts` contains hand-authored vector contours for the supplied
1024 x 1536 chibi reference. This is a specific editable example, not an
automatic vectorization or segmentation system for arbitrary uploads.
Covered anatomy is reconstructed as bare skin and underwear. Hair, eyes,
scars, clothing and boots are not baked into the traced base parts.

The example has seventeen documents and seventeen rigid attachments. Each
document keeps the reference aligned to its original crop. Reference previews
are compressed to 512 x 768 JPEG to avoid duplicating a large raster seventeen
times in local project storage. Source files on disk are not modified.

Its custom template uses the same bone IDs and animation family, but retains
the reference joint positions with `appearance.projection = "authored"`.
Left/right still mirror the skeleton and swap near/far render order. Existing
profile characters keep their previous projection behavior.

Reference paths are normalized into zero-origin SVG canvases, while attachment
centers and scale retain their position in reference-image coordinates.
`authoringHint.preserveFrame` keeps a drawing's authored frame stable during
live edits, so painted bounds do not shift joints. Loading reference projects
also normalizes older example frames without changing saved drawing paths.

`scripts/export-reference-parts.mjs` extracts standalone SVGs, attachment
metadata, an assembled SVG preview and an exploded parts sheet from a saved
example project. This metadata is not a Godot scene or a Godot animation importer.
