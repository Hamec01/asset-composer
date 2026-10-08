# Equipment depth and grip occlusion

The equipment layer is independent of the wrist that carries it. In Timeline,
expand **Equipment Depth**, choose the equipped slot (or one part), seek a frame,
choose a semantic depth layer, and press **Set depth key**. Keys are stepped;
optional direction-specific keys override shared keys at the same time. A part
track overrides its slot track. **Setup / inherited** restores the existing
part binding or wrist depth. Click a key to seek/edit; × removes it. Changes use
project Undo/Redo. Editing a built-in animation creates an editable copy while
preserving playback time, looping and playing state.

**Hands cover grip** uses the actual alpha silhouettes of the anatomical hand
visuals. This lets a single rigid sword cover the side of the head while both
palms remain visible on its handle. Equipment is never used as its own occluder.
Silhouette holes and custom hand artwork are preserved. Canvas, Pixi, frame
exports and SVG review sheets consume the same evaluated masks. The texture
cache includes relative mask transforms and resource revisions; moving the
entire rigid grip does not invalidate its texture.

Data: `AnimationClip.equipmentDepth` stores slot/optional part tracks with
`timeMs`, optional `facing`, `slot` (or null), and `occludedByBones`. Parts can
also supply setup `occludedByBones` alongside their existing `depthBinding`.
Review JSON includes the actual occluder IDs, bones and matrices. Projects
without these optional fields retain their existing behavior.

Depth keys control visibility. They do not simulate volume, prevent geometric
collisions, or alter pose, joints, IK, grips or the item's rigid transform.
Animations that genuinely intersect a body need trajectory or collision work
in addition to authored depth. Review Rig → Depth → Skeleton → Normal in both
directions before accepting a combat animation.

## Greatsword verification

The saved greatsword example uses EQUIPMENT_FRONT from 0 ms in both directions,
with hand_l and hand_r as grip occluders. Both Guard (0 ms) and Recover (1600 ms)
show an uninterrupted blade over the side of the head. Windup, Apex, Contact,
and Follow-through were reviewed with the shared Animation Review generator.
The original bones, handle socket distances, IK and equipment matrices are
unchanged. The bow's existing per-part depth bindings were also reviewed.

UI checks: create the equipment copy, save and restore it, play and pause,
switch RIGHT/LEFT, seek exact Recover, add a FAR_BACK key and undo it, and
compare Fabric with Pixi. Automated checks cover stepped/reset/facing/part
resolution, JSON round-trip, unchanged skeleton/rigid matrices, alpha holes,
SVG mask scoping, Canvas compositing and relative-transform caching.

Opt-in review generation:

```powershell
$env:EQUIPMENT_REVIEW_PROJECT='E:\vectoreditor\output\greatsword\greatsword-depth.json'
$env:EQUIPMENT_REVIEW_OUTPUT='E:\vectoreditor\output\greatsword\depth-review'
pnpm --filter @workspace/asset-composer test:run tests/equipmentDepth.test.ts --testTimeout=30000
```
