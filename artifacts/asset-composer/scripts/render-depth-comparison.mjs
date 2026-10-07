import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const sharp = createRequire(import.meta.url)(process.env.SHARP_MODULE_PATH ?? "sharp");

const directory = process.argv[2] ?? resolve("../../output");
const prefix = process.argv[3] ?? "depth";
const frames = prefix === "depth" ? [1,3] : [2,3];
const content = name => readFileSync(`${directory}/${prefix}-${name}.svg`,"utf8").replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,"");
const before=content("before"),after=content("after");
for (const [facing,row] of [["right",0],["left",430]]) {
  const panels=[before,after].flatMap((art,column)=>frames.map((frame,index)=>
    `<svg x="${column*340}" y="${index*430+40}" width="340" height="430" viewBox="${frame*300} ${row} 300 430">${art}</svg>`)).join("");
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="680" height="900"><rect width="680" height="900" fill="#252729"/><g font-family="sans-serif" font-size="18" fill="white" text-anchor="middle"><text x="170" y="28">BEFORE · ${facing}</text><text x="510" y="28">AFTER · ${facing}</text></g>${panels}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${directory}/${prefix}-before-after-${facing}.png`);
}
