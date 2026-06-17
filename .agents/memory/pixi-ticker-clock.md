---
name: Pixi ticker animation clock
description: How to advance animation time inside PixiPreviewPanel without triggering React re-renders every frame.
---

## Rule
Track animation time in a `useRef<number>` (`localTimeRef`) inside the Pixi ticker.  
Never call `store.setPlaybackTime()` every frame — it triggers 60 React re-renders/sec and freezes the UI.

## Pattern
```ts
// refs declared in component body
const localTimeRef = useRef(0);
const lastSyncRef  = useRef(0);

// inside app.ticker.add(...)
if (playing && activeClipId) {
  localTimeRef.current += app.ticker.deltaMS;
  if (looping) localTimeRef.current %= clip.durationMs;
  else localTimeRef.current = Math.min(localTimeRef.current, clip.durationMs);

  // sync to store at ~12fps for timeline scrubber
  const now = performance.now();
  if (now - lastSyncRef.current > 80) {
    store.setPlaybackTime(localTimeRef.current);
    lastSyncRef.current = now;
  }
  renderTime = localTimeRef.current;
} else {
  // paused — mirror store so scrubbing drives the preview
  localTimeRef.current = timeMs;
  renderTime = timeMs;
}
```

**Why:** Pixi ticker runs at 60fps. Zustand `set()` flushes React's scheduler synchronously, causing 60 component re-renders/sec → jank and apparent freeze.

**How to apply:** Every time a Pixi ticker needs to advance or consume animation time, use `localTimeRef`; use `renderTime` (not `timeMs` from store) for all pose evaluations inside the ticker.
