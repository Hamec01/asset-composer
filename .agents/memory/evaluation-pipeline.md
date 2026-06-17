---
name: EvaluatedScene pipeline
description: The canonical 3-step rendering pipeline all renderers must use. Do NOT re-implement FK traversal or palette application inline.
---

## Rule
All renderers (PixiJS, Fabric/canvas, export, thumbnails) consume `EvaluatedScene` from `src/lib/evaluationPipeline.ts`. No renderer reimplements FK traversal or palette substitution.

## Pipeline
```ts
const localPose = buildMultiClipPose(clips, activeClipId, upperClipId, lowerClipId, weight, timeMs, entity, items, itemAnimClips);
const skeleton  = evaluateSkeleton(template.bones, localPose);   // WorldBone in template units
const scene     = evaluateScene(entity, template, skeleton, items); // palette-applied SceneLayer[]
```

## Coordinate system
- `WorldBone.x/y` — template units, origin = (0,0) = template center
- Project to canvas: `canvasX = cx + wb.x * skelScale` where `skelScale = Math.min(w,h) / 220`
- Full-frame layers: `sprite.width = layer.naturalWidth * fittingScale` where `fittingScale = Math.min(w,h) / Math.max(frameW, frameH)`

## SceneLayer.boneId semantics
- `null` → full-frame overlay (today: all body + item SVGs)
- `string` → bone-local (Stage 3: per-bone body part SVGs with their own naturalWidth/Height)

## Key functions
- `evaluateRestSkeleton(bones)` — rest pose only (no animation); used by canvasEngine slot zones
- `projectBone(wb, cx, cy, skelScale)` → `{x, y, rotation}` canvas coords helper

**Why:** The old system had three independent FK traversals (PixiPreviewPanel inline, canvasEngine.computeWorldTransforms, export pipeline). They drifted and caused mismatches. Single pipeline = single source of truth.

**How to apply:** When adding a new renderer or export path, import and call these three functions. Never copy the FK loop or the palette substitution regex.
