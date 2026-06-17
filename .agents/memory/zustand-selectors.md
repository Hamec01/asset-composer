---
name: Zustand selector pattern in this project
description: Always use individual selectors; object selectors cause infinite re-renders.
---

# Rule
Always select state values individually: `useStore(s => s.someValue)`. Never use object selectors or `zustand/react/shallow`.

**Why:** The project Zustand store is not configured with a shallow equality plugin. Object selectors create a new object reference on every render, causing infinite loops.
