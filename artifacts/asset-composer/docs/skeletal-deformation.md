# Skeletal deformation and attachments

The runtime implements its own 2D affine math and CPU linear blend skinning.
It does not embed or copy the Spine runtime. This is not a Spine JSON/Binary
importer, UV-textured GPU mesh renderer, or automatic texture-atlas packer.

## Data and evaluation

- Bones retain their full parent-composed affine matrices, including shear from
  rotated children under nonuniformly scaled parents.
- Rigid equipment continues through the existing bone → slot → item-part binding.
  A weapon's authored grip is its local origin; it is not deformed as clothing.
- `ItemPart.mesh` stores setup-space vertices, normalized bone influences,
  inverse-bind source matrices, triangle topology and vector contours.
  The formula is `p' = Σ w · currentWorld · inverse(bindWorld) · (p + deform)`.
- `inheritMeshWeights` interpolates parent-surface weights barycentrically;
  points outside the surface use the nearest parent vertex.
- Built-in unedited tunics use a triangulated torso surface derived from the
  selected body proportions. Chest, spine and pelvis share the surface instead
  of drawing three overlapping rigid rectangles. Sleeves remain articulated parts.
  Authored artwork and explicit fit overrides are not silently replaced.
- `AnimationClip.deform` interpolates setup-space vertex offsets by part ID.
- `AnimationClip.drawOrder` is a stepped ordering timeline. Empty lists restore
  setup order. Prefer `raise` keys (Spine-style relative keys): they lift only the
  listed bones, with their garments and held items, above another bone and leave
  every other layer in setup order. `onlyNear` limits a raise to the limb facing
  the viewer, because turning left swaps which limbs are near. Full `boneOrder` /
  `slotOrder` lists remain for older projects; they reorder everything, which is
  how the bow clip used to push the tunic over the trousers.
  The authored rule order controls overlap between raised bones while preserving
  each bone's skin/sleeve/item order. Both archery wrists stay visible; the far
  upper arm remains behind the torso.
- `AnimationClip.ik` holds two-bone IK constraints (Spine `IkConstraint`, Godot
  `TwoBoneIK`) solved at runtime against the evaluated skeleton: keyed effector
  targets in skeleton space, effector rotation, bend direction, mix over FK keys
  and optional stretch along the bones. The bow clip keys hand targets this way,
  so the hands meet the bow and string in both facings and for any body morph.
- `AnimationClip.inherit` is a per-clip bone inheritance table (Spine `Inherit`).
  `noScale` keeps the parent's position and orientation but drops its scale and
  shear. The bow clip stretches each arm segment along its own axis (IK stretch)
  with elbows and wrists set to `noScale`, so sleeves, hands and the bow keep
  their authored width without renderer corrections.
- `AnimationClip.attachments` is a stepped attachment timeline per body bone.
  `BonePart.attachments` holds named alternative drawings (e.g. the `grip`
  fist); `null` restores the setup drawing. Hand swaps are keyed in the clip,
  not inferred from bone height or the clip ID, so copied clips behave the same.
- `ItemPart.dynamicLine` describes the bowstring constraint: fixed endpoints,
  drawing-hand bone, contact/release times and a short settling interval.
  The built-in SVG drawing uses a viewBox-origin translation; line endpoints
  are expressed in that drawing's coordinates.

All these optional fields survive project schema parsing. Existing projects
without them retain the rigid-attachment path. Canonical legacy bow clips are
upgraded only when their keys match a known built-in revision; authored keys
are preserved. Renderers consume the same evaluated scene. Export renders every frame on the
main thread from that scene (`lib/exportFrames`) with one stable camera per
entity; the worker only packs and encodes. It previously reused rest-pose
rasters, so skinned garments, the string and hand swaps were frozen in exports. The editor uses
the animation controller clock rather than the throttled UI/store clock and
retains the latest pose when asynchronous SVG loading completes.
Pending dynamic artwork also drains to the final frame after a seek or pause,
without requiring another playback tick.

The current UI does not yet provide a mesh weight-painting editor or dedicated
draw-order/deform track editing. The data/runtime support is usable from project
JSON and by built-in assets. General imported clothes do not acquire weights
automatically; an importer must supply a parent surface and invoke weight transfer.

## Verified references

- [Spine JSON format](https://esotericsoftware.com/spine-json-format) and
  [binary format](https://esotericsoftware.com/spine-binary-format): bones, slots,
  skins, weighted vertices, deform and draw-order tracks.
- [VertexAttachment.cpp](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/spine-cpp/spine-cpp/src/spine/VertexAttachment.cpp):
  the relevant weighted calculation is `computeWorldVertices`, not a
  `MeshAttachment.cpp::computeWorldPositions` function.
- [Bone.cpp](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/spine-cpp/spine-cpp/src/spine/Bone.cpp) and
  [PointAttachment.cpp](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/spine-cpp/spine-cpp/src/spine/PointAttachment.cpp):
  world transforms and local attachment coordinates.
- [Runtime skins](https://esotericsoftware.com/spine-runtime-skins): composing
  skins does not by itself guarantee one draw call.
- [Spineboy JSON example](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/examples/spineboy/export/spineboy-pro.json).
- [Utah skinning paper](https://users.cs.utah.edu/~ladislav/kavan07skinning/kavan07skinning.pdf):
  LBS background and dual-quaternion alternative. The supplied university root
  URL did not identify a specific lecture.
- [DragonBonesJS](https://github.com/DragonBones/DragonBonesJS): armature/bone/slot/display model.
- [Godot 2D skeleton guide](https://docs.godotengine.org/en/stable/tutorials/animation/2d_skeletons.html)
  and [two-bone IK source](https://github.com/godotengine/godot/blob/4.3/scene/resources/2d/skeleton/skeleton_modification_2d_twoboneik.cpp).
- The suggested Pixi `src/core/mesh/MeshAndSkinShader.ts` path was not verified.
  See the actual [spine-pixi-v8 integration](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/spine-ts/spine-pixi-v8/src/Spine.ts)
  rather than assuming those shader attributes exist.

Verification covers inverse bind transforms, noScale inheritance, attachment keys, normalized weights, barycentric
transfer, parent shear, deform interpolation, ordering, string constraints,
bow wrist/foot geometry and asynchronous canvas reconciliation. Browser playback
is checked separately because static scene tests cannot detect renderer races.

## Side-view chibi body

`data/chibiSideBody.ts` draws the generated profile body. Each part is authored
in its bone's coordinates and its viewBox is its exact bounding box, so sex,
muscle, fat and slimness change the silhouette itself (the renderer fits SVGs
with `meet`, which used to cancel width-only morphs). Limbs are ball joints: the
child's proximal cap sits inside the parent's distal cap and is left unstroked,
so bends show no seam or gap. Chest, belly and briefs are sliced from one trunk
profile and therefore share their outline across the waist overlap.
Visual review in the running editor: `await (await import("/tests/visual/reviewGrid.ts")).reviewGrid()`.
