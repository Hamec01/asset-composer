import type { PaletteTokens } from "@/domain/types";

/**
 * Replace palette token colours in an SVG string.
 * The template SVGs use hex values that match the default palette.
 * This function swaps them out for the entity's actual palette values.
 */
export function applyPaletteToSvg(
  svgData: string,
  originalPalette: PaletteTokens,
  targetPalette: PaletteTokens
): string {
  let result = svgData;
  const keys = Object.keys(originalPalette) as (keyof PaletteTokens)[];
  for (const key of keys) {
    const from = originalPalette[key];
    const to = targetPalette[key];
    if (from && to && from !== to) {
      result = result.split(from).join(to);
      result = result.split(from.toLowerCase()).join(to);
      result = result.split(from.toUpperCase()).join(to);
    }
  }
  return result;
}

/**
 * Create a data URL from an SVG string.
 */
export function svgToDataUrl(svgString: string): string {
  const encoded = encodeURIComponent(svgString);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

/**
 * Parse an SVG string and return an HTMLElement.
 */
export function parseSvgString(svgString: string): SVGElement | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const el = doc.documentElement;
    if (el.tagName === "parsererror") return null;
    return el as unknown as SVGElement;
  } catch {
    return null;
  }
}

/**
 * Stamp explicit width/height attributes onto an SVG string so browsers
 * always render it at the intended pixel dimensions instead of defaulting
 * to 0×0 (or the raw viewBox values) when no size attributes are present.
 *
 * Also sets preserveAspectRatio="none" so the content fills the target
 * rectangle exactly — item art is authored as full-frame overlays within
 * a 64×64 viewBox, so stretching to the template frame size is correct.
 */
export function scaleSvgToFit(
  svgString: string,
  targetWidth: number,
  targetHeight: number
): string {
  return svgString.replace(
    /<svg([^>]*)>/,
    (_match, attrs: string) => {
      const clean = attrs
        .replace(/\s*width="[^"]*"/, "")
        .replace(/\s*height="[^"]*"/, "")
        .replace(/\s*preserveAspectRatio="[^"]*"/, "");
      return `<svg${clean} width="${targetWidth}" height="${targetHeight}" preserveAspectRatio="none">`;
    }
  );
}

/**
 * Render an SVG string into an HTML canvas and return a Blob (PNG).
 *
 * Stamps explicit pixel dimensions onto the SVG before loading to avoid
 * browsers rendering SVGs without explicit width/height at 0×0.
 */
export async function renderSvgToBlob(
  svgString: string,
  width: number,
  height: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const sized = scaleSvgToFit(svgString, width, height);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => resolve(blob), "image/png");
    };
    img.onerror = () => resolve(null);
    img.src = svgToDataUrl(sized);
  });
}

/**
 * Generate a simple thumbnail data URL from an SVG string.
 */
export function generateThumbnail(svgString: string, size = 64): string {
  const scaled = scaleSvgToFit(svgString, size, size);
  return svgToDataUrl(scaled);
}
