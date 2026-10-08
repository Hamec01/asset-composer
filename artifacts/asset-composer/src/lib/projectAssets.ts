import type { Project } from "@/domain/types";
/** Serialize current artwork only; undo commands retain their immutable resource revisions. */
export function referencedAssetIds(value: unknown): Set<string> {
  const used = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.assetId === "string") used.add(record.assetId);
    for (const [key, child] of Object.entries(record))
      if (key !== "assets") visit(child);
  };
  visit(value);
  return used;
}
export function compactProjectAssets(project: Project): Project {
  const used = referencedAssetIds(project);
  return {
    ...project,
    version: "3.0",
    assets: Object.fromEntries(
      Object.entries(project.assets ?? {}).filter(([id]) => used.has(id)),
    ),
  };
}
