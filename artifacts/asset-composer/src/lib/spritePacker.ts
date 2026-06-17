/**
 * Shelf-first sprite sheet packer.
 * Frames are assumed to be uniform size (frameSz × frameSz).
 * Produces a square-ish OffscreenCanvas sheet with a regions map.
 */
export interface PackInput {
  frameName: string;
  bitmap: ImageBitmap;
}

export interface PackOutput {
  sheet: OffscreenCanvas;
  regions: Record<string, { x: number; y: number; w: number; h: number }>;
  sheetW: number;
  sheetH: number;
}

export function packSprites(frames: PackInput[], frameSz: number): PackOutput {
  const n = frames.length;
  if (n === 0) {
    const sheet = new OffscreenCanvas(frameSz, frameSz);
    return { sheet, regions: {}, sheetW: frameSz, sheetH: frameSz };
  }

  // Compute grid: aim for near-square layout
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const sheetW = cols * frameSz;
  const sheetH = rows * frameSz;

  const sheet = new OffscreenCanvas(sheetW, sheetH);
  const ctx = sheet.getContext("2d")!;

  const regions: Record<string, { x: number; y: number; w: number; h: number }> = {};

  for (let i = 0; i < frames.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * frameSz;
    const y = row * frameSz;
    ctx.drawImage(frames[i].bitmap, x, y, frameSz, frameSz);
    regions[frames[i].frameName] = { x, y, w: frameSz, h: frameSz };
  }

  return { sheet, regions, sheetW, sheetH };
}
