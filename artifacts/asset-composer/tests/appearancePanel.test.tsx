// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as paintedAppearance from "../src/data/paintedAppearance";
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
  vi.restoreAllMocks();
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
  it("controls eyelids manually and restores automatic blinking with undo",async()=>{
    await click("appearance-eyes-jewel_blue");
    expect(active().faceCustomization?.eyes.blink?.enabled).toBe(true);
    const button=(name:string)=>Array.from(host.querySelectorAll("button")).find(b=>b.textContent===name)!;
    await act(async()=>button("Закрыть глаза").click());
    expect(active().faceCustomization?.eyes.eyeOpenness).toBe(0);
    expect(active().faceCustomization?.eyes.blink?.enabled).toBe(false);
    await act(async()=>useStore.getState().undo());
    expect(active().faceCustomization?.eyes.eyeOpenness).toBe(1);
    await act(async()=>button("Прикрыть глаза").click());
    expect(active().faceCustomization?.eyes.eyeOpenness).toBe(.45);
    await act(async()=>host.querySelector<HTMLInputElement>('input[aria-label="Автоматическое моргание"]')!.click());
    expect(active().faceCustomization?.eyes).toMatchObject({eyeOpenness:1,blink:{enabled:true}});
  });
  it("chooses a portable painted asset in one undo step and clears it when choosing vector art",async()=>{
    vi.spyOn(paintedAppearance,"loadPaintedPreset").mockResolvedValue({id:"painted_test",name:"Eye",mimeType:"image/png",width:1,height:1,dataUri:"data:image/png;base64,iVBORw0KGgo="});
    const before=active().faceCustomization?.eyes;
    const count=useStore.getState().history.past.length;
    await act(async()=>Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="Все")!.click());
    await click("appearance-eyes-painted_eye");
    expect(active().faceCustomization?.eyes.content).toEqual({kind:"raster",assetId:"painted_test"});
    expect(useStore.getState().project.assets?.painted_test).toBeDefined();
    expect(useStore.getState().history.past).toHaveLength(count+1);
    await act(async()=>useStore.getState().undo());
    expect(active().faceCustomization?.eyes).toEqual(before);
    expect(useStore.getState().project.assets?.painted_test).toBeUndefined();
    await act(async()=>useStore.getState().redo());
    await click("appearance-eyes-jewel_hazel");
    expect(active().faceCustomization?.eyes.content).toBeUndefined();
    expect(active().faceCustomization?.eyes.presetId).toBe("jewel_hazel");
  });
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
  it("adds flat brows and controls mouth opening, motion and undo",async()=>{
    await feature("brows");await click("appearance-brows-gentle_taper");
    expect(active().faceCustomization?.brows.presetId).toBe("gentle_taper");
    await feature("mouth");await click("appearance-mouth-chibi_smile");
    const button=(name:string)=>Array.from(host.querySelectorAll("button")).find(b=>b.textContent===name)!;
    await act(async()=>button("Открыть рот").click());
    expect(active().faceCustomization?.mouth).toMatchObject({mouthOpenness:1,mouthMotion:{enabled:false}});
    await act(async()=>button("Закрыть рот").click());
    expect(active().faceCustomization?.mouth.mouthOpenness).toBe(0);
    await act(async()=>useStore.getState().undo());
    expect(active().faceCustomization?.mouth.mouthOpenness).toBe(1);
    await act(async()=>host.querySelector<HTMLInputElement>('input[aria-label="Анимация рта"]')!.click());
    expect(active().faceCustomization?.mouth.mouthMotion?.enabled).toBe(true);
    await act(async()=>button("Приоткрыть рот").click());
    expect(active().faceCustomization?.mouth).toMatchObject({mouthOpenness:.4,mouthMotion:{enabled:false}});
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
