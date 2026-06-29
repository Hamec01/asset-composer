// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { TEMPLATES } from "../src/data/templates";
import {
  buildImportedItemPart,
  buildImportedProjectItem,
  inferImportedPartDefaults,
  makeImportedAssetSource,
  resolveImportedPartRole,
  wrapRasterDataUriAsSvg,
} from "../src/lib/assetImport";

describe("asset import helpers", () => {
  it("wraps PNG sources into SVG so existing renderers can consume them", () => {
    const svg = wrapRasterDataUriAsSvg("data:image/png;base64,AAAA", 64, 32);

    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 64 32"');
    expect(svg).toContain("<image");
    expect(svg).toContain("data:image/png;base64,AAAA");
  });

  it("builds a project item with bone-local parts and slot anchor defaults", () => {
    const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
    const slotDef = template.slots.find(slot => slot.id === "slot_hair")!;
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12"><rect x="2" y="1" width="20" height="10" rx="4" fill="#222"/></svg>`;

    const part = buildImportedItemPart({
      fileName: "hair_front.svg",
      displayName: "Hair Front",
      boneId: "head",
      svgData,
      source: makeImportedAssetSource({
        format: "svg",
        name: "Hair Front",
        originalFileName: "hair_front.svg",
        mimeType: "image/svg+xml",
      }),
      pivotX: 12,
      pivotY: 6,
      zOffset: 0.3,
    });

    const item = buildImportedProjectItem({
      id: "custom_hair_front",
      name: "Custom Hair Front",
      description: "Imported front hair",
      category: "hair",
      slotId: slotDef.id,
      template,
      slotDef,
      parts: [part],
    });

    expect(item.allowedSlots).toEqual(["slot_hair"]);
    expect(item.coordinateMode).toBe("bone_local");
    expect(item.parts).toHaveLength(1);
    expect(item.parts?.[0]?.boneId).toBe("head");
    expect(item.anchorRules.slot_hair?.anchorId).toBe("hair_top");
    expect(item.svgLayers[0]?.svgData).toContain("<svg");
  });

  it("infers left/right boots and shoulder armor from file names", () => {
    const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
    const feetSlot = template.slots.find(slot => slot.id === "slot_feet")!;
    const torsoSlot = template.slots.find(slot => slot.id === "slot_torso")!;

    const leftBoot = inferImportedPartDefaults({
      fileName: "leather_boot_left.png",
      category: "feet",
      template,
      slotDef: feetSlot,
    });
    const rightPauldron = inferImportedPartDefaults({
      fileName: "steel_pauldron_right.svg",
      category: "torso",
      template,
      slotDef: torsoSlot,
    });

    expect(leftBoot.boneId).toBe("foot_l");
    expect(leftBoot.role).toBe("foot_l");
    expect(leftBoot.zOffset).toBeGreaterThanOrEqual(feetSlot.zIndex);
    expect(rightPauldron.boneId).toBe("shoulder_r");
    expect(rightPauldron.role).toBe("shoulder_r");
    expect(rightPauldron.zOffset).toBeGreaterThan(torsoSlot.zIndex);
  });

  it("infers centered torso and front hair pieces from file names", () => {
    const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
    const hairSlot = template.slots.find(slot => slot.id === "slot_hair")!;
    const legsSlot = template.slots.find(slot => slot.id === "slot_legs")!;

    const hairFront = inferImportedPartDefaults({
      fileName: "hair_front.svg",
      category: "hair",
      template,
      slotDef: hairSlot,
    });
    const pantsBody = inferImportedPartDefaults({
      fileName: "pants_body_center.svg",
      category: "legs",
      template,
      slotDef: legsSlot,
    });

    expect(hairFront.boneId).toBe("head");
    expect(hairFront.role).toBe("front");
    expect(hairFront.zOffset).toBeGreaterThan(hairSlot.zIndex);
    expect(pantsBody.boneId).toBe("pelvis");
    expect(pantsBody.role).toBe("pelvis");
  });

  it("resolves explicit import roles into stable bones and z offsets", () => {
    const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
    const torsoSlot = template.slots.find(slot => slot.id === "slot_torso")!;
    const feetSlot = template.slots.find(slot => slot.id === "slot_feet")!;

    const backCape = resolveImportedPartRole({
      role: "back",
      category: "torso",
      template,
      slotDef: torsoSlot,
    });
    const rightBoot = resolveImportedPartRole({
      role: "foot_r",
      category: "feet",
      template,
      slotDef: feetSlot,
    });

    expect(backCape.boneId).toBe("spine");
    expect(backCape.zOffset).toBeLessThan(torsoSlot.zIndex);
    expect(rightBoot.boneId).toBe("foot_r");
    expect(rightBoot.zOffset).toBeGreaterThanOrEqual(feetSlot.zIndex);
  });
});
