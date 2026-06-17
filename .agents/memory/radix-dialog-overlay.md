---
name: Radix Dialog overlay conflict
description: Rendering a focus-trapping element outside a Radix Dialog causes the dialog to close.
---

# Rule
Never render a focus-trapping overlay (e.g. a "loading" modal, portal, fixed inset-0 div) outside a Radix `Dialog` component while that dialog is open.

**Why:** Radix Dialog maintains a focus trap. When a new focus-capturing element renders outside the DialogContent portal, Radix detects a focus-outside event and fires `onOpenChange(false)`, closing the dialog immediately.

**How to apply:** Always inline progress views, sub-modals, and overlays *inside* `DialogContent`. Replace the settings form with a progress component via conditional rendering — do not layer a second portal on top.
