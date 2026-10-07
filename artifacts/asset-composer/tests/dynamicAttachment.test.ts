import { expect, it } from "vitest";
import { PEASANT_EQUIPMENT } from "../src/data/peasantEquipment";
import { CHIBI_ANIMATIONS } from "../src/data/chibiAnimations";
import { deformAttachmentLine } from "../src/lib/dynamicAttachment";
import { identity } from "../src/lib/matrixUtils";

const part = PEASANT_EQUIPMENT.find(item => item.id === "bow_25d")!.parts!.find(part => part.id === "bow_string")!;
const clip = CHIBI_ANIMATIONS.find(clip => clip.name === "bow_shoot")!;
it("pins the string to the drawing hand in attachment coordinates", () => {
  const target = {x: 9, y: -4};
  const svg = deformAttachmentLine(part.svgData, part, identity(), target, {clip,timeMs:1000});
  expect(svg).toContain(`L${target.x-part.metrics.viewBoxX} ${target.y-part.metrics.viewBoxY}`);
  expect(deformAttachmentLine(part.svgData,part,identity(),target,{clip,timeMs:0})).toBe(part.svgData);
  expect(deformAttachmentLine(part.svgData,part,identity(),target,{clip,timeMs:1600})).toBe(part.svgData);
});
it("handles SVG attribute order and IDs containing punctuation", () => {
  const custom = {...part,dynamicLine:{...part.dynamicLine!,pathId:"string.[1]"}};
  const svg = "<svg><path d='M0 0' id='string.[1]'/><path id='other' d='M0 0'/></svg>";
  const result = deformAttachmentLine(svg,custom,identity(),{x:1,y:2},{clip,timeMs:800});
  expect(result).toContain('d="M17 13 L');
  expect(result).toContain("<path id='other' d='M0 0'/>");
});
