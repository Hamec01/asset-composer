---
name: Export Worker clip scope
description: How clip selection propagates from ExportDialog → ExportWorkerJob → worker functions.
---

## Rule
selectedClipIds is optional on ExportWorkerJob. When absent or empty-array, all clips are used. ExportDialog passes it only when the user has deselected at least one clip.

## Data flow
1. ExportDialog: `effectiveClipIds = selectedClipIds ?? availableClips.map(c => c.id)`
2. ExportDialog passes to job: `selectedClipIds: effectiveClipIds.length < availableClips.length ? effectiveClipIds : undefined`
3. exportEntity(... , selectedClipIds?): filters `allClips.filter(c => !selectedClipIds?.length || selectedClipIds.includes(c.id))`
4. exportCombined(job, ...): reads `job.selectedClipIds` directly in both its entityClips loops

**Why:** Sending undefined (not an empty array) when all clips are selected means the worker doesn't need to change behavior for the common case.

**How to apply:** If adding new worker export paths, always filter clips using the same pattern: `(!selectedClipIds?.length || selectedClipIds.includes(c.id))`.
