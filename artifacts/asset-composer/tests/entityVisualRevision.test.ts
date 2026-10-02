// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "../src/store";
import { entityVisualRevision } from "../src/lib/entityVisualRevision";
import { animController } from "../src/core-v2/AnimationController";

afterEach(() => animController.pause());
describe("visual revision", () => {
  it("invalidates both renderer textures for every appearance edit, not playback ticks", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Revision");
    const entity = useStore.getState().project.entities[0];
    const baseline = entityVisualRevision(entity);
    for (const update of [
      { appearance: { ...entity.appearance!, nose: "rounded" as const } },
      { faceCustomization: { ...entity.faceCustomization!, eyes: { ...entity.faceCustomization!.eyes, visible: true, presetId: "almond" } } },
      { bodyMorphs: { torsoWidth: 1.2 } },
      { poseOverrides: { head: { tx: 2, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 } } },
      { rootTransform: { x: 3, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
      { palette: { ...entity.palette, skin: "#c88a61" } },
      { slots: entity.slots.map((slot, index) => index ? slot : { ...slot, itemId: "new-item" }) },
      { visuals: [...entity.visuals, { id: "new-visual" }] },
    ]) expect(entityVisualRevision({ ...entity, ...update } as typeof entity)).not.toBe(baseline);
    expect(entityVisualRevision({ ...entity, updatedAt: 1234, activeAnimationClipId: "chibi_front__walk" })).toBe(baseline);
  });
});
