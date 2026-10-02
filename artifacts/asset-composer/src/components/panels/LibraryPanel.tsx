import { useMemo, useState } from "react";
import { useStore } from "@/store";
import { resolveTemplate } from "@/data/templates";
import { sanitizeSvg } from "@/lib/sanitize";
import { getVisibleTemplateSlots } from "@/lib/slotVisibility";
import { getTemplatePresentationSummary } from "@/lib/templatePresentation";
import { itemSupportsTemplate } from "@/lib/templateCompatibility";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, ChevronRight, X, AlertTriangle, Eye, EyeOff, Lock, Unlock, RotateCcw, Shirt } from "lucide-react";
import type { Item, ItemCategory, SlotDef } from "@/domain/types";
import { CharacterPartsPanel } from "./CharacterPartsPanel";
import { AppearancePanel } from "./AppearancePanel";

export type LibraryTabId = "appearance" | "entities" | "body" | "slots" | "items";

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  head_cover: "Helmets",
  hair: "Hair",
  eyes: "Eyes",
  face: "Face",
  beard: "Beard",
  neck: "Neck",
  torso: "Torso",
  arms: "Arms",
  hands: "Hands",
  waist: "Waist",
  legs: "Legs",
  feet: "Feet",
  cloak: "Cloaks",
  weapon_main: "Main Weapon",
  weapon_off: "Off-hand",
  shield: "Shields",
  ring: "Rings",
  amulet: "Amulets",
  creature_horn: "Horns",
  creature_wing: "Wings",
  creature_tail: "Tails",
  creature_saddle: "Saddles",
  creature_pack: "Packs",
  creature_shell: "Shells",
  static_part: "Parts",
};

const CATEGORY_GROUPS: { label: string; categories: ItemCategory[] }[] = [
  { label: "Все", categories: [] },
  { label: "Броня", categories: ["head_cover", "torso", "arms", "hands", "legs", "feet"] },
  { label: "Одежда", categories: ["hair", "eyes", "face", "beard", "neck", "waist", "cloak"] },
  { label: "Оружие", categories: ["weapon_main", "weapon_off", "shield"] },
  { label: "Украшения", categories: ["ring", "amulet"] },
  { label: "Существа", categories: ["creature_horn", "creature_wing", "creature_tail", "creature_saddle", "creature_pack", "creature_shell"] },
  { label: "Объекты", categories: ["static_part"] },
];

function ItemCard({
  item,
  isEquipped,
  isIncompat,
  onClick,
  disabled,
}: {
  item: Item;
  isEquipped: boolean;
  isIncompat: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      data-testid={`item-card-${item.id}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isEquipped}
      title={`${item.name}: ${item.description}`}
      className={[
        "flex flex-col items-center gap-1 rounded border p-2 text-center text-xs transition-colors min-w-0",
        isEquipped
          ? "border-primary/60 bg-primary/10 text-primary"
          : isIncompat
            ? "border-border bg-accent/10 text-muted-foreground opacity-60"
            : "border-border bg-accent/30 hover:border-primary/40 hover:bg-accent text-muted-foreground",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <div className="relative w-10 h-10 bg-background rounded border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
        {item.svgLayers[0]
          ? <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: sanitizeSvg(item.svgLayers[0].svgData) }} />
          : <span className="text-muted-foreground text-[10px]">?</span>}
        {isIncompat && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <AlertTriangle className="w-3 h-3 text-yellow-500" />
          </div>
        )}
      </div>
      <span className="w-full text-xs leading-snug break-words">{item.name}</span>
      {item.compatibility.skeletonFamilies.length > 0 && (
        <span className="text-[8px] text-muted-foreground/70 truncate w-full">
          {item.compatibility.skeletonFamilies[0].split("_")[0]}
        </span>
      )}
    </button>
  );
}

export function LibraryPanel({ activeTab, onTabChange: setActiveTab }: { activeTab: LibraryTabId; onTabChange: (tab: LibraryTabId) => void }) {
  const project = useStore(s => s.project);
  const editor = useStore(s => s.editor);
  const openWizard = useStore(s => s.openWizard);
  const setActiveEntity = useStore(s => s.setActiveEntity);
  const deleteEntity = useStore(s => s.deleteEntity);
  const setSelectedSlot = useStore(s => s.setSelectedSlot);
  const setEntitySlot = useStore(s => s.setEntitySlot);
  const setSlotGizmoHidden = useStore(s => s.setSlotGizmoHidden);
  const setSlotGizmoLocked = useStore(s => s.setSlotGizmoLocked);
  const hideAllSlotGizmos = useStore(s => s.hideAllSlotGizmos);
  const showAllSlotGizmos = useStore(s => s.showAllSlotGizmos);
  const unlockAllSlotGizmos = useStore(s => s.unlockAllSlotGizmos);
  const updateTemplateSlotTransform = useStore(s => s.updateTemplateSlotTransform);
  const getActiveEntity = useStore(s => s.getActiveEntity);
  const getActiveTemplate = useStore(s => s.getActiveTemplate);

  const [search, setSearch] = useState("");
  const [categoryGroup, setCategoryGroup] = useState(0);

  const activeEntity = getActiveEntity();
  const template = getActiveTemplate();

  const slots: SlotDef[] = template ? getVisibleTemplateSlots(template) : [];
  const slotEditorState = template
    ? project.editorMeta.slotEditorByTemplateId[template.id] ?? { hiddenSlotIds: [], lockedSlotIds: [] }
    : { hiddenSlotIds: [], lockedSlotIds: [] };
  const hiddenSlotIds = new Set(slotEditorState.hiddenSlotIds);
  const lockedSlotIds = new Set(slotEditorState.lockedSlotIds);
  const selectedSlot = slots.find(slot => slot.id === editor.selectedSlotId);
  const selectedSlotAssignment = activeEntity?.slots.find(slot => slot.slotId === editor.selectedSlotId);

  const displayedItems = useMemo(() => {
    const group = CATEGORY_GROUPS[categoryGroup];
    return project.items.filter(item => {
      const query = search.toLowerCase();
      const matchSearch = !search || item.name.toLowerCase().includes(query) || item.tags.some(tag => tag.includes(query));
      const matchCategory = group.categories.length === 0 || group.categories.includes(item.category);
      return matchSearch && matchCategory;
    });
  }, [project.items, search, categoryGroup]);

  const gridItems = useMemo(() => {
    if (!selectedSlot) return displayedItems;
    const entitySpecies = activeEntity?.species ?? "";
    const isSplitLimbSlot = selectedSlot.id.includes("slot_foot_") || selectedSlot.id.includes("slot_hand_");
    return displayedItems.filter(item => {
      const slotMatch = item.allowedSlots.length === 0
        ? (isSplitLimbSlot ? false : selectedSlot.allowedCategories.some(category => item.category === category))
        : item.allowedSlots.includes(selectedSlot.id);
      const familyMatch = !template || itemSupportsTemplate(item, template);
      const speciesMatch = !entitySpecies || item.compatibility.species.length === 0 || item.compatibility.species.includes(entitySpecies);
      return slotMatch && familyMatch && speciesMatch;
    });
  }, [selectedSlot, displayedItems, template, activeEntity?.species]);

  const slotsByCategory = slots.reduce((acc, slot) => {
    const category = slot.allowedCategories[0] ?? "static_part";
    if (!acc[category]) acc[category] = [];
    acc[category].push(slot);
    return acc;
  }, {} as Record<ItemCategory, SlotDef[]>);


  return (
    <aside
      data-testid="library-panel"
      className="flex flex-col h-full bg-sidebar border-r border-sidebar-border select-none"
    >
      <div className="px-2 pt-2 pb-0 flex-shrink-0">
        <div className="grid grid-cols-2 gap-1 w-full bg-background/50 p-1">
          {(["appearance", "body", "entities", "items", "slots"] as LibraryTabId[]).map(tabId => (
            <button
              key={tabId}
              type="button"
              onClick={() => setActiveTab(tabId)}
              aria-pressed={activeTab === tabId}
              className={[
                "h-8 rounded-sm text-xs transition-colors",
                activeTab === tabId
                  ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              ].join(" ")}
            >
              {tabId === "appearance" ? "Внешность" : tabId === "entities" ? "Персонажи" : tabId === "body" ? "Части тела" : tabId === "slots" ? "Крепления" : "Экипировка"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "body" && <CharacterPartsPanel />}
      <div hidden={activeTab !== "appearance"} className={activeTab === "appearance" ? "flex flex-1 min-h-0 flex-col" : "hidden"}><AppearancePanel /></div>

      {activeTab === "entities" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-2 py-1.5 flex-shrink-0">
            <Button
              data-testid="library-new-entity"
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs border-dashed border-primary/40 text-primary hover:bg-primary/10"
              onClick={openWizard}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Создать персонажа
            </Button>
          </div>
          <div className="flex-1 overflow-auto ide-scroll">
            <div className="px-2 pb-2 space-y-1">
              {project.entities.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Нет персонажей
                </div>
              )}
              {project.entities.map(entity => {
                const resolvedTemplate = resolveTemplate(project, entity.templateId);
                const isActive = entity.id === project.activeEntityId;
                return (
                  <div
                    key={entity.id}
                    data-testid={`entity-item-${entity.id}`}
                    onClick={() => setActiveEntity(entity.id)}
                    className={[
                      "group relative flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer text-xs transition-colors",
                      isActive
                        ? "bg-primary/15 border border-primary/40 text-foreground"
                        : "hover:bg-accent text-muted-foreground hover:text-foreground border border-transparent",
                    ].join(" ")}
                  >
                    {resolvedTemplate && (
                      <div
                        className="w-8 h-8 rounded border border-border flex-shrink-0 overflow-hidden bg-background"
                        dangerouslySetInnerHTML={{ __html: sanitizeSvg(resolvedTemplate.thumbnailSvg) }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-foreground text-xs">{entity.name}</p>
                      <p className="text-muted-foreground text-[10px] truncate">
                        {resolvedTemplate ? getTemplatePresentationSummary(resolvedTemplate) : entity.entityType}
                      </p>
                    </div>
                    {isActive && <ChevronRight className="w-3 h-3 text-primary flex-shrink-0" />}
                    <button
                      onClick={event => {
                        event.stopPropagation();
                        deleteEntity(entity.id);
                      }}
                      className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all"
                      data-testid={`delete-entity-${entity.id}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "slots" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {!activeEntity ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Select an entity to view its slots.
            </div>
          ) : (
            <>
              {template && (
                <div className="px-2 pt-1.5 pb-1 flex-shrink-0 space-y-1">
                  <div className="grid grid-cols-2 gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => showAllSlotGizmos(template.id)}>Show All Slots</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => hideAllSlotGizmos(template.id)}>Hide All Slots</Button>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 w-full text-[10px]" onClick={() => unlockAllSlotGizmos(template.id)}>
                    Unlock All Slots
                  </Button>
                </div>
              )}
              <div className="flex-1 overflow-auto ide-scroll">
                <div className="px-2 py-1.5 space-y-0.5">
                  {Object.entries(slotsByCategory).map(([category, categorySlots]) => (
                    <div key={category} className="mb-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-1">
                        {CATEGORY_LABELS[category as ItemCategory] ?? category}
                      </p>
                      {categorySlots.map(slot => {
                        const assignment = activeEntity.slots.find(entry => entry.slotId === slot.id);
                        const hasItem = !!assignment?.itemId;
                        const item = hasItem ? project.items.find(projectItem => projectItem.id === assignment?.itemId) ?? null : null;
                        const isSelected = slot.id === editor.selectedSlotId;
                        const isHidden = hiddenSlotIds.has(slot.id);
                        const isLocked = lockedSlotIds.has(slot.id);
                        const hasIncompat = item && template && !itemSupportsTemplate(item, template);
                        return (
                          <div
                            key={slot.id}
                            data-testid={`slot-btn-${slot.id}`}
                            onClick={() => setSelectedSlot(isSelected ? null : slot.id)}
                            onKeyDown={event => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedSlot(isSelected ? null : slot.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className={[
                              "w-full flex items-center gap-2 rounded px-2 py-1 text-left transition-colors mb-0.5",
                              isSelected
                                ? "bg-primary/15 border border-primary/40"
                                : "hover:bg-accent border border-transparent",
                              isHidden ? "opacity-60" : "",
                            ].join(" ")}
                          >
                            <span className={`slot-chip ${hasItem ? "slot-chip-filled" : "slot-chip-empty"}`}>
                              {hasItem ? "●" : "○"}
                            </span>
                            <span className="text-xs text-foreground flex-1 truncate">{slot.name}</span>
                            {hasIncompat && <AlertTriangle className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                            {item && !hasIncompat && <span className="text-[10px] text-primary truncate max-w-[70px]">{item.name}</span>}
                            {!item && <span className="text-[10px] text-muted-foreground">{slot.required ? "Required" : "Empty"}</span>}
                            {template && (
                              <div className="ml-1 flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={event => {
                                    event.stopPropagation();
                                    setSlotGizmoHidden(template.id, slot.id, !isHidden);
                                  }}
                                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                  data-testid={`slot-hide-${slot.id}`}
                                  title={isHidden ? "Show gizmo" : "Hide gizmo"}
                                >
                                  {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={event => {
                                    event.stopPropagation();
                                    setSlotGizmoLocked(template.id, slot.id, !isLocked);
                                  }}
                                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                  data-testid={`slot-lock-${slot.id}`}
                                  title={isLocked ? "Unlock gizmo" : "Lock gizmo"}
                                >
                                  {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={event => {
                                    event.stopPropagation();
                                    updateTemplateSlotTransform(template.id, slot.id, {
                                      x: 0,
                                      y: 0,
                                      rotation: 0,
                                      scaleX: 1,
                                      scaleY: 1,
                                    });
                                  }}
                                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                  data-testid={`slot-reset-${slot.id}`}
                                  title="Reset slot transform"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "items" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeEntity?.templateId.startsWith("biped_profile_") && <Button data-testid="equip-peasant-outfit" variant="outline"
            aria-pressed={["peasant_shirt_25d", "peasant_trousers_25d", "peasant_boots_25d"].every(id => activeEntity.slots.some(slot => slot.itemId === id))}
            className="m-2 h-8 text-xs" onClick={() => {
            const slots = activeEntity.slots;
            const outfit: Record<string, string> = { side_slot_torso: "peasant_shirt_25d", side_slot_legs: "peasant_trousers_25d", side_slot_foot_l: "peasant_boots_25d" };
            const equipped = Object.entries(outfit).every(([slotId, id]) => slots.some(slot => slot.slotId === slotId && slot.itemId === id));
            useStore.getState().pushCommand({ type: "SET_SLOT", entityId: activeEntity.id, before: { slots },
              after: { slots: slots.map(slot => outfit[slot.slotId] ? { ...slot, itemId: equipped ? null : outfit[slot.slotId] } : slot) }, label: "Peasant outfit" });
          }}><Shirt size={14} className="mr-2" />Крестьянский комплект</Button>}
          <div className="px-2 pt-2 pb-1">
            <select aria-label="Место крепления" value={editor.selectedSlotId ?? ""} onChange={event => setSelectedSlot(event.target.value || null)}
              className="w-full min-w-0 h-9 rounded border border-border bg-background px-2 text-xs">
              <option value="">Место крепления</option>
              {slots.map(slot => <option key={slot.id} value={slot.id}>{slot.name}</option>)}
            </select>
          </div>
          <div className="px-2 pt-1.5 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                data-testid="library-search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Поиск предметов"
                aria-label="Поиск предметов"
                className="h-7 text-xs pl-6 bg-background border-border"
              />
            </div>
          </div>

          {selectedSlot && (
            <div className="px-2 pb-1 pt-0.5 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                  {selectedSlot.name}
                </Badge>
                <button onClick={() => setSelectedSlot(null)} title="Снять фильтр крепления" aria-label="Снять фильтр крепления" className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <div className="px-2 pb-1 flex-shrink-0">
            <div className="flex gap-0.5 flex-wrap">
              {CATEGORY_GROUPS.map((group, index) => (
                <button
                  key={group.label}
                  onClick={() => setCategoryGroup(index)}
                  aria-pressed={categoryGroup === index}
                  className={[
                    "px-1.5 py-0.5 rounded text-[10px] transition-colors",
                    categoryGroup === index
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground",
                  ].join(" ")}
                >
                  {group.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-2 pb-0.5 flex-shrink-0 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {selectedSlot ? `${gridItems.length} совместимых` : `${displayedItems.length} предметов`}
            </span>
            {selectedSlot && (
              <span className="text-[10px] text-muted-foreground">
                {CATEGORY_LABELS[selectedSlot.allowedCategories[0]]}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto ide-scroll">
            <div className="px-2 pb-2">
              {gridItems.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {project.items.length === 0 ? "Нет предметов" : selectedSlot ? "Нет совместимых предметов" : "Ничего не найдено"}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-1">
                {gridItems.map(item => {
                  const targetSlot = editor.selectedSlotId ?? template?.slots.find(slot => item.allowedSlots.includes(slot.id) && itemSupportsTemplate(item, template))?.id;
                  const assignment = activeEntity?.slots.find(slot => slot.slotId === targetSlot);
                  const isEquipped = !!activeEntity?.slots.some(slot => slot.itemId === item.id);
                  const disabled = !activeEntity || !targetSlot;
                  return (
                    <ItemCard
                      key={item.id}
                      item={item}
                      isEquipped={isEquipped}
                      isIncompat={false}
                      disabled={disabled}
                      onClick={() => {
                        if (activeEntity && targetSlot) {
                          const newItemId = assignment?.itemId === item.id ? null : item.id;
                          setEntitySlot(activeEntity.id, targetSlot, newItemId);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}


      {selectedSlotAssignment && <div className="hidden" data-testid="library-selected-slot-assignment" />}
    </aside>
  );
}
