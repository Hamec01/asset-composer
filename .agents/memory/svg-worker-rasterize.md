---
name: SVG rasterization in Web Workers
description: createImageBitmap with SVG blobs is unreliable in Workers; pre-rasterize on main thread instead.
---

# Rule
Do not call `createImageBitmap(svgBlob)` inside a Web Worker. It throws "The source image could not be decoded" in some Chromium environments (including Playwright headless).

**Why:** The SVG image decoder in Worker contexts is stricter than in the main thread — missing xmlns, absent explicit width/height, or other quirks cause silent decode failures.

**How to apply:** Pre-rasterize all SVGs to PNG on the main thread using `Image` + `canvas.toBlob()` (or `renderSvgToBlob`). Send the resulting `ArrayBuffer`s in the worker job payload. In the worker, load them with `createImageBitmap(new Blob([pngBuffer], {type:'image/png'}))` which is always reliable.
