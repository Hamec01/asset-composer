export function stablePartColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return "hsl(" + (Math.abs(hash) % 360) + " 70% 55%)";
}
