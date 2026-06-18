/**
 * svgMetrics.ts
 *
 * Parse SVG metadata and compute visual content bounds.
 *
 * VectorAssetMetrics stores BOTH the raw viewBox and the visual content bounds
 * so that renderers can avoid centring on empty padding inside the viewBox.
 *
 * Note: accurate content bounds require a DOM environment. The helpers here
 * use getBBox() on a detached SVG element when available, falling back to the
 * viewBox dimensions.
 */

import type { VectorAssetMetrics } from "@/domain/types";

// ── viewBox parser ────────────────────────────────────────────────────────────

interface ParsedViewBox {
  x: number; y: number; width: number; height: number;
}

function parseViewBoxFromSvgString(svgData: string): ParsedViewBox | null {
  const viewBoxMatch = svgData.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(n => isFinite(n))) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }

  const widthMatch = svgData.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const heightMatch = svgData.match(/\bheight\s*=\s*["']([^"']+)["']/i);
  const width = widthMatch ? parseFloat(widthMatch[1]) : NaN;
  const height = heightMatch ? parseFloat(heightMatch[1]) : NaN;
  if (Number.isFinite(width) && Number.isFinite(height)) {
    return { x: 0, y: 0, width, height };
  }

  return null;
}

function parseViewBox(svg: SVGSVGElement): ParsedViewBox {
  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(n => isFinite(n))) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }
  const w = parseFloat(svg.getAttribute("width")  ?? "") || 100;
  const h = parseFloat(svg.getAttribute("height") ?? "") || 100;
  return { x: 0, y: 0, width: w, height: h };
}

// ── Content-bounds estimation ─────────────────────────────────────────────────

/**
 * Attempt to get actual content bounds via getBBox() on a temporarily-attached
 * SVG element. Falls back to the viewBox if the environment is headless or
 * getBBox() returns a zero-size box (empty SVG).
 */
function getContentBounds(
  svgEl: SVGSVGElement,
  vb: ParsedViewBox,
): { minX: number; minY: number; width: number; height: number } {
  const fallback = { minX: vb.x, minY: vb.y, width: vb.width, height: vb.height };

  try {
    // getBBox() only works on elements attached to the live DOM
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;visibility:hidden";
    document.body.appendChild(host);
    host.appendChild(svgEl);

    // Force geometry
    svgEl.setAttribute("width",  String(vb.width));
    svgEl.setAttribute("height", String(vb.height));

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    // Move all children into g for a single getBBox() call
    while (svgEl.firstChild) g.appendChild(svgEl.firstChild);
    svgEl.appendChild(g);

    let bbox: DOMRect;
    try { bbox = g.getBBox(); } catch { document.body.removeChild(host); return fallback; }

    while (g.firstChild) svgEl.insertBefore(g.firstChild, g);
    svgEl.removeChild(g);
    document.body.removeChild(host);

    if (bbox.width < 1 || bbox.height < 1) return fallback;

    return { minX: bbox.x, minY: bbox.y, width: bbox.width, height: bbox.height };
  } catch {
    return fallback;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse an SVG string and return VectorAssetMetrics.
 *
 * Returns a safe default (100×100 viewBox) if parsing fails.
 */
export function parseMetrics(svgData: string): VectorAssetMetrics {
  const stringViewBox = parseViewBoxFromSvgString(svgData);
  const safeViewBox = stringViewBox ?? { x: 0, y: 0, width: 100, height: 100 };
  const safe: VectorAssetMetrics = {
    viewBoxX: safeViewBox.x,
    viewBoxY: safeViewBox.y,
    viewBoxWidth: safeViewBox.width,
    viewBoxHeight: safeViewBox.height,
    visualMinX: safeViewBox.x,
    visualMinY: safeViewBox.y,
    visualWidth: safeViewBox.width,
    visualHeight: safeViewBox.height,
  };

  if (!svgData || typeof svgData !== "string") return safe;

  try {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(svgData, "image/svg+xml");
    const errEl  = doc.querySelector("parsererror");
    if (errEl) return safe;

    const svg = doc.documentElement as unknown as SVGSVGElement;
    if (svg.tagName.toLowerCase() !== "svg") return safe;

    const vb      = parseViewBox(svg);
    const content = getContentBounds(svg, vb);

    return {
      viewBoxX:     vb.x,
      viewBoxY:     vb.y,
      viewBoxWidth:  vb.width,
      viewBoxHeight: vb.height,
      visualMinX:   content.minX,
      visualMinY:   content.minY,
      visualWidth:   content.width,
      visualHeight:  content.height,
    };
  } catch {
    return safe;
  }
}

/**
 * Compute the pivot position in local content coordinates.
 * "center"  → centre of visual content bounds.
 * "feet"    → horizontally centred, at the bottom of visual content bounds.
 * "custom"  → caller provides the value; this helper is not called.
 */
export function computePivotXY(
  metrics: VectorAssetMetrics,
  preset: "center" | "feet" | "custom",
): { x: number; y: number } {
  const cx = metrics.visualMinX + metrics.visualWidth  / 2;
  const cy = metrics.visualMinY + metrics.visualHeight / 2;
  const by = metrics.visualMinY + metrics.visualHeight;
  switch (preset) {
    case "center": return { x: cx, y: cy };
    case "feet":   return { x: cx, y: by };
    default:       return { x: cx, y: cy };
  }
}
