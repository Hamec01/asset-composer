import { describe, it, expect } from "vitest";
import { createChibiSideBody } from "../src/data/chibiSideBody";
import { DEFAULT_APPEARANCE } from "../src/data/characterAppearance";
import type { BonePart, CharacterAppearance } from "../src/domain/types";

const palette = { skin: "#FFD0A8", hair: "#7A4A2B", primaryCloth: "#EADCC8", secondaryCloth: "#8C623E", metal: "#B8B8B8", accent: "#C8955A", outline: "#4A3728", shadow: "#00000022" };
const body = (a: Partial<CharacterAppearance> = {}) => createChibiSideBody(palette as never, 1, { ...DEFAULT_APPEARANCE, ...a }, "r");
const part = (parts: BonePart[], id: string) => parts.find(p => p.id === id)!;
const viewBox = (p: BonePart) => p.svgData.match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);

describe("side-view chibi body", () => {
  it("draws every part 1:1 in its bone's coordinates", () => {
    for (const p of body()) {
      const [x, y, w, h] = viewBox(p);
      // The renderer fits the viewBox into naturalWidth × naturalHeight centred on localX/Y.
      expect(w).toBeCloseTo(p.naturalWidth, 1);
      expect(h).toBeCloseTo(p.naturalHeight, 1);
      if (p.id !== "hero_head") {
        expect(x + w / 2).toBeCloseTo(p.localX, 1);
        expect(y + h / 2).toBeCloseTo(p.localY, 1);
      }
    }
  });

  it("changes the actual silhouette for sex, muscle, fat and slimness", () => {
    const base = body();
    const width = (parts: BonePart[], id: string) => part(parts, id).naturalWidth;
    expect(width(body({ muscle: 1 }), "hero_arm_l_upper")).toBeGreaterThan(width(base, "hero_arm_l_upper") + 1.5);
    expect(width(body({ fat: 1 }), "hero_belly")).toBeGreaterThan(width(base, "hero_belly") + 4);
    expect(width(body({ slimness: 1 }), "hero_thigh_l")).toBeLessThan(width(base, "hero_thigh_l") - 2);
    expect(width(body({ sex: "female" }), "hero_torso")).toBeGreaterThan(width(base, "hero_torso"));
    expect(part(body({ sex: "female" }), "hero_torso").svgData).not.toBe(part(base, "hero_torso").svgData);
  });

  it("uses ball joints: each child's proximal cap sits inside the parent's distal cap", () => {
    for (const a of [{}, { muscle: 1 }, { fat: 1 }, { slimness: 1 }, { sex: "female" as const }]) {
      const parts = body(a);
      for (const [parent, child, length] of [["hero_arm_l_upper", "hero_arm_l_lower", 15], ["hero_thigh_l", "hero_calf_l", 13]] as const) {
        const [, py, , ph] = viewBox(part(parts, parent));
        const [cx, cy, cw] = viewBox(part(parts, child));
        // Parent reaches past the joint; the child's cap starts within the parent's outline.
        expect(py + ph).toBeGreaterThan(length);
        expect(-cy).toBeLessThan(py + ph - length + 1.7);
        expect(cw).toBeGreaterThan(0);
        expect(cx).toBeLessThan(0);
      }
    }
  });

  it("keeps the hand frame identical between the fist and the grip drawing", () => {
    const hand = part(body(), "hero_hand_l");
    expect(hand.attachments?.grip).toBeTruthy();
    expect(hand.attachments!.grip.match(/viewBox="([^"]+)"/)![1]).toBe(viewBox(hand).join(" "));
  });
});
