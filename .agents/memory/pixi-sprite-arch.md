---
name: PixiPreviewPanel sprite architecture
description: How base body and slot item sprites must be set up in PixiPreviewPanel.
---

## Rule
ALL sprites — base body layers AND slot item overlays — are **full-frame** overlays centred at `(w/2, h/2)`.  
Bone animation drives only the skeleton lines/dots Graphics overlay; it does NOT position individual sprites.

## SlotSprite shape for items
```ts
{
  key:         `slot_${slotId}_${itemId}`,
  svgData:     palettedSvg,
  boneId:      null,          // NOT bone-local
  zIndex:      slotDef.zIndex,
  rawW:        template.previewWidth,   // full frame, NOT 56
  rawH:        template.previewHeight,  // full frame, NOT 56
  isBaseLayer: true,          // centred path in ticker
  rasterSize:  256,
}
```

## Why
- Item SVGs have `viewBox="0 0 64 64"` covering the whole character body.
- Base body SVGs have `viewBox="0 0 128 128"`.
- Both are full-frame overlays; treating items as 56×56 bone-local caused cropped arms, missing head, and misaligned equipment.

## How to apply
Whenever adding a new sprite type to the pool, default to `isBaseLayer: true` / `boneId: null` unless the SVG is explicitly authored as a bone-local attachment (rare — not used in any current preset).
