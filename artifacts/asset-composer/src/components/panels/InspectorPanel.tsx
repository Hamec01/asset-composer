import { useState } from "react";
import { useStore } from "@/store";
import { sanitizeSvg } from "@/lib/sanitize";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTemplateById } from "@/data/templates";
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

export function InspectorPanel() {
  const project              = useStore(s => s.project);
  const editor               = useStore(s => s.editor);
  const renameEntity         = useStore(s => s.renameEntity);
  const setEntityPaletteToken = useStore(s => s.setEntityPaletteToken);
  const setEntityStyleSet    = useStore(s => s.setEntityStyleSet);
  const setEntitySlot        = useStore(s => s.setEntitySlot);
  const getActiveEntity      = useStore(s => s.getActiveEntity);

  const setEntitySpecies = useStore(s => s.setEntitySpecies);

  const activeEntity = getActiveEntity();
  const template     = activeEntity ? getTemplateById(activeEntity.templateId) : undefined;
  const styleSet     = activeEntity ? getStyleSetById(activeEntity.styleSetId) : undefined;
  const entityFamily = template?.skeletonFamily ?? null;

  const [editingName,    setEditingName]    = useState(false);
  const [nameValue,      setNameValue]      = useState("");
  const [speciesValue,   setSpeciesValue]   = useState("");
  const [editingSpecies, setEditingSpecies] = useState(false);

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

  // Currently selected slot item
  const selectedSlotId   = editor.selectedSlotId;
  const selectedAssign   = activeEntity.slots.find(s => s.slotId === selectedSlotId);
  const selectedItem     = selectedAssign?.itemId
    ? (project.items.find(i => i.id === selectedAssign.itemId) as Item | undefined)
    : undefined;
  const selectedSlotDef  = template?.slots.find(s => s.id === selectedSlotId);

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
                      value={activeEntity.palette[token]}
                      onChange={e => setEntityPaletteToken(activeEntity.id, token, e.target.value)}
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
