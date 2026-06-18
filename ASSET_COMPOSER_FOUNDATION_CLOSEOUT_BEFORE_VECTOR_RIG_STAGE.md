# Asset Composer — Remaining Work Before Vector Editor / Rig Editor / Directional RPG Stage

**Repository:** `https://github.com/Hamec01/asset-composer`  
**Local workspace:** `E:\vectoreditor`  
**Main application:** `artifacts/asset-composer`  
**Document purpose:** close the current Runtime V2 / authoring foundation before starting the next major stage  
**Next major stage after this document:** built-in Vector Editor + Skeleton/Rig Editor + RPG Side/Directional families  

---

# 0. Why this document exists

The old T006–T014 plan has been partially completed, but not fully closed.

The application already has important working foundations:

- local Windows launch;
- `Select / Attachment / Slots` modes;
- V2 bone-local hair;
- V2 boots;
- V2 leather pants;
- V2 leather greaves;
- animation playback;
- project migration;
- Vitest tests;
- typecheck and build;
- Fabric canvas;
- Pixi preview;
- export pipeline;
- basic project save/load.

However, several critical authoring systems remain incomplete or only partially verified.

Do **not** begin the full Vector Editor, Rig Editor, Face Editor, custom skeleton creator, or RPG directional system until all blocking items in this document pass their acceptance criteria.

---

# 1. Scope gate

This milestone is called:

```text
FOUNDATION-CLOSEOUT
```

It closes the current character composition and Runtime V2 foundation.

The next stage is allowed to begin only after:

```text
[ ] Transform editing is fully undoable and redoable.
[ ] Inspector editing and Canvas editing use the same store actions.
[ ] Pivot and bounds math is canonical and tested.
[ ] V2 SVGs preserve aspect ratio.
[ ] Fabric, Pixi, Preview, and Export use identical evaluated matrices.
[ ] Save/load roundtrip preserves every V2 field.
[ ] Browser E2E smoke tests pass.
[ ] Windows desktop package smoke test passes.
[ ] One full vertical-slice character passes the complete workflow.
```

---

# 2. Current confirmed status

## 2.1 Completed or functionally working

### Canvas modes

```text
Select
Attachment
Slots
```

Status:

```text
WORKING
```

### V2 items

Confirmed working or implemented:

```text
hair
boots_leather
pants_leather
greave_leather
```

These use bone-local parts instead of a monolithic full-frame overlay.

### Animation

Confirmed:

```text
animation clock works
hair follows head
boots follow feet
greaves follow legs
multi-bone items can animate
```

### Runtime migration

Confirmed:

```text
legacy built-in item definitions can be refreshed to canonical V2 items
older embedded project items can be upgraded
```

### Tests

Confirmed:

```text
Vitest exists
test:run exists
typecheck passes
build passes
```

---

# 3. Remaining critical work

The remaining work is grouped into eight closure tasks.

```text
F001 — Transform history and global shortcuts
F002 — Complete selection-aware Inspector
F003 — Canonical pivot / bounds / aspect-ratio math
F004 — Anchor and ItemFitProfile completion
F005 — Persistent Fabric authoring stability
F006 — Renderer parity: Fabric / Pixi / Preview / Export
F007 — Schema, migration, validation, roundtrip, autosave
F008 — E2E tests and Windows desktop smoke
```

Recommended execution order:

```text
F001
→ F002
→ F003
→ F004
→ F005
→ F006
→ F007
→ F008
```

---

# 4. F001 — Transform history and global shortcuts

## 4.1 Problem

Undo/Redo works for some discrete actions, such as equipping or removing an item.

It does not reliably work for:

```text
move
scale
rotate
template slot drag
attachment drag
attachment scale
attachment rotation
entity visual transforms
```

The common failure mode is:

```text
Fabric live preview updates the object/store
→ object:modified fires
→ history reads the already-updated value as "before"
→ before == after
→ Undo has nothing useful to restore
```

## 4.2 Required architecture

One completed gesture must produce exactly one history command.

```text
pointer down / transform start
→ capture before snapshot
→ live preview updates
→ pointer up / object:modified
→ compute after snapshot
→ commit one history command
```

### Snapshot type

```ts
interface TransformGestureSnapshot {
  kind:
    | "attachment"
    | "template-slot"
    | "entity-visual";
  entityId?: string;
  templateId?: string;
  slotId?: string;
  visualId?: string;
  before: LocalTransform | AttachmentOverride;
}
```

### CanvasEngine state

```ts
private activeTransformGesture:
  | TransformGestureSnapshot
  | null = null;
```

## 4.3 Separate preview and commit

Add or formalize two different paths:

```ts
previewAttachmentOverride(...)
commitAttachmentOverride(...)
```

```ts
previewTemplateSlotTransform(...)
commitTemplateSlotTransform(...)
```

```ts
previewEntityVisualTransform(...)
commitEntityVisualTransform(...)
```

### Preview rules

Preview:

- updates visible state;
- does not add history;
- does not clear redo on every pixel;
- does not update `updatedAt` every frame;
- is cancelable.

### Commit rules

Commit:

- receives explicit `before` and `after`;
- creates exactly one command;
- clears future history once;
- updates `project.updatedAt`;
- triggers re-evaluation;
- preserves selection.

## 4.4 Global shortcuts

Add one centralized shortcut hook.

Suggested path:

```text
src/features/shortcuts/useEditorShortcuts.ts
```

Attach once from:

```text
IDE.tsx
```

### Required shortcuts

```text
Ctrl+Z          Undo
Cmd+Z           Undo
Ctrl+X          Redo, only outside text-editing controls
Ctrl+Shift+Z    Redo
Ctrl+Y          Redo
Cmd+Shift+Z     Redo
```

### Input safety

Do not hijack `Ctrl+X` when focus is in:

```text
input
textarea
select
contenteditable
```

Inside text controls it must remain native Cut.

Ignore:

```ts
event.repeat
```

When an editor shortcut is handled:

```ts
event.preventDefault();
event.stopPropagation();
```

## 4.5 Toolbar

Update tooltips:

```text
Undo (Ctrl+Z)
Redo (Ctrl+X / Ctrl+Shift+Z / Ctrl+Y)
```

Toolbar buttons and keyboard shortcuts must call the same store actions.

## 4.6 Required tests

```ts
it("creates one history entry for one attachment move gesture");
it("creates one history entry for one attachment scale gesture");
it("creates one history entry for one attachment rotate gesture");
it("undoes and redoes attachment move");
it("undoes and redoes attachment scale");
it("undoes and redoes attachment rotation");
it("undoes all sibling item parts through one slot assignment override");
it("creates one history entry for one template slot drag");
it("does not create history entries during live preview");
it("clears redo only on a new committed command");
it("Ctrl+Z triggers Undo");
it("Ctrl+X triggers Redo outside inputs");
it("Ctrl+X remains native Cut inside inputs");
it("Ctrl+Shift+Z triggers Redo");
it("Ctrl+Y triggers Redo");
```

## 4.7 Manual acceptance

Test on:

```text
hair
boots_leather
pants_leather
greave_leather
```

For each:

```text
move
Ctrl+Z
Ctrl+X

scale
Ctrl+Z
Ctrl+X

rotate
Ctrl+Z
Ctrl+X
```

Also test one template slot drag.

## 4.8 Definition of Done

```text
[ ] One gesture = one history entry.
[ ] Undo restores exact previous transform.
[ ] Redo restores exact new transform.
[ ] Multi-part item moves as one logical attachment.
[ ] Ctrl+X does not break text editing.
[ ] Toolbar and shortcuts behave identically.
[ ] Tests pass.
[ ] Typecheck passes.
[ ] Build passes.
```

## 4.9 Commit

```text
F001: add transactional transform history and global shortcuts
```

---

# 5. F002 — Complete selection-aware Inspector

## 5.1 Problem

Inspector functionality is only partially connected to the new selection model.

It must use:

```ts
editor.selection
```

and show different controls for different selection types.

## 5.2 Required selection panels

### Entity

Show:

```text
Name
Entity Type
Template
Style Set
Species
Palette
Root Transform
Active Animation
State Machine
```

### Item Part

Show:

```text
Item
Part
Slot
Bone
Anchor
Offset X
Offset Y
Rotation
Scale X
Scale Y
Lock Aspect
Flip X
Flip Y
Z Offset
Reset Position
Reset Rotation
Reset Scale
Reset All
Remove from Character
Edit Source Asset
```

### Equipped Item

Show:

```text
Item
Slot
Shared Attachment Override
Palette Override
Remove from Character
Edit Default Fit
```

### Template Slot

Show:

```text
Template
Slot
Bone
Default X
Default Y
Rotation
Scale X
Scale Y
Anchor
Z Index
Allowed Categories
Reset
```

### Entity Visual

Show:

```text
Bone
Pivot
X
Y
Rotation
Scale X
Scale Y
Z Index
Edit Source
Detach Source
```

### Bone

Show:

```text
Bone ID
Name
Parent
Rest TX
Rest TY
Rest Rotation
Rest Scale X
Rest Scale Y
Length
Assigned Parts
```

### Anchor

Show:

```text
Anchor ID
Bone
Offset X
Offset Y
Rotation
Usage
```

## 5.3 One source of transform mutations

Inspector and Fabric Canvas must use the same store command path.

Do not create separate Inspector-only mutation logic.

Example:

```ts
setAttachmentOverride(...)
```

must be used by:

```text
Canvas drag
Inspector numeric edits
Reset buttons
Flip controls
```

## 5.4 Numeric input transaction behavior

Typing `1.25` must not create four history entries.

Use:

```text
focus → capture before
typing → local draft
blur / Enter → one commit
Esc → cancel
```

Arrow keys:

```text
ArrowUp / ArrowDown
Shift = larger step
Alt = smaller step
```

## 5.5 Required tests

```ts
it("shows item-part inspector for item-part selection");
it("shows template-slot inspector for template-slot selection");
it("shows entity-visual inspector for entity-visual selection");
it("commits one history entry after numeric edit");
it("Esc cancels numeric edit");
it("Reset Scale restores 1,1");
it("Flip X toggles sign without losing Y scale");
it("Remove from Character clears the slot assignment");
```

## 5.6 Definition of Done

```text
[ ] Inspector changes the same domain data as Canvas.
[ ] Numeric edits update Canvas immediately.
[ ] Undo/Redo works for Inspector changes.
[ ] Selection changes update the correct panel.
[ ] No `as any` for transform patches.
[ ] Save/load preserves edited values.
```

## 5.7 Commit

```text
F002: complete selection-aware transform inspector
```

---

# 6. F003 — Canonical pivot, bounds, and aspect-ratio math

## 6.1 Problem

Before creating a full Vector Editor, the geometry contract must be stable.

Open issues:

```text
pivot mapping
non-zero SVG viewBox origin
actual content bounds
negative scale
non-uniform scale
aspect-ratio preservation
legacy full-frame separation
```

## 6.2 Canonical local transform

Required contract:

```text
x/y = parent-space position of the local pivot
```

Matrix:

```text
T(x, y)
× R(rotation)
× S(scaleX, scaleY)
× T(-pivotX, -pivotY)
```

Required test:

```ts
const m = localTransformToMatrix(
  100,
  200,
  30,
  2,
  3,
  10,
  20,
);

expect(transformPoint(m, 10, 20))
  .toEqualCloseTo({ x: 100, y: 200 });
```

## 6.3 Content bounds

Use:

```text
visualMinX
visualMinY
visualWidth
visualHeight
```

Bounds:

```text
minX = visualMinX - pivotX
minY = visualMinY - pivotY
maxX = visualMinX - pivotX + visualWidth
maxY = visualMinY - pivotY + visualHeight
```

Transform all four corners through the world matrix.

Do not assume symmetric bounds around `(0,0)`.

## 6.4 Aspect ratio

Split current generic SVG path into two explicit paths:

```text
legacy full-frame
V2 vector asset
```

### Legacy

May continue using full-frame fitting temporarily.

### V2

Must:

```text
preserve original viewBox
preserve aspect ratio
use world matrix for size
never inject preserveAspectRatio="none"
```

## 6.5 Import metrics

Importer must preserve:

```text
viewBoxX
viewBoxY
viewBoxWidth
viewBoxHeight
visualMinX
visualMinY
visualWidth
visualHeight
pivot
```

## 6.6 Required tests

```ts
it("maps pivot to x/y");
it("supports rotation");
it("supports non-uniform scale");
it("supports negative scale");
it("supports non-zero viewBox origin");
it("transforms four content-bound corners");
it("does not distort V2 SVG aspect ratio");
it("keeps legacy full-frame behavior isolated");
```

## 6.7 Definition of Done

```text
[ ] Pivot contract is documented and tested.
[ ] V2 visuals preserve aspect ratio.
[ ] Fit Scene uses true content bounds.
[ ] Imported offsets do not shift assets unexpectedly.
[ ] Fabric/Pixi/Export use the same geometry.
```

## 6.8 Commit

```text
F003: finalize vector pivot bounds and aspect ratio math
```

---

# 7. F004 — Anchor and ItemFitProfile completion

## 7.1 Anchor resolution

Required resolution order:

```text
1. SlotAssignment.attachmentOverride.anchorId
2. Item anchor rule for the slot
3. SlotDef.defaultAnchorId
4. identity
```

## 7.2 Multi-bone item rule

A shared slot anchor must not force every item part onto one bone.

For multi-bone items:

```text
ItemPart.boneId remains authoritative
```

Examples:

```text
boot_l → foot_l
boot_r → foot_r

greave_thigh_l → hip_l
greave_shin_l → knee_l
```

## 7.3 Anchor transform

Anchor must use:

```text
boneWorldMatrix × anchorLocalMatrix
```

Not:

```text
bone.x + offsetX
bone.y + offsetY
```

## 7.4 ItemFitProfile

Finish structured storage.

Recommended:

```ts
interface ItemFitProfile {
  id: string;
  templateId?: string;
  skeletonFamily?: string;
  slotId: string;
  partTransforms: Record<string, LocalTransform>;
  anchorOverrides?: Record<string, string>;
}
```

Resolution:

```text
entity attachment override
→ exact template fit profile
→ skeleton family fit profile
→ ItemPart.localTransform
```

## 7.5 Inspector UI

Add:

```text
Edit Default Fit
Save Fit For This Template
Save Fit For Skeleton Family
Reset To Item Default
```

## 7.6 Required tests

```ts
it("resolves assignment anchor before item anchor rule");
it("resolves item anchor before slot default");
it("preserves item part bone for multi-bone items");
it("applies exact-template fit profile");
it("falls back to skeleton-family fit profile");
it("falls back to item part local transform");
```

## 7.7 Definition of Done

```text
[ ] Hair anchor works.
[ ] Multi-bone items keep their individual bones.
[ ] Fit profiles save/load.
[ ] Inspector can edit default fit.
[ ] Fabric/Pixi/Export match.
```

## 7.8 Commit

```text
F004: complete anchor and item fit profile resolution
```

---

# 8. F005 — Persistent Fabric authoring stability

## 8.1 Problem

Fabric objects must remain persistent during animation and editing.

No full rebuild on every animation frame.

## 8.2 Required registries

```text
visualId → Fabric visual
slotId → Fabric slot gizmo
anchorId → Fabric anchor gizmo
boneId → Fabric bone gizmo
```

## 8.3 Reconciliation rules

`reconcileSceneStructure()`:

```text
create missing
remove stale
update changed SVG only when source changes
preserve active selection
preserve object identity
```

`updateSceneTransforms()`:

```text
update matrix
update z-order
update visibility
do not decode SVG
do not clear canvas
```

## 8.4 Editing session rules

While transforming:

```text
animation may pause or authoring pose freezes
selected object identity remains stable
scene reconciliation does not replace the object
```

## 8.5 Hit-testing priority

```text
active transform controls
selected visual
other item parts
anchor
slot
bone
background
```

## 8.6 Debug invariant

Behind a disabled flag:

```ts
DEBUG_CANVAS_INVARIANTS = false;
```

Validate:

```text
no stale visual IDs
no missing visual IDs
no duplicate object IDs
selection refers to an existing object
```

## 8.7 Required tests

```ts
it("reuses Fabric object identity between animation ticks");
it("removes stale Fabric objects");
it("keeps selection when visual ID remains");
it("does not reload SVG during transform-only updates");
it("does not allow slot gizmo to steal selected item control");
```

## 8.8 Definition of Done

```text
[ ] Drag does not break mid-gesture.
[ ] Animation tick does not reset selection.
[ ] No static duplicate remains after item replacement.
[ ] No SVG decode per frame.
[ ] No canvas.clear() per frame.
```

## 8.9 Commit

```text
F005: stabilize persistent Fabric authoring adapter
```

---

# 9. F006 — Renderer parity

## 9.1 Goal

All renderers consume:

```text
EvaluatedScene.visuals
```

and the final:

```text
EvaluatedVisual.worldMatrix
```

Renderers must not independently recompute:

```text
bone
slot
anchor
pivot
item scale
attachment offset
```

## 9.2 Required consumers

```text
Fabric Canvas
Pixi Preview
Frame Preview
Export Worker
SVG Part Export
```

## 9.3 Adapter contract

Each adapter receives:

```ts
interface EvaluatedVisual {
  id: string;
  svgData: string;
  worldMatrix: Matrix2D;
  localBounds: AABB;
  worldBounds: AABB;
  zIndex: number;
  sourceKind?: VisualSourceKind;
  boneId?: string;
  slotId?: string;
  itemId?: string;
  partId?: string;
}
```

## 9.4 Visual parity tests

Use:

```text
hair
boots_leather
pants_leather
greave_leather
```

Compare:

```text
a
b
c
d
tx
ty
zIndex
localBounds
```

## 9.5 Export checks

For Run:

```text
frame 0 hash != frame 1 hash
```

Also compare item-part matrices between frames.

## 9.6 SVG part export

V2 SVG export must use:

```text
Template.boneParts
Entity.visuals
Item.parts
pivots
anchors
manifest
```

Not only:

```text
baseBodyLayers
svgLayers[0]
```

## 9.7 Definition of Done

```text
[ ] Canvas matches Pixi.
[ ] Canvas matches Export Preview.
[ ] Exported PNG matches Preview.
[ ] Hair/boots/pants/greaves match in all renderers.
[ ] Animated frames differ when animation moves.
[ ] SVG part pack contains V2 parts and metadata.
```

## 9.8 Commit

```text
F006: unify Fabric Pixi preview and export rendering
```

---

# 10. F007 — Schema, migration, validation, roundtrip, autosave

## 10.1 Schema completion

Ensure schema covers:

```text
LocalTransform
VectorAssetMetrics
Pivot
EntityVisual
ItemPart
coordinateMode
ItemFitProfile
SlotDef.defaultTransform
Template.anchors
Template.boneParts
Evaluated metadata as needed
```

## 10.2 Migration order

```text
JSON.parse
→ detect version
→ migrate
→ schema validate
→ cross-reference validate
→ load
```

Do not validate old raw JSON against a new strict schema before migration.

## 10.3 Cross-reference validation

Validate:

```text
Entity.templateId
SlotAssignment.slotId
SlotAssignment.itemId
ItemPart.boneId
BonePart.boneId
Anchor.boneId
Slot defaultAnchorId
Animation track bone IDs
State machine clip IDs
unique IDs
```

## 10.4 Roundtrip

Required:

```text
save A
→ load A
→ save B
→ normalized deep compare A/B
```

Must preserve:

```text
templates
boneParts
entity visuals
item parts
metrics
pivot
anchors
fit profiles
attachment overrides
slot transforms
animation clips
state machines
```

## 10.5 Autosave

Browser:

```text
IndexedDB
```

Electron:

```text
atomic temp file
rename temp → target
recovery prompt
```

## 10.6 Dirty state

Show:

```text
Saved
Unsaved Changes
Autosaving
Autosave Failed
Recovered Session
```

## 10.7 Required tests

```ts
it("migrates v1 project to latest schema");
it("round-trips V2 project without field loss");
it("preserves custom templates");
it("preserves slot transforms");
it("preserves attachment overrides");
it("reports invalid item references");
it("reports invalid bone references");
it("recovers latest autosave");
```

## 10.8 Definition of Done

```text
[ ] No V2 field is silently dropped.
[ ] Old projects migrate.
[ ] Custom templates survive reopen.
[ ] Invalid projects produce readable errors.
[ ] Autosave recovery works.
```

## 10.9 Commit

```text
F007: complete V2 schema roundtrip validation and recovery
```

---

# 11. F008 — E2E tests and Windows desktop smoke

## 11.1 Playwright flow

Required browser workflow:

```text
1. Open app.
2. Create humanoid.
3. Equip hair.
4. Edit attachment.
5. Move.
6. Scale.
7. Rotate.
8. Undo.
9. Redo.
10. Play Run.
11. Verify hair follows head.
12. Equip boots.
13. Equip greaves.
14. Verify animated legs.
15. Save.
16. Reload.
17. Verify transforms.
18. Open Pixi Preview.
19. Export Run PNG.
20. Verify output exists.
```

## 11.2 Additional E2E

```text
template slot edit
Inspector numeric edit
remove item
old project migration
invalid project error
autosave recovery
```

## 11.3 Desktop package

Run:

```powershell
corepack pnpm --filter @workspace/asset-composer package:win
```

Confirm:

```text
installer .exe
or portable .exe
```

Test on a clean Windows user profile:

```text
launch
create project
save project
reopen project
export PNG
close
recover autosave
```

## 11.4 CI

Add at least:

```text
Windows
Ubuntu
```

Jobs:

```text
install
test
typecheck
build
```

Desktop packaging may run only on tagged/release builds.

## 11.5 Definition of Done

```text
[ ] Playwright full workflow passes.
[ ] Windows package exists.
[ ] Packaged app launches.
[ ] Save/open/export works in packaged app.
[ ] CI is green.
```

## 11.6 Commit

```text
F008: add authoring E2E tests and Windows desktop smoke
```

---

# 12. Final vertical-slice test

Before the next stage, one character must pass:

```text
Create
→ Equip Hair
→ Equip Boots
→ Equip Greaves
→ Select
→ Move
→ Scale
→ Rotate
→ Undo
→ Redo
→ Play Run
→ Switch Preview
→ Save
→ Reload
→ Export
```

## Required result

```text
[ ] Hair remains on head.
[ ] Boots remain on feet.
[ ] Greaves remain on legs.
[ ] No static duplicates.
[ ] No full-frame legacy overlay.
[ ] Move/scale/rotate persist.
[ ] Undo/Redo restores exact transforms.
[ ] Canvas and Pixi match.
[ ] Export matches Preview.
[ ] Save/load preserves everything.
```

---

# 13. What is explicitly NOT part of this closeout

Do not begin these until FOUNDATION-CLOSEOUT is complete:

```text
Full Vector Editor
Pen Tool
Node Tool
Boolean Operations
Layer System
Reference Overlay
Body Part Cutting
Rig Editor
Custom Skeleton Creator
Face Editor
RPG Profile Mode
RPG 8-Directional Mode
Dragon Skeleton
Snake Skeleton
Centaur Skeleton
Custom Creature Rig
Directional Equipment Variants
Unity/Godot export adapters
```

These belong to the next major stage.

---

# 14. Next major stage after closeout

The next stage begins with:

```text
VECTOR-RIG-DIRECTIONAL-FOUNDATION
```

Its first tasks will be:

```text
N001 — Vector document data model
N002 — Sprite Studio shell
N003 — Layers and reference image
N004 — Select / Node / Pen tools
N005 — Skeleton family registry
N006 — Rig editor
N007 — RPG Profile family
N008 — RPG Directional family
N009 — Directional item variants
N010 — Face component system
```

But none of these should begin before F001–F008 are complete.

---

# 15. Codex execution protocol

For every task:

1. Work only in:

```text
E:\vectoreditor
```

2. Verify:

```powershell
Get-Location
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git remote -v
git status --short
```

3. Execute one task only.
4. Add regression tests.
5. Run:

```powershell
corepack pnpm --filter @workspace/asset-composer run test:run
corepack pnpm --filter @workspace/asset-composer run typecheck
corepack pnpm --filter @workspace/asset-composer run build
git diff --check
```

6. Manually verify the affected UI.
7. Commit separately.
8. Push to `main`.
9. Stop and report.
10. Do not automatically start the next task.

---

# 16. Required report format

```text
TASK:
F00X — title

WORKSPACE:
E:\vectoreditor

COMMIT BEFORE:
...

ROOT CAUSE:
...

FILES CHANGED:
...

IMPLEMENTATION:
...

TESTS ADDED:
...

MANUAL CHECK:
...

UNDO:
pass/fail/not applicable

REDO:
pass/fail/not applicable

CANVAS:
pass/fail

PIXI:
pass/fail/not applicable

EXPORT:
pass/fail/not applicable

SAVE/LOAD:
pass/fail/not applicable

TESTS:
pass/fail

TYPECHECK:
pass/fail

BUILD:
pass/fail

COMMIT:
...

PUSH:
done/not done

NEXT TASK:
...
```

---

# 17. Final closeout checklist

```text
[ ] F001 Transform history and shortcuts
[ ] F002 Selection-aware Inspector
[ ] F003 Pivot / bounds / aspect-ratio math
[ ] F004 Anchors and ItemFitProfile
[ ] F005 Persistent Fabric stability
[ ] F006 Renderer parity
[ ] F007 Schema / migration / roundtrip / autosave
[ ] F008 E2E / Windows desktop smoke

[ ] Full vertical-slice character passes
[ ] No known blocker remains in current Runtime V2 foundation
[ ] Ready to begin Vector Editor / Rig Editor / Directional RPG architecture
```

---

# 18. First task to execute now

Begin only with:

```text
F001 — Transform history and global shortcuts
```

Do not start F002 automatically.

Required first user-visible result:

```text
change hair scale
→ Ctrl+Z restores old scale
→ Ctrl+X restores new scale
```

Repeat for:

```text
move
rotate
template slot drag
boots
greaves
```
