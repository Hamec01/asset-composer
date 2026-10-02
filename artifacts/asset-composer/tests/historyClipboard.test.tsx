// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { useStore } from "../src/store";
import { useEditorShortcuts } from "../src/hooks/useEditorShortcuts";
import { animController } from "../src/core-v2/AnimationController";

function Shortcuts() { useEditorShortcuts(); return null; }

it("handles native Ctrl+X cut outside fields without overriding text cutting", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<Shortcuts />));
  try {
    const store = useStore.getState();
    store.newProject();
    store.createEntity("character", "biped_profile_base_v1", "Original");
    store.renameEntity(store.getActiveEntity()!.id, "Renamed");
    store.undo();
    const input = document.createElement("input");
    container.appendChild(input);
    const typingCut = new Event("cut", { bubbles: true, cancelable: true });
    await act(async () => input.dispatchEvent(typingCut));
    expect(typingCut.defaultPrevented).toBe(false);
    expect(useStore.getState().getActiveEntity()!.name).toBe("Original");
    const cut = new Event("cut", { bubbles: true, cancelable: true });
    await act(async () => document.body.dispatchEvent(cut));
    expect(cut.defaultPrevented).toBe(true);
    expect(useStore.getState().getActiveEntity()!.name).toBe("Renamed");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    animController.pause();
  }
});
