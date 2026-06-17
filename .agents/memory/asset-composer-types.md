---
name: Asset Composer domain type conventions
description: Key field names and scale math for the entity/template domain model.
---

# Domain type conventions

- `SvgLayer` uses `zOffset: number` (not zIndex)
- `SlotDef` uses `zIndex: number`
- `ExportProfile.frameSizeKey` is a string like `"64"` (parse with `parseInt`)

# FK / scene scale math
- `scale = frameSz / 220` — converts bone positions (scene units) to canvas pixels
- `fittingScale = frameSz / Math.max(template.previewWidth, template.previewHeight)` — for base body layers
- `cx = cy = frameSz / 2` — canvas origin is center
- Item raw size: 56 scene units → `drawSz = 56 * scale` px on canvas
- Base layers use `fittingScale`; slot items use `scale`

# Export profiles
Built-in preset IDs: `game_ready_64`, `hires_256`, `svg_source_pack`
(Note: `hires_256` not `hires_sprite_256`)

# Animation
- `project.animationClips` = `PRESET_ANIMATIONS` from `presetAnimations.ts`
- `resolveClipPose(clip, timeMs)` returns a `BoneTransformMap`
