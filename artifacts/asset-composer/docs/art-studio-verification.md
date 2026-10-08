# Art Studio verification — 2026-10-08

Implementation guide: [Art Studio](art-studio.md). Combat acceptance:
[Animation X-Ray](animation-xray.md).

## Automated checks

Run from the repository root:

```powershell
pnpm --filter @workspace/asset-composer test:run --maxWorkers=2 --testTimeout=30000
pnpm --filter @workspace/asset-composer typecheck
pnpm --filter @workspace/asset-composer build
git diff --check
```

Result: **335 passed, 3 skipped; 57 test files passed, 1 skipped**.
Typecheck, production build and whitespace check passed. The build reports
Vite source-map warnings in existing UI primitives, redundant dynamic imports,
and a large application bundle. Tests use two workers and a 30-second timeout
because CPU-heavy geometry checks otherwise time out on this workstation.

New regressions cover native content resolution, legacy migration/reference
artwork, resource revisions, layer hierarchy/transforms, setup-space bindings,
alpha components/holes, normalized geodesic weights, mesh vertex editing,
history, IndexedDB large snapshots/failed writes, mixed character round-trip,
exact-template clip restoration, transformed mesh texture bounds and opacity.
Existing IK, depth, skinning, import, project and export tests also pass.

## Browser scenarios

Verified in the local app through its visible controls:

| Scenario | Observed result |
| --- | --- |
| Tree | Seven native PNG layers; custom 17-bone tree rig; editable Tree Idle Wind. Left branch and foliage made Flexible; mesh regenerated in the worker; manual weight and vertex edits retained. |
| Live painting | Stroke applied while preview played. A manual mesh stayed intact; uncovered pixels were marked pink instead of silently included or discarding manual data. |
| Persistence | Portable project saved and reopened with meshes and clips. Reloading the browser restored the Tree artwork, bindings and Tree Idle Wind from IndexedDB. |
| Tree export | ZIP downloaded, unpacked and its 58-frame PNG spritesheet visually inspected. |
| Wheel | Native SVG artwork, empty custom rig and editable Continuous Rotation using unwrapped 0° → 360° keys. Source remained unchanged while preview rotated. |
| History | Rasterize Copy, rectangle selection and Cut to New Layer; Undo/Redo across DRAW → ANIMATE → RIG restored the layer and source pixels together. |
| Mixed character | SVG head/face, native PNG limbs and hair weighted to two added bones. Saved project reopened with Mixed Hair Sway selected. Fabric and Pixi displayed the same setup and deformed pose; studio mesh view also inspected. |
| Other raster formats | WebP and JPEG imported as native raster layers. Saved resources retained `image/webp` and `image/jpeg` data, without SVG wrappers. |
| Combat review | Shared RIGHT/LEFT Normal, Rig Colors, Depth Colors and Skeleton sheets generated and visually inspected for sword and bow. Existing sword fixture is weaponless and uses the clip's virtual grip. |

The tree scenario starts with **Tree Example**, then performs actual rigging,
mesh/weight editing and painting. It does not claim that every branch was
manually painted from an empty canvas. Freehand lasso paths, every imported
legacy project combination, and the packaged Electron folder flow have not
all been manually exercised; their implementation should receive further
interactive coverage before a release. Manual mesh coverage warnings are
intentional and do not certify an animation's anatomy.

## Local evidence

Generated files are in the ignored repository directory `output/art-studio/`:

- `art-studio.png`: source mesh with animated weight heatmap.
- `tree-wheel.json`: reopenable tree and continuous-rotation wheel project.
- `tree-export.zip`, `tree-export/tree/tree.png`: downloaded 58-frame export.
- `mixed.json`, `mixed.svg`, `mixed-posed.svg`, `mixed.png`: native mixed fixture and shared-scene output.
- `mixed-fabric-pixi.png`, `mixed-studio.png`, `wheel-studio.png`: UI evidence.
- `formats.json`: saved WebP/JPEG native-resource import check.
- `sword-right.svg/png`, `sword-left.svg/png`, `sword-review.json`.
- `bow-xray-right.svg/png`, `bow-xray-left.svg/png`, `bow-xray-review.json`.

Reproduce the shared review sheets:

```powershell
$env:SWORD_REVIEW = 'E:/vectoreditor/output/art-studio/sword'
$env:BOW_REVIEW = 'E:/vectoreditor/output/art-studio/bow.svg'
$env:STUDIO_REVIEW = 'E:/vectoreditor/output/art-studio'
pnpm --filter @workspace/asset-composer test:run tests/twoHandedSword.test.ts tests/bowVisualReview.test.ts tests/mixedStudio.test.ts --testTimeout=30000
Remove-Item Env:SWORD_REVIEW, Env:BOW_REVIEW, Env:STUDIO_REVIEW
```

For Node-generated SVG sheets, render PNGs from the app directory:

```powershell
node scripts/render-animation-reviews.mjs ../../output/art-studio/sword-right.svg ../../output/art-studio/sword-left.svg ../../output/art-studio/bow-xray-right.svg ../../output/art-studio/bow-xray-left.svg
```

Browser Animation Review export produces SVG, PNG and JSON together. Large,
densely triangulated SVGs can take noticeably longer to rasterize than direct
Canvas2D frame exports. Long-running ordinary exports expose **Download export**
after completion so download remains available if browser user activation has
expired during frame processing.
