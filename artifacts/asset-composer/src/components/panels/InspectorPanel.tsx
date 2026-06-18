import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store";
import { sanitizeSvg } from "@/lib/sanitize";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveTemplate } from "@/data/templates";
import { getStyleSetById, STYLE_SETS } from "@/data/styleSets";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { PaletteTokens, Item } from "@/domain/types";

const COMMON_SPECIES = [
  "human","elf","orc","dwarf","halfling","gnome",
  "horse","pony","ox","bear","wolf","cat","dog",
  "dragon","demon","undead","unicorn","griffon",
];


const PALETTE_LABELS: Record<keyof PaletteTokens, string> = {
  skin: "Skin",
  hair: "Hair",
  primaryCloth: "Primary Cloth",
  secondaryCloth: "Secondary Cloth",
  metal: "Metal",
  accent: "Accent",
  outline: "Outline",
  shadow: "Shadow",
};

// Skeleton family display names
const FAMILY_LABELS: Record<string, string> = {
  humanoid_topdown_v1: "Humanoid (Top-down)",
  humanoid_side_v1:    "Humanoid (Side)",
  quadruped_side_v1:   "Quadruped",
  bird_side_v1:        "Bird",
  humanoid_monster_v1: "Monster",
  siege_static_v1:     "Siege/Static",
};

interface CompatWarning {
  itemName: string;
  slotName: string;
  message: string;
  severity: "error" | "warning";
}

function TransactionalNumberInput({
  value,
  step = 0.1,
  testId,
  onBeginEdit,
  onPreview,
  onCommit,
  onCancel,
}: {
  value: number;
  step?: number;
  testId: string;
  onBeginEdit?: () => void;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(String(Number.isFinite(value) ? value : 0));
  const editingRef = useRef(false);
  const initialValueRef = useRef(value);
  const draftRef = useRef(draft);

  useEffect(() => {
    if (editingRef.current) return;
    setDraft(String(Number.isFinite(value) ? value : 0));
    draftRef.current = String(Number.isFinite(value) ? value : 0);
    initialValueRef.current = value;
  }, [value]);

  function commitDraft() {
    const nextText = draftRef.current;
    const next = Number(nextText);
    if (!Number.isFinite(next)) return;
    onCommit(next);
    editingRef.current = false;
    setDraft(String(next));
    draftRef.current = String(next);
    initialValueRef.current = next;
  }

  function cancelDraft() {
    editingRef.current = false;
    const initial = initialValueRef.current;
    setDraft(String(initial));
    draftRef.current = String(initial);
    onPreview(initial);
    onCancel();
  }

  useEffect(() => {
    return () => {
      if (editingRef.current) {
        commitDraft();
      }
    };
  }, []);

  return (
    <Input
      data-testid={testId}
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={() => {
        editingRef.current = true;
        initialValueRef.current = value;
        setDraft(String(Number.isFinite(value) ? value : 0));
        draftRef.current = String(Number.isFinite(value) ? value : 0);
        onBeginEdit?.();
      }}
      onChange={e => {
        editingRef.current = true;
        const nextText = e.target.value;
        setDraft(nextText);
        draftRef.current = nextText;
        const next = Number(nextText);
        if (Number.isFinite(next)) {
          onPreview(next);
        }
      }}
      onBlur={() => commitDraft()}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitDraft();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancelDraft();
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const current = Number(draft);
          const base = Number.isFinite(current) ? current : initialValueRef.current;
          const delta = (e.shiftKey ? step * 10 : e.altKey ? step * 0.1 : step) * (e.key === "ArrowUp" ? 1 : -1);
          const next = Number((base + delta).toFixed(4));
          setDraft(String(next));
          onPreview(next);
        }
      }}
      className="h-6 text-[11px] bg-background border-border"
    />
  );
}

function toColorInputValue(hex: string): string {
  const normalized = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-fA-F]{8}$/.test(normalized)) return normalized.slice(0, 7);
  return "#000000";
}

function mergeColorWithExistingAlpha(nextHex: string, previousHex: string): string {
  if (/^#[0-9a-fA-F]{8}$/.test(previousHex)) {
    return `${nextHex}${previousHex.slice(7, 9)}`;
  }
  return nextHex;
}

export function InspectorPanel() {
  const project              = useStore(s => s.project);
  const editor               = useStore(s => s.editor);
  const renameEntity         = useStore(s => s.renameEntity);
  const setEntityPaletteToken = useStore(s => s.setEntityPaletteToken);
  const setEntityStyleSet    = useStore(s => s.setEntityStyleSet);
  const setEntitySlot        = useStore(s => s.setEntitySlot);
  const setAttachmentOverride = useStore(s => s.setAttachmentOverride);
  const removeEntityVisual   = useStore(s => s.removeEntityVisual);
  const updateTemplateSlotTransform = useStore(s => s.updateTemplateSlotTransform);
  const getActiveEntity      = useStore(s => s.getActiveEntity);

  const setEntitySpecies = useStore(s => s.setEntitySpecies);

  const activeEntity = getActiveEntity();
  const template     = activeEntity ? resolveTemplate(project, activeEntity.templateId) : undefined;
  const styleSet     = activeEntity ? getStyleSetById(activeEntity.styleSetId) : undefined;
  const entityFamily = template?.skeletonFamily ?? null;

  const [editingName,    setEditingName]    = useState(false);
  const [nameValue,      setNameValue]      = useState("");
  const [speciesValue,   setSpeciesValue]   = useState("");
  const [editingSpecies, setEditingSpecies] = useState(false);

  const selectedSlotId =
    editor.selection.kind === "item-part" || editor.selection.kind === "template-slot"
      ? editor.selection.slotId
      : editor.selectedSlotId;
  const selectedAssign   = activeEntity?.slots.find(s => s.slotId === selectedSlotId);
  const selectedItem     = selectedAssign?.itemId
    ? (project.items.find(i => i.id === selectedAssign.itemId) as Item | undefined)
    : undefined;
  const selectedSlotDef  = template?.slots.find(s => s.id === selectedSlotId);
  const selection = editor.selection;
  const selectedEntityVisual = selection.kind === "entity-visual"
    ? activeEntity?.visuals?.find(v => v.id === selection.visualId)
    : undefined;
  const selectedBone = selection.kind === "bone"
    ? template?.bones.find(bone => bone.id === selection.boneId)
    : undefined;
  const selectedAnchor = selection.kind === "anchor"
    ? template?.anchors?.[selection.anchorId]
    : undefined;
  const attachmentValues = {
    offsetX: selectedAssign?.attachmentOverride?.offsetX ?? 0,
    offsetY: selectedAssign?.attachmentOverride?.offsetY ?? 0,
    rotation: selectedAssign?.attachmentOverride?.rotation ?? 0,
    scaleX: selectedAssign?.attachmentOverride?.scaleX ?? 1,
    scaleY: selectedAssign?.attachmentOverride?.scaleY ?? 1,
  };
  const slotTransformValues = {
    x: selectedSlotDef?.defaultTransform?.x ?? 0,
    y: selectedSlotDef?.defaultTransform?.y ?? 0,
    rotation: selectedSlotDef?.defaultTransform?.rotation ?? 0,
    scaleX: selectedSlotDef?.defaultTransform?.scaleX ?? 1,
    scaleY: selectedSlotDef?.defaultTransform?.scaleY ?? 1,
  };
  const visualValues = selectedEntityVisual?.localTransform ?? {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
  const attachmentBeforeRef = useRef(attachmentValues);
  const slotBeforeRef = useRef(slotTransformValues);
  const visualBeforeRef = useRef(visualValues);

  if (!activeEntity) {
    return (
      <aside
        data-testid="inspector-panel"
        className="flex flex-col h-full bg-sidebar border-l border-sidebar-border"
      >
        <div className="px-3 py-2 border-b border-border flex-shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inspector</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground text-center px-4">
            Select an entity to inspect its properties.
          </p>
        </div>
      </aside>
    );
  }

  // Build equipped item list
  const equippedSlots = activeEntity.slots.filter(s => s.itemId !== null);
  const equippedItems = equippedSlots.map(s => ({
    slot: template?.slots.find(sl => sl.id === s.slotId),
    item: project.items.find(i => i.id === s.itemId) as Item | undefined,
    assignment: s,
  })).filter(x => x.slot && x.item);

  // Compatibility analysis
  const entitySpecies = activeEntity.species ?? "";
  const compatWarnings: CompatWarning[] = [];
  if (entityFamily) {
    // Required slots with no item
    template?.slots.filter(s => s.required).forEach(slot => {
      const assignment = activeEntity.slots.find(a => a.slotId === slot.id);
      if (!assignment?.itemId) {
        compatWarnings.push({
          itemName: "",
          slotName: slot.name,
          message: `Required slot "${slot.name}" is empty.`,
          severity: "error",
        });
      }
    });
    // Items incompatible with entity skeleton family
    equippedItems.forEach(({ slot, item }) => {
      if (!item || !slot) return;
      const families = item.compatibility.skeletonFamilies;
      if (families.length > 0 && !families.includes(entityFamily)) {
        compatWarnings.push({
          itemName: item.name,
          slotName: slot.name,
          message: `"${item.name}" is not designed for ${FAMILY_LABELS[entityFamily] ?? entityFamily}.`,
          severity: "warning",
        });
      }
    });
  }
  // Items incompatible with entity species (if species is set)
  if (entitySpecies) {
    equippedItems.forEach(({ slot, item }) => {
      if (!item || !slot) return;
      const sp = item.compatibility.species;
      if (sp.length > 0 && !sp.includes(entitySpecies)) {
        compatWarnings.push({
          itemName: item.name,
          slotName: slot.name,
          message: `"${item.name}" has no variant for species "${entitySpecies}" (supports: ${sp.slice(0, 3).join(", ")}${sp.length > 3 ? "…" : ""}).`,
          severity: "warning",
        });
      }
    });
  }

  // Keep slot-derived UI aligned with the actual active selection.

  function buildAttachmentOverride(values: typeof attachmentValues) {
    return {
      anchorId: selectedAssign?.attachmentOverride.anchorId ?? "",
      bindMode: selectedAssign?.attachmentOverride.bindMode ?? "",
      offsetX: values.offsetX,
      offsetY: values.offsetY,
      rotation: values.rotation,
      scaleX: values.scaleX,
      scaleY: values.scaleY,
    };
  }

  function patchAttachment<K extends keyof typeof attachmentValues>(key: K, value: number) {
    if (!activeEntity || !selectedSlotDef || !selectedAssign) return;
    setAttachmentOverride(activeEntity.id, selectedSlotDef.id, { [key]: value });
  }

  function commitAttachmentField<K extends keyof typeof attachmentValues>(key: K, value: number) {
    if (!activeEntity || !selectedSlotDef || !selectedAssign) return;
    const beforeFull = buildAttachmentOverride(attachmentBeforeRef.current);
    const afterFull = buildAttachmentOverride({
      ...attachmentValues,
      [key]: value,
    });
    useStore.getState().commitAttachmentOverride(activeEntity.id, selectedSlotDef.id, beforeFull, afterFull);
  }

  function patchSlotTransform<K extends keyof typeof slotTransformValues>(key: K, value: number) {
    if (!template || !selectedSlotDef) return;
    updateTemplateSlotTransform(template.id, selectedSlotDef.id, {
      ...slotTransformValues,
      [key]: value,
    });
  }

  function commitSlotField<K extends keyof typeof slotTransformValues>(key: K, value: number) {
    if (!template || !selectedSlotDef) return;
    useStore.getState().commitTemplateSlotTransform(template.id, selectedSlotDef.id, slotBeforeRef.current, {
      ...slotTransformValues,
      [key]: value,
    });
  }

  function patchVisualTransform<K extends keyof typeof visualValues>(key: K, value: number) {
    if (!activeEntity || !selectedEntityVisual) return;
    useStore.getState().previewEntityVisualTransform(activeEntity.id, selectedEntityVisual.id, {
      ...visualBeforeRef.current,
      [key]: value,
    });
  }

  function commitVisualField<K extends keyof typeof visualValues>(key: K, value: number) {
    if (!activeEntity || !selectedEntityVisual) return;
    useStore.getState().commitEntityVisualTransform(activeEntity.id, selectedEntityVisual.id, visualBeforeRef.current, {
      ...visualValues,
      [key]: value,
    });
  }

  return (
    <aside
      data-testid="inspector-panel"
      className="flex flex-col h-full bg-sidebar border-l border-sidebar-border"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inspector</span>
      </div>

      <ScrollArea className="flex-1 ide-scroll">
        <div className="p-3 space-y-4">
          {/* Entity name */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Name</Label>
            {editingName ? (
              <Input
                data-testid="inspector-name-input"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={() => { renameEntity(activeEntity.id, nameValue || activeEntity.name); setEditingName(false); }}
                onKeyDown={e => {
                  if (e.key === "Enter") { renameEntity(activeEntity.id, nameValue || activeEntity.name); setEditingName(false); }
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="h-7 text-xs bg-background border-border"
                autoFocus
              />
            ) : (
              <p
                className="text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => { setNameValue(activeEntity.name); setEditingName(true); }}
                data-testid="inspector-name"
              >
                {activeEntity.name}
              </p>
            )}
          </div>

          {/* Template info */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Template</Label>
            <div className="flex items-center gap-2">
              {template && (
                <div
                  className="w-8 h-8 rounded border border-border flex-shrink-0 overflow-hidden bg-background"
                  dangerouslySetInnerHTML={{ __html: sanitizeSvg(template.thumbnailSvg) }}
                />
              )}
              <div>
                <p className="text-xs text-foreground">{template?.name ?? activeEntity.templateId}</p>
                <p className="text-[10px] text-muted-foreground">{FAMILY_LABELS[template?.skeletonFamily ?? ""] ?? template?.viewProfile}</p>
              </div>
            </div>
          </div>

          {/* Species */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Species
              <span className="ml-1 text-muted-foreground/50 normal-case font-normal">(affects item filtering)</span>
            </Label>
            {editingSpecies ? (
              <div className="space-y-1">
                <Input
                  data-testid="inspector-species-input"
                  value={speciesValue}
                  onChange={e => setSpeciesValue(e.target.value)}
                  onBlur={() => {
                    setEntitySpecies(activeEntity.id, speciesValue.trim().toLowerCase());
                    setEditingSpecies(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") { setEntitySpecies(activeEntity.id, speciesValue.trim().toLowerCase()); setEditingSpecies(false); }
                    if (e.key === "Escape") setEditingSpecies(false);
                  }}
                  placeholder="e.g. horse, human, dragon…"
                  className="h-6 text-xs bg-background border-border"
                  autoFocus
                  list="species-suggestions"
                />
                <datalist id="species-suggestions">
                  {COMMON_SPECIES.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            ) : (
              <p
                className="text-xs text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => { setSpeciesValue(activeEntity.species ?? ""); setEditingSpecies(true); }}
                data-testid="inspector-species"
              >
                {activeEntity.species ? activeEntity.species : <span className="text-muted-foreground italic">Not set — click to add</span>}
              </p>
            )}
          </div>

          <Separator className="bg-border" />

          {/* ── Compatibility panel ── */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Compatibility
              {compatWarnings.length > 0 && (
                <span className="ml-1.5 text-yellow-500">({compatWarnings.length})</span>
              )}
            </Label>

            {compatWarnings.length === 0 ? (
              <div className="flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                All slots compatible
              </div>
            ) : (
              <div className="space-y-1">
                {compatWarnings.map((w, i) => (
                  <div
                    key={i}
                    className={[
                      "flex items-start gap-1.5 rounded px-2 py-1.5 text-[10px]",
                      w.severity === "error"
                        ? "bg-destructive/10 border border-destructive/30 text-destructive"
                        : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
                    ].join(" ")}
                  >
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Selected slot item detail ── */}
          {selectedSlotDef && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Selected Slot: {selectedSlotDef.name}
                </Label>
                {selectedItem ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded border border-border overflow-hidden bg-background flex-shrink-0">
                        {selectedItem.svgLayers[0] && (
                          <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: sanitizeSvg(selectedItem.svgLayers[0].svgData) }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{selectedItem.name}</p>
                        <p className="text-[10px] text-muted-foreground">{selectedItem.description}</p>
                      </div>
                    </div>
                    {/* Item compatibility info */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">Supports families:</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedItem.compatibility.skeletonFamilies.length === 0 ? (
                          <Badge variant="outline" className="text-[9px]">All</Badge>
                        ) : selectedItem.compatibility.skeletonFamilies.map(f => {
                          const isMatch = f === entityFamily;
                          return (
                            <Badge
                              key={f}
                              variant="outline"
                              className={`text-[9px] ${isMatch ? "border-green-500/50 text-green-600 dark:text-green-400" : "border-border text-muted-foreground"}`}
                            >
                              {FAMILY_LABELS[f] ?? f}
                            </Badge>
                          );
                        })}
                      </div>
                      {selectedItem.tags.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {selectedItem.tags.map(tag => (
                            <span key={tag} className="text-[8px] bg-accent/40 rounded px-1 py-0.5 text-muted-foreground">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Unequip */}
                    <button
                      onClick={() => setEntitySlot(activeEntity.id, selectedSlotDef.id, null)}
                      className="text-[10px] text-destructive/70 hover:text-destructive transition-colors flex items-center gap-1"
                    >
                      <span>× Unequip</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Info className="w-3 h-3" />
                    Empty slot — pick an item from the Items tab.
                  </div>
                )}
              </div>
            </>
          )}

          {selectedSlotDef && selection.kind === "item-part" && selection.slotId === selectedSlotDef.id && selectedAssign && selectedItem && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Attachment Transform
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">X</label>
                    <TransactionalNumberInput
                      testId="inspector-attach-x"
                      value={attachmentValues.offsetX}
                      onBeginEdit={() => { attachmentBeforeRef.current = attachmentValues; }}
                      onPreview={v => patchAttachment("offsetX", v)}
                      onCommit={v => commitAttachmentField("offsetX", v)}
                      onCancel={() => patchAttachment("offsetX", attachmentBeforeRef.current.offsetX)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Y</label>
                    <TransactionalNumberInput
                      testId="inspector-attach-y"
                      value={attachmentValues.offsetY}
                      onBeginEdit={() => { attachmentBeforeRef.current = attachmentValues; }}
                      onPreview={v => patchAttachment("offsetY", v)}
                      onCommit={v => commitAttachmentField("offsetY", v)}
                      onCancel={() => patchAttachment("offsetY", attachmentBeforeRef.current.offsetY)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Rotation</label>
                    <TransactionalNumberInput
                      testId="inspector-attach-rotation"
                      value={attachmentValues.rotation}
                      onBeginEdit={() => { attachmentBeforeRef.current = attachmentValues; }}
                      onPreview={v => patchAttachment("rotation", v)}
                      onCommit={v => commitAttachmentField("rotation", v)}
                      onCancel={() => patchAttachment("rotation", attachmentBeforeRef.current.rotation)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale X</label>
                    <TransactionalNumberInput
                      testId="inspector-attach-scale-x"
                      value={attachmentValues.scaleX}
                      onBeginEdit={() => { attachmentBeforeRef.current = attachmentValues; }}
                      onPreview={v => patchAttachment("scaleX", v)}
                      onCommit={v => commitAttachmentField("scaleX", v)}
                      onCancel={() => patchAttachment("scaleX", attachmentBeforeRef.current.scaleX)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale Y</label>
                    <TransactionalNumberInput
                      testId="inspector-attach-scale-y"
                      value={attachmentValues.scaleY}
                      onBeginEdit={() => { attachmentBeforeRef.current = attachmentValues; }}
                      onPreview={v => patchAttachment("scaleY", v)}
                      onCommit={v => commitAttachmentField("scaleY", v)}
                      onCancel={() => patchAttachment("scaleY", attachmentBeforeRef.current.scaleY)}
                    />
                  </div>
                </div>
                <button
                  onClick={() => setAttachmentOverride(activeEntity.id, selectedSlotDef.id, {
                    offsetX: 0,
                    offsetY: 0,
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                  })}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Reset attachment transform
                </button>
                <button
                  onClick={() => setAttachmentOverride(activeEntity.id, selectedSlotDef.id, {
                    scaleX: -Math.abs(attachmentValues.scaleX || 1),
                  })}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Flip X
                </button>
                <button
                  onClick={() => setAttachmentOverride(activeEntity.id, selectedSlotDef.id, {
                    scaleX: 1,
                    scaleY: 1,
                  })}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Reset Scale
                </button>
                <button
                  onClick={() => setEntitySlot(activeEntity.id, selectedSlotDef.id, null)}
                  className="text-[10px] text-destructive/70 hover:text-destructive transition-colors flex items-center gap-1"
                >
                  <span>Remove from character</span>
                </button>
              </div>
            </>
          )}

          {selectedSlotDef && selection.kind === "template-slot" && template && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Slot Transform
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">X</label>
                    <TransactionalNumberInput
                      testId="inspector-slot-x"
                      value={slotTransformValues.x}
                      onBeginEdit={() => { slotBeforeRef.current = slotTransformValues; }}
                      onPreview={v => patchSlotTransform("x", v)}
                      onCommit={v => commitSlotField("x", v)}
                      onCancel={() => patchSlotTransform("x", slotBeforeRef.current.x)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Y</label>
                    <TransactionalNumberInput
                      testId="inspector-slot-y"
                      value={slotTransformValues.y}
                      onBeginEdit={() => { slotBeforeRef.current = slotTransformValues; }}
                      onPreview={v => patchSlotTransform("y", v)}
                      onCommit={v => commitSlotField("y", v)}
                      onCancel={() => patchSlotTransform("y", slotBeforeRef.current.y)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Rotation</label>
                    <TransactionalNumberInput
                      testId="inspector-slot-rotation"
                      value={slotTransformValues.rotation}
                      onBeginEdit={() => { slotBeforeRef.current = slotTransformValues; }}
                      onPreview={v => patchSlotTransform("rotation", v)}
                      onCommit={v => commitSlotField("rotation", v)}
                      onCancel={() => patchSlotTransform("rotation", slotBeforeRef.current.rotation)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale X</label>
                    <TransactionalNumberInput
                      testId="inspector-slot-scale-x"
                      value={slotTransformValues.scaleX}
                      onBeginEdit={() => { slotBeforeRef.current = slotTransformValues; }}
                      onPreview={v => patchSlotTransform("scaleX", v)}
                      onCommit={v => commitSlotField("scaleX", v)}
                      onCancel={() => patchSlotTransform("scaleX", slotBeforeRef.current.scaleX)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale Y</label>
                    <TransactionalNumberInput
                      testId="inspector-slot-scale-y"
                      value={slotTransformValues.scaleY}
                      onBeginEdit={() => { slotBeforeRef.current = slotTransformValues; }}
                      onPreview={v => patchSlotTransform("scaleY", v)}
                      onCommit={v => commitSlotField("scaleY", v)}
                      onCancel={() => patchSlotTransform("scaleY", slotBeforeRef.current.scaleY)}
                    />
                  </div>
                </div>
                <button
                  onClick={() => updateTemplateSlotTransform(template.id, selectedSlotDef.id, {
                    x: 0,
                    y: 0,
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                  })}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Reset slot transform
                </button>
              </div>
            </>
          )}

          {selection.kind === "entity-visual" && selectedEntityVisual && template && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Entity Visual
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">X</label>
                    <TransactionalNumberInput
                      testId="inspector-visual-x"
                      value={visualValues.x}
                      onBeginEdit={() => { visualBeforeRef.current = visualValues; }}
                      onPreview={v => patchVisualTransform("x", v)}
                      onCommit={v => commitVisualField("x", v)}
                      onCancel={() => patchVisualTransform("x", visualBeforeRef.current.x)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Y</label>
                    <TransactionalNumberInput
                      testId="inspector-visual-y"
                      value={visualValues.y}
                      onBeginEdit={() => { visualBeforeRef.current = visualValues; }}
                      onPreview={v => patchVisualTransform("y", v)}
                      onCommit={v => commitVisualField("y", v)}
                      onCancel={() => patchVisualTransform("y", visualBeforeRef.current.y)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Rotation</label>
                    <TransactionalNumberInput
                      testId="inspector-visual-rotation"
                      value={visualValues.rotation}
                      onBeginEdit={() => { visualBeforeRef.current = visualValues; }}
                      onPreview={v => patchVisualTransform("rotation", v)}
                      onCommit={v => commitVisualField("rotation", v)}
                      onCancel={() => patchVisualTransform("rotation", visualBeforeRef.current.rotation)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale X</label>
                    <TransactionalNumberInput
                      testId="inspector-visual-scale-x"
                      value={visualValues.scaleX}
                      onBeginEdit={() => { visualBeforeRef.current = visualValues; }}
                      onPreview={v => patchVisualTransform("scaleX", v)}
                      onCommit={v => commitVisualField("scaleX", v)}
                      onCancel={() => patchVisualTransform("scaleX", visualBeforeRef.current.scaleX)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale Y</label>
                    <TransactionalNumberInput
                      testId="inspector-visual-scale-y"
                      value={visualValues.scaleY}
                      onBeginEdit={() => { visualBeforeRef.current = visualValues; }}
                      onPreview={v => patchVisualTransform("scaleY", v)}
                      onCommit={v => commitVisualField("scaleY", v)}
                      onCancel={() => patchVisualTransform("scaleY", visualBeforeRef.current.scaleY)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Z Index</label>
                    <Input
                      data-testid="inspector-visual-zindex"
                      type="number"
                      value={selectedEntityVisual.zIndex}
                      readOnly
                      className="h-6 text-[11px] bg-background border-border"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="text-[10px] text-primary hover:text-primary/80 transition-colors">
                    Edit Source Asset
                  </button>
                  <button
                    onClick={() => removeEntityVisual(activeEntity.id, selectedEntityVisual.id)}
                    className="text-[10px] text-destructive/70 hover:text-destructive transition-colors"
                  >
                    Detach Source
                  </button>
                </div>
              </div>
            </>
          )}

          {selection.kind === "bone" && selectedBone && template && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Bone
                </Label>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex justify-between"><span>Bone ID</span><span className="text-foreground">{selectedBone.id}</span></div>
                  <div className="flex justify-between"><span>Name</span><span className="text-foreground">{selectedBone.name}</span></div>
                  <div className="flex justify-between"><span>Parent</span><span className="text-foreground">{selectedBone.parentId ?? "none"}</span></div>
                  <div className="flex justify-between"><span>Rest TX</span><span className="text-foreground">{selectedBone.restPose.tx}</span></div>
                  <div className="flex justify-between"><span>Rest TY</span><span className="text-foreground">{selectedBone.restPose.ty}</span></div>
                  <div className="flex justify-between"><span>Rest Rotation</span><span className="text-foreground">{selectedBone.restPose.rotation}</span></div>
                  <div className="flex justify-between"><span>Rest Scale X</span><span className="text-foreground">{selectedBone.restPose.scaleX}</span></div>
                  <div className="flex justify-between"><span>Rest Scale Y</span><span className="text-foreground">{selectedBone.restPose.scaleY}</span></div>
                  <div className="flex justify-between"><span>Length</span><span className="text-foreground">{selectedBone.length}</span></div>
                  <div className="flex justify-between"><span>Assigned Parts</span><span className="text-foreground">{template.boneParts?.filter(part => part.boneId === selectedBone.id).length ?? 0}</span></div>
                </div>
              </div>
            </>
          )}

          {selection.kind === "anchor" && selectedAnchor && template && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Anchor
                </Label>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex justify-between"><span>Anchor ID</span><span className="text-foreground">{selectedAnchor.id}</span></div>
                  <div className="flex justify-between"><span>Bone</span><span className="text-foreground">{selectedAnchor.boneId}</span></div>
                  <div className="flex justify-between"><span>Offset X</span><span className="text-foreground">{selectedAnchor.offsetX}</span></div>
                  <div className="flex justify-between"><span>Offset Y</span><span className="text-foreground">{selectedAnchor.offsetY}</span></div>
                  <div className="flex justify-between"><span>Rotation</span><span className="text-foreground">{selectedAnchor.rotation}</span></div>
                  <div className="flex justify-between"><span>Usage</span><span className="text-foreground">{template.slots.filter(slot => slot.defaultAnchorId === selectedAnchor.id).length}</span></div>
                </div>
              </div>
            </>
          )}

          <Separator className="bg-border" />

          {/* Palette tokens */}
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Palette</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(activeEntity.palette) as (keyof PaletteTokens)[]).map(token => (
                <div key={token} className="space-y-0.5">
                  <label className="text-[10px] text-muted-foreground">{PALETTE_LABELS[token]}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      data-testid={`palette-${token}`}
                      value={toColorInputValue(activeEntity.palette[token])}
                      onChange={e =>
                        setEntityPaletteToken(
                          activeEntity.id,
                          token,
                          mergeColorWithExistingAlpha(e.target.value, activeEntity.palette[token]),
                        )
                      }
                      className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                      title={PALETTE_LABELS[token]}
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {activeEntity.palette[token]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Equipped items summary */}
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Equipped ({equippedItems.length})
            </Label>
            {equippedItems.length === 0 && (
              <p className="text-xs text-muted-foreground">No items equipped. Use the Slots tab to equip items.</p>
            )}
            <div className="space-y-1">
              {equippedItems.map(({ slot, item }) => {
                const isIncompat = item && entityFamily &&
                  item.compatibility.skeletonFamilies.length > 0 &&
                  !item.compatibility.skeletonFamilies.includes(entityFamily);
                return (
                  <div
                    key={slot!.id}
                    className={[
                      "flex items-center gap-2 rounded border px-2 py-1.5",
                      isIncompat
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-border bg-accent/30",
                    ].join(" ")}
                  >
                    <div className="w-6 h-6 rounded border border-border overflow-hidden bg-background flex-shrink-0">
                      {item!.svgLayers[0] && (
                        <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: sanitizeSvg(item!.svgLayers[0].svgData) }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{item!.name}</p>
                      <p className="text-[10px] text-muted-foreground">{slot!.name}</p>
                    </div>
                    {isIncompat && <AlertTriangle className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Per-entity StyleSet override */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Style Set
              <span className="ml-1 text-muted-foreground/50 normal-case font-normal">(this entity only)</span>
            </Label>
            <Select
              value={activeEntity.styleSetId}
              onValueChange={id => setEntityStyleSet(activeEntity.id, id)}
            >
              <SelectTrigger
                data-testid="inspector-styleset-select"
                className="h-7 text-xs bg-background border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_SETS.map(ss => (
                  <SelectItem key={ss.id} value={ss.id} className="text-xs">
                    {ss.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Overrides the scene style for this entity. Use the toolbar to reset all entities at once.
            </p>
          </div>

          <Separator className="bg-border" />

          {/* Metadata */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Metadata</Label>
            <div className="space-y-1 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>ID</span>
                <span className="font-mono text-foreground text-[9px]">{activeEntity.id.slice(0, 8)}…</span>
              </div>
              <div className="flex justify-between">
                <span>Created</span>
                <span className="text-foreground">{new Date(activeEntity.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>License</span>
                <span className="text-foreground">{activeEntity.licenseMeta.licenseType}</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
