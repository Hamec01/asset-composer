// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppearancePanel } from "../src/components/panels/AppearancePanel";
import { useStore } from "../src/store";
import { entityVisualRevision } from "../src/lib/entityVisualRevision";
import { animController } from "../src/core-v2/AnimationController";

let root: Root;
let host: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "biped_profile_base_v1", "Panel");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<AppearancePanel />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  animController.pause();
});
async function click(testId: string) {
  const button = host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
  expect(button).not.toBeNull();
  await act(async () => button.click());
}
async function feature(value: string) {
  await act(async () => {
    const select = host.querySelector<HTMLSelectElement>("select[aria-label='Часть лица']")!;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const active = () => useStore.getState().project.entities[0];
const pressed = (id: string) => host.querySelector(`[data-testid="${id}"]`)!.getAttribute("aria-pressed");

describe("appearance panel feedback", () => {
  it("updates the render revision immediately and toggles the selected eyes off", async () => {
    const before = entityVisualRevision(active());
    await click("appearance-eyes-iris_round");
    expect(pressed("appearance-eyes-iris_round")).toBe("true");
    expect(active().faceCustomization?.eyes.presetId).toBe("iris_round");
    expect(entityVisualRevision(active())).not.toBe(before);
    const selected = entityVisualRevision(active());
    await click("appearance-eyes-iris_round");
    expect(pressed("appearance-eyes-iris_round")).toBe("false");
    expect(active().faceCustomization?.eyes.visible).toBe(false);
    expect(entityVisualRevision(active())).not.toBe(selected);
  });
  it("toggles nose, lips and independent skin details without changing tabs", async () => {
    await feature("nose");
    await click("appearance-nose-rounded");
    expect(active().appearance?.nose).toBe("rounded");
    await click("appearance-nose-rounded");
    expect(active().appearance?.nose).toBe("none");
    await feature("mouth");
    await click("appearance-mouth-full_lips");
    expect(pressed("appearance-mouth-full_lips")).toBe("true");
    await click("appearance-mouth-full_lips");
    expect(active().faceCustomization?.mouth.visible).toBe(false);
    await feature("marks");
    await click("appearance-freckles-dense");
    await click("appearance-scar-claw");
    expect(active().appearance).toMatchObject({ freckles: true, freckleStyle: "dense", scar: "claw" });
    await click("appearance-scar-claw");
    expect(active().appearance).toMatchObject({ freckles: true, scar: "none" });
    await click("appearance-freckles-dense");
    expect(active().appearance?.freckles).toBe(false);
  });
});
