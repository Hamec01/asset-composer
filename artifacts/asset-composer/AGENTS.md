# Animation review

For every new or changed combat animation, follow the mandatory acceptance
workflow in `docs/animation-xray.md`: Rig Colors → Depth Review → Skeleton
Review → Normal Art Review → Accept, for both RIGHT and LEFT.

Use the shared `buildAnimationReview` generator. Provide both review sheets and
the diagnostic JSON as evidence. Passing geometry tests alone is insufficient.
Do not change rig anatomy inside the diagnostic presentation or infer expected
depth from screen coordinates. Keep anatomical L/R colors constant.

Run the relevant IK, depth and export regression tests, typecheck and build.
Review artifacts are generated on request; normal tests should not write them.
