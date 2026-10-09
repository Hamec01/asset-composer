import type { Project, SpriteEditorDocument } from "@/domain/types";

export type AssetRef = { kind: "entity" | "item" | "artwork"; id: string };
export type AssetCategory = "character" | "equipment" | "environment" | "artwork";
export type WorkspaceId = "appearance" | "parts" | "equipment" | "draw" | "fit" | "rig" | "animate" | "preview";
export interface AssetEntry {
  ref: AssetRef;
  name: string;
  category: AssetCategory;
  tags: string[];
  builtIn: boolean;
  documentId?: string;
}
export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  character: "Персонажи", equipment: "Экипировка", environment: "Окружение", artwork: "Рисунки",
};
export const WORKSPACE_LABELS: Record<WorkspaceId, string> = {
  appearance: "Внешность", parts: "Части и рисунки", equipment: "Экипировка", draw: "Рисунок",
  fit: "Подгонка к персонажу", rig: "Скелет", animate: "Анимация", preview: "Предпросмотр",
};
export function assetKey(ref: AssetRef) { return `${ref.kind}:${ref.id}`; }
export function assetDocument(project: Project, ref: AssetRef): SpriteEditorDocument | undefined {
  const docs = project.editorMeta.spriteEditorDocuments;
  if (ref.kind === "artwork") return docs.find(d => d.id === ref.id);
  if (ref.kind === "item") {
    const item = project.items.find(i => i.id === ref.id);
    return docs.find(d => d.target.itemId === ref.id || d.target.propId === ref.id || item?.parts?.some(p => p.editorDocumentId === d.id));
  }
  return docs.find(d => d.studioEntityId === ref.id) ?? docs.find(d => d.target.entityId === ref.id);
}
export function buildAssetCatalog(project: Project): AssetEntry[] {
  const docs = project.editorMeta.spriteEditorDocuments;
  const studioIds = new Set(docs.map(d => d.studioEntityId).filter(Boolean));
  const ownedDocs = new Set(project.items.flatMap(item => item.parts?.map(part => part.editorDocumentId).filter(Boolean) ?? []));
  return [
    ...project.entities.filter(e => !studioIds.has(e.id)).map(e => ({
      ref: { kind: "entity" as const, id: e.id }, name: e.name,
      category: (e.entityType === "static_object" ? "environment" : "character") as AssetCategory,
      tags: [e.entityType, e.species].filter(Boolean), builtIn: false,
    })),
    ...project.items.map(item => ({
      ref: { kind: "item" as const, id: item.id }, name: item.name,
      category: (item.tags.some(t => t.startsWith("world_")) || item.category === "static_part" ? "environment" : "equipment") as AssetCategory,
      tags: item.tags, builtIn: !item.tags.includes("user_drawn") && !item.tags.includes("art_studio") && item.licenseMeta.source !== "User Authored",
      documentId: assetDocument(project, { kind: "item", id: item.id })?.id,
    })),
    ...docs.filter(d => !d.target.itemId && !d.target.propId && (d.studioEntityId || !d.target.entityId) && d.target.kind !== "face-overlay")
      .filter(d => !ownedDocs.has(d.id))
      .map(d => ({ ref: { kind: "artwork" as const, id: d.id }, name: d.name,
        category: "artwork" as const, tags: ["рисунок", ...(d.studioEntityId ? ["скелет", "анимация"] : [])], builtIn: false, documentId: d.id })),
  ];
}
export function assetWorkspaces(entry: AssetEntry): WorkspaceId[] {
  return ASSET_ACTIONS[entry.category];
}
export const ASSET_ACTIONS = {
  character: ["appearance", "parts", "equipment", "animate", "preview"],
  equipment: ["draw", "fit", "preview"],
  environment: ["draw", "rig", "animate", "preview"],
  artwork: ["draw", "rig", "animate", "preview"],
} satisfies Record<AssetCategory, WorkspaceId[]>;
export function exportEntityFor(project: Project, ref: AssetRef | null) {
  if (!ref) return undefined;
  if (ref.kind === "entity") return project.entities.find(e => e.id === ref.id);
  const doc = assetDocument(project, ref);
  if (doc?.studioEntityId) return project.entities.find(e => e.id === doc.studioEntityId);
  if (ref.kind === "item") return project.entities.find(e => e.id === project.activeEntityId && e.slots.some(s => s.itemId === ref.id));
  return undefined;
}
