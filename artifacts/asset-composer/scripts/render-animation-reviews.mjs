import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const paths = process.argv.slice(2);
if (!paths.length || paths.some((path) => !path.toLowerCase().endsWith(".svg"))) {
  throw new Error("Usage: node scripts/render-animation-reviews.mjs <sheet.svg> [...]");
}
for (const path of paths) {
  const source = resolve(path);
  const destination = source.replace(/\.svg$/i, ".png");
  const png = new Resvg(readFileSync(source), {
    fitTo: { mode: "width", value: 1280 },
  }).render().asPng();
  writeFileSync(destination, png);
  console.log(destination);
}
