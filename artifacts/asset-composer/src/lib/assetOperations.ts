import { useStore } from "@/store";
import { studioCommit, newId } from "./studioActions";
import type { AssetRef } from "./assetCatalog";
import type { Project, SpriteEditorDocument } from "@/domain/types";
import { current, isDraft, type Draft } from "immer";
const copyValue = <T extends object>(value: T): T => structuredClone(isDraft(value) ? current(value as Draft<T>) : value) as T;

function cloneDocument(project: Project, original: SpriteEditorDocument) {
  const doc = copyValue(original);
  doc.id = newId(); doc.name += " (копия)";
  if (original.studioEntityId) {
    const source = project.entities.find(e => e.id === original.studioEntityId);
    const template = project.templates.find(t => t.id === source?.templateId);
    if (source && template) {
      const entity = copyValue(source), rig = copyValue(template);
      entity.id = newId(); entity.name += " (копия)"; rig.id = newId(); entity.templateId = rig.id;
      const clips = project.animationClips.filter(c => c.templateId === template.id).map(c => ({ ...copyValue(c), id: newId(), templateId: rig.id }));
      const activeIndex = project.animationClips.filter(c => c.templateId === template.id).findIndex(c => c.id === source.activeAnimationClipId);
      entity.activeAnimationClipId = clips[activeIndex]?.id ?? null;
      for (const visual of entity.visuals ?? []) if (visual.content?.kind === "document" && visual.content.documentId === original.id) { visual.content.documentId = doc.id; visual.editorDocumentId = doc.id; }
      doc.studioEntityId = entity.id; doc.target = { ...doc.target, entityId: entity.id };
      project.entities.push(entity); project.templates.push(rig); project.animationClips.push(...clips);
    }
  }
  project.editorMeta.spriteEditorDocuments.push(doc);
  return doc;
}
export function duplicateAsset(ref: AssetRef): AssetRef | null {
  if (ref.kind === "item") {
    const source = useStore.getState().project.items.find(i => i.id === ref.id);
    const copy = useStore.getState().duplicateProjectItem(ref.id);
    if (!source || !copy) return null;
    studioCommit("Скопировать рисунки предмета", p => {
      const item = p.items.find(i => i.id === copy.id)!;
      source.parts?.forEach((part, index) => {
        const original = p.editorMeta.spriteEditorDocuments.find(d => d.id === part.editorDocumentId || d.target.itemId === source.id && d.target.partId === part.id);
        const target = item.parts?.[index];
        if (!original || !target) return;
        const doc = cloneDocument(p, original);
        doc.target = { ...doc.target, itemId: item.id, propId: item.id, partId: target.id };
        target.editorDocumentId = doc.id;
        if (target.content?.kind === "document") target.content.documentId = doc.id;
        const layer = item.svgLayers[index]; if (layer?.content?.kind === "document") layer.content.documentId = doc.id;
      });
    });
    return { kind: "item", id: copy.id };
  }
  if (ref.kind === "artwork") {
    let id: string | undefined;
    studioCommit("Дублировать рисунок", p => { const original = p.editorMeta.spriteEditorDocuments.find(d => d.id === ref.id); if (original) id = cloneDocument(p, original).id; });
    return id ? { kind: "artwork", id } : null;
  }
  return null;
}
export function deleteAsset(ref: AssetRef) {
  if (ref.kind === "item") { useStore.getState().deleteProjectItem(ref.id); return; }
  if (ref.kind === "entity") { useStore.getState().deleteEntity(ref.id); return; }
  studioCommit("Удалить рисунок", p => {
    const doc = p.editorMeta.spriteEditorDocuments.find(d => d.id === ref.id);
    if (doc?.studioEntityId) p.entities = p.entities.filter(e => e.id !== doc.studioEntityId);
    p.editorMeta.spriteEditorDocuments = p.editorMeta.spriteEditorDocuments.filter(d => d.id !== ref.id);
    if (p.editorMeta.activeSpriteDocumentId === ref.id) p.editorMeta.activeSpriteDocumentId = null;
  });
}
