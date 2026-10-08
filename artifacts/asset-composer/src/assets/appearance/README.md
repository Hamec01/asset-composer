# Painted appearance sources

Generated with the built-in `image_gen` tool on 2026-10-08. Original transparent PNG outputs were copied unchanged into this directory. No PNG-in-SVG intermediate is used by the appearance model.

## Prompt set

Shared style/production brief (normalized):

Use case: stylized-concept. Asset type: isolated hand-painted chibi game appearance sprite. Soft painterly fantasy-game rendering, detailed brush texture, gentle highlights and shadows. Transparent background with preserved alpha; no text, watermark, surrounding face or body. One isolated accessory centered on a square canvas, without a cropped silhouette.

### painted_bob.png

A chestnut brown softly wavy bob haircut, side swept layered fringe, charming short side locks.

### painted_curls.png

A deep dark auburn voluminous curly haircut, soft sculpted curls, asymmetrical side fringe.

### painted_braid.png

A honey golden braided haircut, smooth crown with soft side swept fringe and one long braid down the right side, a small dark leather tie.

### painted_eye.png

ONE isolated open eye, viewed straight on, soft almond shape, sapphire blue iris with tiny radial brush strokes, dark pupil, ivory sclera, small reflected light, delicate warm brown upper lash line, lower lash line subtle. No eyebrow, no skin, no face. Eye horizontally centered, full eye occupies x=150..875 and y=300..720 of square canvas.

### painted_lips.png

ONE isolated natural rose colored closed mouth, soft full lips, delicate cupid's bow, subtle shaded upper lip and gently lit lower lip, thin curved dark warm mouth seam, tasteful small hand-painted specular accents. No skin, no face, no nose. Lips horizontally centered, full mouth occupies x=170..855 and y=340..680 of square canvas.

### painted_nose.png

ONE tiny stylized chibi nose shading detail, frontal view, a delicate short warm sepia curved bridge shadow, soft rounded tip shadow, two tiny nostril accents, a subtle semi-transparent warm ivory highlight. It must be only delicate painted marks, shadows and translucent highlight on transparent background with NO solid skin-colored patch, so it can overlay any skin color. No face, no mouth, no eyes. Nose centered, detail occupies x=300..725 and y=200..825 of square canvas.

## Integration

All six images are 1254 × 1254 RGBA. `metadata.json` records source dimensions and alpha bounds for positioning. Rendering crops eyes via UV triangles; original image bytes stay intact. Painted colors are fixed. The generated nose contains a pale skin patch, so its preset is intended for light skin; it is not a universal skin-color overlay.

Workspace paths are relative to this folder: `painted_bob.png`, `painted_curls.png`, `painted_braid.png`, `painted_eye.png`, `painted_lips.png`, `painted_nose.png`.
