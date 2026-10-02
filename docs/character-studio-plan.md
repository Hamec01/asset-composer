# Character Studio: technical plan

## Product

A desktop-first RPG character workshop. Create a blank chibi, edit body parts,
add interchangeable face features and equipment, preview skeletal motion, and
export sprites at a chosen resolution. The viewport shows the actual character.
The quality target is a production tool; "AAA" is a target, not a release claim.

## Working model

1. Character: choose a body build and palette; inspect named body parts.
2. Drawing: edit the selected part or draw a new attached detail.
3. Equipment: import or author modular garments and weapons; equip by slot.
4. Animation: select a clip, scrub, play, edit poses and keys.
5. Export: PNG/WebP atlas, PNG sequence, SVG parts, runtime JSON.

Advanced state machines and rig maintenance are secondary tools, not the entry
point. Creature and prop templates are outside the initial character workflow.
The starter library contains only reviewed body assets; no legacy equipment.

## Data ownership

- Rig: named bones, hierarchy, rest transforms, anchors, facing policy.
- Body preset: art, dimensions, attachment offsets and drawing order per bone.
- Character: palette, proportions, pose overrides, explicit body replacements.
- Authored visual: bone binding, pivot, transform, layer, source and document ID.
  `bodyPartId` identifies a body replacement. Removing it restores the preset.
- Equipment: one item can contain several bone-bound parts (for example sleeves,
  chest, thighs and boots). A garment must follow every joint it spans.
- Drawing document: editable paths/layers plus references. Applying it updates
  the attached visual; the preview and export use the same evaluated scene.

User-authored drawings must never be discarded by legacy cleanup heuristics.
New projects start without imported assets or old demo equipment. Clearing the
workspace removes browser snapshots and the current project, not disk folders.

## Art contract

- Blank head, no baked eyes, mouth or hair. Underwear belongs to the base.
- One consistent silhouette and palette across all parts and body builds.
- Rounded overlap at elbows, wrists, knees and ankles. Internal cut edges have
  no dark outline. External contours remain continuous in the rest pose.
- Every part has an explicit bone, center, size and layer. Thumbnail artwork
  is assembled from the same parts, never an unrelated placeholder.
- Inspect rest pose and the full walk cycle at small and large sprite sizes.

## Rendering and motion

Keep `evaluateSkeleton` and `evaluateScene` authoritative. Canvas, animation
preview and export must consume the same matrices and visible parts. Replacing
one body piece suppresses only its original, not the whole body or other details.

Current starter bodies reuse the `humanoid_side_v1` binding family and existing
mirror contract, but have separate frontal walk/run clips. Legacy action clips
still need an art-directed pass. This is not complete directional support.
Before shipping front/back/three-quarter views, add a direction-aware rig and
view-specific artwork. Mirroring a front drawing does not create a side view.

## Delivery stages and acceptance

### Foundation (implemented in this revision)

Clean starter library; new segmented body art; direct part editing; explicit
body replacement; preserve authored attachments during normalization; workspace
navigation; larger drawing surface; explicit workspace reset.

### Character customization

Reviewed body builds, skin swatches, eye/mouth/nose/hair/scar presets with visual
thumbnails. Presets use consistent head anchors and can be edited as drawings.
Acceptance: ten distinct characters assembled without moving facial features.

### Equipment authoring

Create an item from drawn parts; assign each part to a bone; preview against the
body while drawing; mask underlying body per garment; save and reuse equipment.
Acceptance: change armor and weapon during walk without changing the animation.

### Rigging and animation

Reference image overlay, manual cuts with retained source, pivot placement,
bone assignment, constrained joint edits, IK, onion skin, contact-aware walk.
Acceptance: import, cut, bind and animate one character without external tools.

### Production release

Direction-aware rigs; export resolution and padding validation; atlas metadata;
round-trip project persistence; responsive layouts; keyboard accessibility;
visual regression coverage and performance budget for real project sizes.
Acceptance: rendered preview matches export at every frame, no seams or missing
parts, cancellation works, and saved projects reopen without lost artwork.

## Risks to resolve

The sprite editor currently uses simplified SVG extraction and path bounds.
Complex SVG transforms, clipping, arcs and embedded rasters need a normalized
import pipeline. Do not advertise arbitrary SVG editing until those cases have
round-trip coverage. Do not replace geometry/animation code without evidence;
add focused coverage for body overrides, persistence and exported frames first.
