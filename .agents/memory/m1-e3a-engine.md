---
name: M1-E3A engine architecture
description: Persistent FabricImage registry, scene-space coordinates, reconcile vs update split — asset-composer CanvasEngine v2.0
---

## Coordinate system (scene-space)
Objects are placed in **template units** (not screen pixels).
- Template origin (0,0) = entity centre
- Full-frame 128×128 entity → Fabric object at `left=0, top=0, originX=center, originY=center`
- Bone-local parts → `left=wb.x + localX, top=wb.y + localY`

## Viewport formula
```ts
setViewport(zoom, panX, panY) {
  const tx = cw/2 + panX;
  const ty = ch/2 + panY;
  canvas.setViewportTransform([zoom, 0, 0, zoom, tx, ty]);
}
```
- Template origin → screen (cw/2 + panX, ch/2 + panY)
- Zoom-to-cursor: `newPanX = pivotX - (pivotX - panX) * newZoom/zoom`  (pivotX relative to viewport centre — works unchanged vs old formula)

**Why:** Old formula was `tx = cw/2*(1-zoom) + panX` (objects in screen-space). New formula is simpler and correct for template-unit objects.

## Two-phase rendering pipeline
| Phase | Method | When called | Cost |
|-------|---------|-------------|------|
| Structure | `reconcileSceneStructure(scene, template, slotId)` | Entity change, palette change, slot change, visuals change | Async; calls FabricImage.fromURL for changed SVGs |
| Transform | `updateSceneTransforms(scene)` | animController tick (≈12fps) | Sync; only updates .left/.top/.angle/.scaleX/.scaleY |

**Why:** Calling FabricImage.fromURL on every animation tick causes canvas flicker and blocks the main thread. The two-phase split gives smooth 12fps animation with structure changes only on content edits.

## Persistent registry
- `fabricImages: Map<string, FabricImage>` — keyed by `visual.id`
- `svgCache: Map<string, string>` — keyed by `visual.id`, value = svgData
- On reconcile: removed IDs → `canvas.remove(img)` + delete from maps; changed svgData → remove old + load new
- SVGs loaded at `pixW × pixH = round(vW) × round(vH)` (localBounds size in template units), placed at worldMatrix-decomposed position

## isTransforming flag
Set to `true` on Fabric `object:moving`, cleared on `object:modified`.
- Blocks `updateSceneTransforms` during user drag (prevents jitter)
- Queues any pending `reconcileSceneStructure` call until drag ends

## Auto-fit camera (cameraDirty)
- CanvasPanel keeps `cameraDirtyRef = useRef(true)` 
- Set to `true` when `project.activeEntityId` changes (detected by ref comparison)
- After reconcile completes: if dirty → call `engine.fitScene(scene, template)` → apply viewport
- `fitScene` calls `computeSceneBounds + fitSceneToViewport` (12% padding)

## EntityVisual shape
```ts
interface EntityVisual {
  id, svgData, boneId, metrics, pivot, localTransform, zIndex
  // NO name, NO coordinateMode (those are on ItemPart)
}
```
`boneId = "root"` for full-vector imports; any bone ID for bone-part attachments.
`evaluateScene` emits `EvaluatedVisual` for each EntityVisual using `worldBoneToMatrix × localTransformToMatrix`.

## resolveTemplate
Always use `resolveTemplate(project, id)` (checks `project.templates` first, then built-in TEMPLATES) instead of `getTemplateById(id)` when a Project is in scope. This supports imported/custom templates.
