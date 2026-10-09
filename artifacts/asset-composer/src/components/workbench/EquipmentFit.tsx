import { uiLabel } from "@/lib/uiLabels";
import { animController } from "@/core-v2/AnimationController";
import { useStore } from "@/store";
import { resolveTemplate } from "@/data/templates";
import { getVisibleTemplateSlots } from "@/lib/slotVisibility";
import { itemSupportsTemplate } from "@/lib/templateCompatibility";
import { appearanceItemAllowed } from "@/lib/appearanceCompatibility";
import { beginCreation } from "@/lib/assetNavigation";
import { useWorkbench } from "@/store/workbench";

export function EquipmentFit({ itemId }: { itemId: string }) {
  const project = useStore(s => s.project), selectedSlotId = useStore(s => s.editor.selectedSlotId);
  const item = project.items.find(i => i.id === itemId);
  const entity = project.entities.find(e => e.id === project.activeEntityId);
  const characters = project.entities.filter(e => e.entityType !== "static_object" && !project.editorMeta.spriteEditorDocuments.some(d => d.studioEntityId === e.id));
  const template = entity ? resolveTemplate(project, entity.templateId) : undefined;
  const slots = template && item ? getVisibleTemplateSlots(template).filter(slot => item.allowedSlots.length ? item.allowedSlots.includes(slot.id) : slot.allowedCategories.includes(item.category)) : [];
  const slot = slots.find(s => s.id === selectedSlotId) ?? slots[0];
  const compatible = !!item && !!template && itemSupportsTemplate(item, template) && appearanceItemAllowed(item, entity?.appearance?.sex) && (!item.compatibility.species.length || item.compatibility.species.includes(entity?.species ?? ""));
  const equipped = entity?.slots.find(s => s.slotId === slot?.id)?.itemId === itemId;
  function selectSlot(slotId: string) {
    if (!entity) return;
    const store = useStore.getState(); store.setSelectedSlot(slotId);
    if (store.project.entities.find(e => e.id === entity.id)?.slots.find(s => s.slotId === slotId)?.itemId === itemId) {
      const part = item?.parts?.[0];
      store.setEditorSelection(part ? { kind: "item-part", entityId: entity.id, slotId, itemId, partId: part.id } : { kind: "equipped-item", entityId: entity.id, slotId, itemId }); store.setCanvasMode("edit-attachment");
    }
  }
  return <div className="fit-controls"><h2>Примерка и крепление</h2><p className="context-note">Рисунок предмета сохраняется отдельно. Здесь настраивается его положение на персонаже.</p>
    {!characters.length ? <><p>Сначала нужен персонаж для примерки.</p><button className="action-primary" onClick={() => beginCreation("character")}>Создать персонажа</button></> : <>
      <label className="field-label">Персонаж<select aria-label="Персонаж для примерки" value={entity?.id ?? ""} onChange={e => { const id = e.target.value; animController.pause(); useStore.setState(s => { s.project.activeEntityId = id; s.editor.selection = { kind: "none" }; s.editor.selectedSlotId = null; s.animPlayback.activeClipId = s.project.entities.find(c => c.id === id)?.activeAnimationClipId ?? null; s.animPlayback.timeMs = 0; s.animPlayback.playing = false; }); const clip = project.animationClips.find(c => c.id === useStore.getState().animPlayback.activeClipId); animController.setDuration(clip?.durationMs ?? 1000); animController.setLoop(clip?.loops ?? true); animController.seek(0); }}><option value="" disabled>Выберите персонажа</option>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="field-label">Место крепления<select aria-label="Место крепления" value={slot?.id ?? ""} onChange={e => selectSlot(e.target.value)}>{!slots.length && <option value="">Нет подходящего крепления</option>}{slots.map(s => <option key={s.id} value={s.id}>{uiLabel(s.name)}</option>)}</select></label>
      {!compatible && entity && <p role="alert" className="error-message">Предмет не совместим с этим скелетом, внешностью или видом персонажа. Выберите другого персонажа.</p>}
      <button className="action-primary" disabled={!entity || !slot || !compatible} onClick={() => { if (!entity || !slot) return; const store = useStore.getState(); store.setEntitySlot(entity.id, slot.id, equipped ? null : itemId); if (!equipped) { selectSlot(slot.id); } }}>{equipped ? "Снять" : "Надеть"}</button>
      {equipped && <button className="action-secondary" onClick={() => slot && selectSlot(slot.id)}>Настроить положение и масштаб</button>}
    </>}
    <button className="text-primary text-left" onClick={() => useWorkbench.setState({ helpTopic: "equipment" })}>Инструкция по подгонке →</button>
  </div>;
}
