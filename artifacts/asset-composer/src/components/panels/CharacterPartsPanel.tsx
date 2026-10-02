import { Pencil, RotateCcw, Plus } from "lucide-react";
import { useStore } from "@/store";
import { resolveTemplate } from "@/data/templates";
import { sanitizeSvg } from "@/lib/sanitize";
import { createEditableBodyPart } from "@/lib/bodyPartAuthoring";
import { createDocumentFromEntityVisual } from "@/lib/spriteEditor";
import type { BonePart } from "@/domain/types";
import { getCharacterBodyParts } from "@/data/chibiBody";

const PART_NAMES: Record<string, string> = {
  hero_head: "Голова", hero_neck: "Шея", hero_torso: "Грудь", hero_belly: "Живот", hero_pelvis: "Таз / бельё",
  hero_arm_l_upper: "Левое плечо", hero_arm_r_upper: "Правое плечо",
  hero_arm_l_lower: "Левое предплечье", hero_arm_r_lower: "Правое предплечье",
  hero_hand_l: "Левая кисть", hero_hand_r: "Правая кисть",
  hero_thigh_l: "Левое бедро", hero_thigh_r: "Правое бедро",
  hero_calf_l: "Левая голень", hero_calf_r: "Правая голень",
  hero_foot_l: "Левая стопа", hero_foot_r: "Правая стопа",
};

export function CharacterPartsPanel() {
  const project = useStore(s => s.project);
  const selection = useStore(s => s.editor.selection);
  const entity = project.entities.find(candidate => candidate.id === project.activeEntityId);
  const template = entity ? resolveTemplate(project, entity.templateId) : undefined;
  const bodyView = entity?.appearance?.view && entity.appearance.view !== "front" ? "side" : "front";

  function editPart(part: BonePart) {
    if (!entity) return;
    const store = useStore.getState();
    const existing = entity.visuals?.find(visual => visual.bodyPartId === part.id && (visual.bodyView ?? "front") === bodyView);
    const visual = existing ?? createEditableBodyPart(part);
    const savedDoc = project.editorMeta.spriteEditorDocuments.find(doc => doc.id === visual.editorDocumentId);
    const doc = savedDoc ?? createDocumentFromEntityVisual(entity.id, visual);
    if (!savedDoc) doc.name = PART_NAMES[part.id] ?? part.id;
    if (!existing) {
      visual.bodyView = bodyView;
      visual.editorDocumentId = doc.id;
      store.addEntityVisual(entity.id, visual);
    }
    if (!savedDoc) store.upsertSpriteEditorDocument(doc);
    store.setActiveSpriteDocument(doc.id);
    store.setEditorSelection({ kind: "entity-visual", entityId: entity.id, visualId: visual.id });
    store.setActiveAuthoringMode("sprite-editor");
    store.setAnimBottomTab("authoring");
    store.setCanvasMode("select");
  }

  if (!entity || !template) return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground">Нет персонажа</p>
      <button onClick={() => useStore.getState().openWizard()} className="flex items-center gap-2 text-sm text-primary"><Plus size={16} /> Создать персонажа</button>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto ide-scroll" data-testid="character-parts">
      <div className="px-3 py-3 border-b border-border">
        <p className="text-sm font-medium truncate">{entity.name}</p>
        <p className="text-xs text-muted-foreground mt-1">{template.boneParts?.length ?? 0} частей тела</p>
      </div>
      <div className="py-1">
        {[...getCharacterBodyParts(template, entity)].sort((a, b) => b.zOffset - a.zOffset).map(part => {
          const replacement = entity.visuals?.find(visual => visual.bodyPartId === part.id && (visual.bodyView ?? "front") === bodyView);
          const selected = selection.kind === "bone" ? selection.boneId === part.boneId : selection.kind === "entity-visual" && selection.visualId === replacement?.id;
          return (
            <div key={part.id} className={`flex items-center gap-2 px-3 py-2 border-l-2 ${selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-accent/30"}`}>
              <button
                data-testid={`body-part-${part.id}`}
                aria-pressed={selected}
                onClick={() => project.editorMeta.activeAuthoringMode === "sprite-editor" ? editPart(part) : useStore.getState().setEditorSelection({ kind: "bone", entityId: entity.id, boneId: part.boneId })}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span className="w-8 h-9 flex-shrink-0 overflow-hidden" dangerouslySetInnerHTML={{ __html: sanitizeSvg(replacement?.svgData ?? part.svgData) }} />
                <span className="text-xs break-words">{PART_NAMES[part.id] ?? part.id}</span>
              </button>
              {replacement && <button title="Вернуть базовую часть" aria-label={`Вернуть ${PART_NAMES[part.id] ?? part.id}`} className="p-1 text-muted-foreground hover:text-foreground" onClick={() => useStore.getState().removeEntityVisual(entity.id, replacement.id)}><RotateCcw size={13} /></button>}
              <button data-testid={`edit-body-part-${part.id}`} title="Редактировать рисунок" aria-label={`Редактировать ${PART_NAMES[part.id] ?? part.id}`} onClick={() => editPart(part)} className="p-1 text-muted-foreground hover:text-primary"><Pencil size={14} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
