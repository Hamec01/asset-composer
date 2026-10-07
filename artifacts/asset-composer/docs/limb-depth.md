# 2.5D Segment Depth

## Pipeline

Animation pose → FK/IK → evaluated skeleton → scene visuals → Depth Resolver → renderer.
The resolver changes only renderDepth metadata and zIndex. It never changes joints,
matrices, grip sockets, elbow poles, scales or IK targets. Canvas, preview and PNG
export share evaluateScene, so they receive the same resolved stack.

## Roles And Segments

The existing profile rig convention is RIGHT: near=l, far=r; LEFT: near=r, far=l.
Anatomical IDs do not change. resolveArmRoles swaps camera-facing roles on mirror.
Each shoulder, elbow and hand visual resolves independently as upperArm, forearm
or hand. Bound sleeves and equipment resolve through their actual bone binding.
Covered skin is not duplicated underneath clothing in the inspector.

Defaults keep all far segments behind the body and near segments in front.
The head covers upper arms/forearms, while HAND_FRONT can appear over the jaw.
Equipment authored behind a palm remains below the head; positive equipment
offsets can appear in EQUIPMENT_FRONT. Source attachment order is retained inside
each semantic segment. All final numeric ranks are assigned in limbDepth.ts.

Semantic slots: FAR_BACK, FAR_LIMB, BODY_BACK, BODY, CROSS_BODY, NEAR_LIMB,
BODY_FRONT, HAND_FRONT, EQUIPMENT_FRONT. BODY_FRONT covers the head/neck and
face features. Legacy draw-order rules still work outside semantic arm depth;
they cannot accidentally lift an entire far arm above the body.

## Clip Data

```json
{
  "limbDepth": [
    {"timeMs": 0, "state": {}},
    {"timeMs": 1140, "facing": "right", "state": {"farForearm": "CROSS_BODY", "farHand": "HAND_FRONT"}},
    {"timeMs": 1520, "facing": "right", "state": {}},
    {"timeMs": 1880, "state": {}}
  ]
}
```

Each key is a partial override of defaults, not a cumulative patch. Empty state
resets defaults. The last applicable key wins, using a stepped evaluation without
numeric interpolation or heuristics based on joint x/y. Optional facing filters
camera-specific crossings. The renderer contains no bow_shoot or frame-range test.

Bow regression: far upperArm always FAR_LIMB. Left-facing bow arm crosses at
160 ms. Right-facing drawing hand and forearm only cross together at full draw
(1140 ms); both return behind the body at 1520 ms. All crossings reset at 1880 ms.
Raising a far hand before its forearm creates a detached palm on the torso.
Canonical old clips upgrade these render rules without changing their IK/pose;
explicit authored limbDepth keys are preserved.

## Independent Attachment Depth

ItemPart.depthBinding separates the anatomical depth owner from the physical
bone binding. The bow string still moves with hand_l and deforms towards hand_r,
but its depth follows hand_r: BODY_BACK when far (right-facing), CROSS_BODY when
near (left-facing). Explicit bindings sort below limb segments in the same slot.
Thus the right string is covered by the torso, while the left string covers the
torso but remains under both active arms and hands. There is no facing-specific
bow ID branch in the renderer. Schema serialization preserves the binding.
Draw Order Inspector displays both Pose and Depth bones for these attachments.

## Debug

Debug → Depth Layers shows colored visual bounds and per-segment depth labels.
Blue: far, gray: body, yellow: cross, green: near, red: front hand.
Debug → Draw Order Inspector lists the actual evaluated, sorted visuals for the
current frame: attachment ID, anatomical binding, near/far role and semantic slot.
The list scrolls and includes clothing and weapon parts, not only skeleton bones.

## Verification

tests/limbDepth.test.ts checks role exchange on mirror, defaults, discrete keys,
stable phases, schema roundtrip/migration, all bow phases in both directions,
far shoulder and sleeve below the torso, far hand crossing, clothing/skin depth
agreement, unchanged joints and unchanged world matrices when depth changes.
Existing arm-engine/bow geometry tests remain in place.

Before/after evidence in the repository root's output directory:

- bow-anatomy-before.svg / bow-anatomy-after.svg: before/after pose sheets.
- bow-anatomy-before-after-right.png / bow-anatomy-before-after-left.png: draw and aim pairs.
- bow-anatomy-frames-right.png / bow-anatomy-frames-left.png: complete frame sequences.
- bow-anatomy-stack-right.json / bow-anatomy-stack-left.json: sorted stacks across ten poses.
- bow-live-inspector-transition-right.png: far hand and forearm below the torso during lift.
- bow-live-inspector-aim-left.png: mirrored roles and independent string depth in the live app.

## Mask Boundary

This pass implements segment occlusion through draw order, not per-pixel body
masks. renderDepth.occlusion records behindBody/none, leaving a clear hook for
a later renderer mask. A single segment that must be simultaneously behind and
in front of the torso still needs a split attachment or a body mask. Do not claim
the segment resolver already solves that separate case.
# Drawing-Arm Reach

The elbow rises along a rear arc; the wrist stays in front of that elbow rather
than being pulled behind the shoulder while the elbow remains low and forward.
The previous transition used bend=+1 throughout, making a low U-shaped arm even
though the full-draw key looked correct. Lift and recovery use bend=-1; the branch
changes at the fully folded pose (-6,-34), where both solutions coincide. Keys at
900 and 1060 ms preserve the arc instead of interpolating through the shoulder.
The drawing hand uses its side-anchored hook throughout the lift, not a hanging
top-anchored fist. Full draw is
(-6,-35), against the posed shoulder (-4,-34). Its elbow is (-18.991,-34.518):
the forearm is almost horizontal, rather than descending eight units. Recovery
also follows a lower arc, not the earlier route through the head.

The former hand artwork was top-anchored, with palm (.8,4.4), while the forearm
approaches the side of the hand. That mismatch remained even after IK was stable.
Archery hand artwork is now side-anchored; each named attachment owns its authored
viewBox and palm socket (5,0), scaled with the hand. `boneAttachmentAt` resolves
the drawing, frame and grip together before held equipment and string evaluation.
The active socket is shared by both renderers and export. Arrow art is not part
of the built-in bow; project loading refreshes unedited built-in equipment.

Tests check near-horizontal full-draw forearms, constant lengths and half-frame
motion, head clearance, SVG frame/socket resolution, string-to-palm coincidence,
mirror roles, schema roundtrip and saved-project migration. A valid IK target
alone is not an anatomical or visual acceptance test.

The live saved project was not equivalent to the reconstructed Node fixture:
browser math differed at sub-pixel precision, and one older built-in revision had
its aim target one unit lower. Exact JSON comparisons left that obsolete IK/depth
active. Migration compares numbers at 1e-8 precision and recognizes that specific
revision. tests/fixtures/bow-browser-v20.json is captured from the actual Debug
Animation data field; tests verify its IK, depth and attachments upgrade together,
while a meaningful authored IK change remains untouched.
