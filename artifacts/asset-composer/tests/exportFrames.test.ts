// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { refreshCanonicalBuiltInTypedItems } from "../src/lib/canonicalItems";
import { composeFrameSvg, evaluateExportScene, exportCamera, exportFramePlan } from "../src/lib/exportFrames";
import { animController } from "../src/core-v2/AnimationController";

function archer(view: "left" | "right") {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "biped_profile_base_v1", "Archer");
  const project = useStore.getState().project;
  const entity = structuredClone(project.entities[0]);
  entity.appearance = { ...entity.appearance!, view };
  for (const [slot, item] of Object.entries({ side_slot_torso: "trader_tunic_25d", side_slot_legs: "lumberjack_trousers_25d", side_slot_foot_l: "lumberjack_boots_25d", side_slot_weapon_main: "bow_25d" })) {
    entity.slots.find(s => s.slotId === slot)!.itemId = item;
  }
  const template = resolveTemplate(project, entity.templateId)!;
  const items = refreshCanonicalBuiltInTypedItems(project.items);
  const clip = project.animationClips.find(c => c.id === "chibi_front__bow_shoot")!;
  const scene = (fraction: number) => evaluateExportScene(entity, template, project.animationClips, items, project.itemFitProfiles,
    { key: "x", clip, frame: 0, timeMs: clip.durationMs * fraction });
  return { project, entity, template, clip, scene };
}

describe("export frames", () => {
  it("are evaluated per frame, so skinned garments, string and hand swaps animate", () => {
    const { scene } = archer("right");
    const rest = scene(0), draw = scene(.57);
    const svg = (s: typeof rest, part: string) => s.visuals.find(v => v.partId === part || v.id === part)!.svgData;
    expect(svg(draw, "bow_string")).not.toBe(svg(rest, "bow_string"));
    expect(svg(draw, "bow")).toBe(svg(rest, "bow"));
    expect(svg(draw, "part__hero_hand_r")).not.toBe(svg(rest, "part__hero_hand_r"));
    expect(draw.visuals.some(v => v.partId === "nocked_arrow")).toBe(false);
    expect(rest.visuals.some(v => v.partId === "nocked_arrow")).toBe(false);
    expect(svg(draw, "shirt_chest")).not.toBe(svg(rest, "shirt_chest"));
    animController.pause();
  });

  it("plans every clip frame and frames the character tightly with feet at the bottom", () => {
    const { project, entity, template, scene } = archer("right");
    const plan = exportFramePlan(entity, template, project.animationClips);
    expect(new Set(plan.map(f => f.key)).size).toBe(plan.length);
    const scenes = [scene(0), scene(.5)];
    const camera = exportCamera(scenes);
    const bounds = scenes.flatMap(s => s.visuals.map(v => v.worldBounds));
    expect(camera.size).toBeLessThan(Math.max(template.previewWidth, template.previewHeight));
    for (const b of bounds) {
      expect(b.minX).toBeGreaterThanOrEqual(camera.x - 1e-6);
      expect(b.maxY).toBeLessThanOrEqual(camera.y + camera.size + 1e-6);
    }
    const svg = composeFrameSvg(scenes[1], camera, 64);
    expect(svg).toContain('width="64"');
    expect(svg.match(/<image /g)?.length).toBe(scenes[1].visuals.length);
    animController.pause();
  });

  for (const view of ["left", "right"] as const) {
    it(`keeps garment layering stable while the ${view}-facing archer aims`, () => {
      const { scene } = archer(view);
      const garments = (fraction: number) => scene(fraction).visuals
        .filter(v => v.itemId && v.itemId !== "bow_25d" && !/sleeve/.test(v.partId ?? ""))
        .sort((a, b) => a.zIndex - b.zIndex).map(v => v.partId);
      expect(garments(.5)).toEqual(garments(0));
      // The near hand uses safe default depth below the head; the bow's authored
      // far-hand override remains explicit instead of promoting every hand.
      const z = (fraction: number, id: string) => scene(fraction).visuals.find(v => v.id === id)!.zIndex;
      const far = view === "left" ? "l" : "r";
      const near = view === "left" ? "r" : "l";
      expect(z(.64, `part__hero_hand_${near}`)).toBeLessThan(z(.64, "part__hero_head"));
      expect(z(.64, `part__hero_hand_${far}`)).toBeGreaterThan(z(.64, "part__hero_head"));
      expect(z(.64, `slot__side_slot_torso__trader_tunic_25d__sleeve_lower_${far}`)).toBeLessThan(z(.64, "part__hero_head"));
      expect(z(.64, `slot__side_slot_torso__trader_tunic_25d__sleeve_upper_${far}`)).toBeLessThan(z(.64, "part__hero_head"));
      expect(z(.64, `slot__side_slot_torso__trader_tunic_25d__sleeve_upper_${far}`)).toBeLessThan(z(.64, "slot__side_slot_torso__trader_tunic_25d__shirt_chest"));
      if(view === "right") {
        const torso=z(.5,"slot__side_slot_torso__trader_tunic_25d__shirt_chest");
        expect(z(.5,"part__hero_hand_r")).toBeLessThan(torso);
        expect(z(.5,"slot__side_slot_torso__trader_tunic_25d__sleeve_lower_r")).toBeLessThan(torso);
      }
      animController.pause();
    });
  }
});
