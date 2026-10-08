# Appearance library and blinking

The Appearance panel adds 32 presets: 10 hairstyles, 8 eyes, 7 noses and 7 mouths.
Use **Все / Вектор / Рисованные** to filter the library. Painted presets load native
PNG resources only when selected; the portable project embeds each resource once.
Original painted colors are retained. The painted nose has a light skin tone;
vector noses follow the existing contour/shadow treatment on any skin color.

In **Лицо → Глаза**, use **Открыть / Прикрыть / Закрыть глаза**, the opening slider,
or **Автоматическое моргание**. A manual adjustment disables automatic blinking.
Selecting eyes enables blinking for newly configured eyes. Existing projects
without blink settings retain their appearance. Blink time follows the current
clip, including paused seeking, repeated loops and frame exports. No wall clock
or random numbers affect exported frames. Rest pose without a clip stays open.
The first blink occurs at min(1100 ms, 60% of clip duration); later blinks use the
chosen interval. Closed/sleepy expression presets retain their authored expression.

Both vector and native PNG eyes hide the iris behind eyelid clipping; they do
not squash the source image. Native eyes retain stable visual IDs through open,
partial and closed frames so pooled previews can update on playback and pause.
Head transforms, rig geometry and IK are unaffected.

Verification: panel selection/undo, manual and automatic eyelids, native resource
round-trip and deduplication, deterministic clip sampling, UV preservation,
pixel alpha clipping and RIGHT/LEFT exports. Generate review artifacts explicitly:

```powershell
$env:APPEARANCE_REVIEW_OUTPUT='E:/vectoreditor/output/appearance'
pnpm --filter @workspace/asset-composer test:run tests/faceAnimation.test.ts --testTimeout=30000
```

The generator produces `painted-portrait.json`, `blink-review.svg` and
`blink-review.png` from the application's shared scene/export path. Normal tests
do not write artifacts. Source PNGs and generation prompts are in
`src/assets/appearance/README.md`.
