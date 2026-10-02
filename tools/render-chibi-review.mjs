import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createChibiBody, createChibiThumbnail } from "../artifacts/asset-composer/src/data/chibiBody.ts";
import { bipedProfileChibiBones } from "../artifacts/asset-composer/src/data/chibiRig.ts";

const sharp = (await import(pathToFileURL(process.argv[2]).href)).default;
const output = process.argv[3];
const palette = { skin: "#FFD0A8", outline: "#4A3728", shadow: "#00000022" };
const panels = ["classic", "slim", "sturdy"].map((build, index) => {
  const body = createChibiThumbnail(createChibiBody(palette, build), bipedProfileChibiBones);
  return `<g transform="translate(${index * 300 + 38} 40)"><svg width="224" height="470">${body}</svg></g>`;
}).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="550"><rect width="900" height="550" fill="#252729"/>${panels}</svg>`;
await mkdir(dirname(output), { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(output);
console.log(output);
