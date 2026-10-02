// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { getCharacterBodyParts } from "../src/data/chibiBody";
import { evaluateRestSkeleton, evaluateScene } from "../src/lib/evaluationPipeline";
import { parseProjectSnapshot } from "../src/lib/projectValidation";
import { getClipsForTemplate } from "../src/lib/animationCompatibility";
import { animController } from "../src/core-v2/AnimationController";
import { APPEARANCE_PRESETS, NOSE_PRESETS, SCAR_PRESETS, FRECKLE_PRESETS, chibiFeatureSvg, DEFAULT_APPEARANCE } from "../src/data/characterAppearance";

afterEach(() => animController.pause());
function fixture() {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "biped_profile_base_v1", "Appearance");
  return useStore.getState().project.entities[0].id;
}
describe("character appearance", () => {
  it("renders distinct noses, lips, freckles and scars and saves their new settings", () => {
    for (const [feature, presets] of [["nose", NOSE_PRESETS], ["mouth", APPEARANCE_PRESETS.mouth]] as const) {
      const rendered = presets.filter(preset => preset.id !== "none").map(preset => chibiFeatureSvg(feature, preset.id, "#b77970")!);
      expect(new Set(rendered).size).toBe(rendered.length);
      for (const svg of rendered) expect(new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror")).toBeNull();
    }
    const scars = SCAR_PRESETS.filter(preset => preset.id !== "none").map(preset => chibiFeatureSvg("marks", "marks", "#111", {
      ...DEFAULT_APPEARANCE, scar: preset.id as typeof DEFAULT_APPEARANCE.scar,
    }));
    expect(new Set(scars).size).toBe(scars.length);
    const freckles = FRECKLE_PRESETS.filter(preset => preset.id !== "none").map(preset => chibiFeatureSvg("marks", "marks", "#111", {
      ...DEFAULT_APPEARANCE, freckles: true, freckleStyle: preset.id as typeof DEFAULT_APPEARANCE.freckleStyle,
    }));
    expect(new Set(freckles).size).toBe(freckles.length);
    const id = fixture();
    useStore.getState().setEntityAppearance(id, { nose: "aquiline", scar: "claw", freckles: true, freckleStyle: "dense", freckleIntensity: .8 });
    const restored = parseProjectSnapshot(JSON.parse(JSON.stringify(useStore.getState().project)));
    expect(restored.entities[0].appearance).toMatchObject({ nose: "aquiline", scar: "claw", freckles: true, freckleStyle: "dense", freckleIntensity: .8 });
  });
  for (const feature of ["eyes", "hair"] as const) {
    it(`renders every ${feature} preset distinctly in front and side views`, () => {
      const presets = APPEARANCE_PRESETS[feature].filter(preset => preset.id !== "none");
      expect(presets.length).toBeGreaterThanOrEqual(15);
      expect(new Set(presets.map(preset => preset.id)).size).toBe(presets.length);
      for (const view of ["front", "right", "left"] as const) {
        const rendered = presets.map(preset => chibiFeatureSvg(feature, preset.id, "#754a31", { ...DEFAULT_APPEARANCE, view })!);
        expect(new Set(rendered).size).toBe(rendered.length);
        for (const svg of rendered) {
          const document = new DOMParser().parseFromString(svg, "image/svg+xml");
          expect(document.querySelector("parsererror")).toBeNull();
          expect(document.documentElement.getAttribute("viewBox")).toBe("-27 -29 54 70");
          expect(svg).not.toMatch(/NaN|undefined/);
        }
      }
      const id = fixture();
      for (const preset of presets) {
        useStore.getState().setEntityFaceFeature(id, feature, { presetId: preset.id, visible: true });
        const project = useStore.getState().project;
        const restored = parseProjectSnapshot(JSON.parse(JSON.stringify(project)));
        expect(restored.entities[0].faceCustomization?.[feature]?.presetId).toBe(preset.id);
        const template = resolveTemplate(project, project.entities[0].templateId)!;
        const scene = evaluateScene(project.entities[0], template, evaluateRestSkeleton(template.bones), []);
        expect(scene.visuals.filter(visual => visual.id.endsWith(`__${feature}`))).toHaveLength(1);
      }
    });
  }
  it("changes body widths without moving bone joints and preserves custom details", () => {
    const id = fixture();
    let project = useStore.getState().project;
    const template = resolveTemplate(project, project.entities[0].templateId)!;
    const original = getCharacterBodyParts(template, project.entities[0]);
    const joints = JSON.stringify(template.bones);
    useStore.getState().setEntityAppearance(id, { sex: "female", fat: .7, muscle: .4, freckles: true, mole: true, scar: "cheek", nose: "button" });
    project = useStore.getState().project;
    const modified = getCharacterBodyParts(template, project.entities[0]);
    expect(modified.find(part => part.id === "hero_belly")!.naturalWidth).toBeGreaterThan(original.find(part => part.id === "hero_belly")!.naturalWidth);
    expect(modified.find(part => part.id === "hero_head")!.naturalWidth).toBe(original.find(part => part.id === "hero_head")!.naturalWidth);
    expect(JSON.stringify(template.bones)).toBe(joints);
    const restored = parseProjectSnapshot(JSON.parse(JSON.stringify(project)));
    expect(restored.entities[0].appearance).toEqual(project.entities[0].appearance);
    const scene = evaluateScene(project.entities[0], template, evaluateRestSkeleton(template.bones), []);
    expect(scene.visuals.some(visual => visual.id.endsWith("__marks"))).toBe(true);
    expect(scene.visuals.some(visual => visual.id.endsWith("__nose"))).toBe(true);
  });
  it("adds exactly one layer per chosen feature, bound to the head", () => {
    const id = fixture();
    useStore.getState().setEntityFaceFeature(id, "eyes", { presetId: "wide_shine", visible: true });
    useStore.getState().setEntityFaceFeature(id, "hair", { presetId: "long", visible: true });
    const project = useStore.getState().project;
    const template = resolveTemplate(project, project.entities[0].templateId)!;
    const scene = evaluateScene(project.entities[0], template, evaluateRestSkeleton(template.bones), []);
    for (const key of ["eyes", "hair"]) {
      const layers = scene.visuals.filter(visual => visual.id.endsWith(`__${key}`));
      expect(layers).toHaveLength(1);
      expect(layers[0].boneId).toBe("head");
      expect(layers[0].localBounds.minY).toBe(-29);
    }
    const clips = getClipsForTemplate(template, project.animationClips);
    expect(clips.every(clip => clip.id.startsWith("chibi_front__"))).toBe(true);
    expect(clips.some(clip => clip.id === "humanoid_side_v1__death")).toBe(false);
  });
});
