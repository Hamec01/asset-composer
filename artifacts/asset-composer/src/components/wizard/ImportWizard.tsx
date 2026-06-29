import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { useStore } from "@/store";
import { resolveTemplate } from "@/data/templates";
import {
  buildImportedProjectItem,
  buildImportedItemPart,
  inferImportedPartDefaults,
  type ImportPartRole,
  makeImportedAssetSource,
  makeImportedItemId,
  resolveImportedPartRole,
  wrapRasterDataUriAsSvg,
} from "@/lib/assetImport";
import { buildImportedEntityVisual, getDefaultImportPivot } from "@/lib/entityVisualImport";
import { createDocumentFromEntityVisual, createDocumentFromItemPart } from "@/lib/spriteEditor";
import type {
  EntityVisual,
  ImportedAssetSource,
  ItemCategory,
  SlotDef,
  Template,
  VectorAssetMetrics,
} from "@/domain/types";
import { getVisibleTemplateSlots } from "@/lib/slotVisibility";
import { parseMetrics } from "@/lib/svgMetrics";

type ImportTarget = "custom_item" | "entity_visual";
type VisualMode = "full_vector" | "bone_part";

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
  static_part: "Static Part",
};

interface Props {
  open: boolean;
  onClose: () => void;
  activeEntityId: string | null;
}

interface ImportedAssetDraft {
  id: string;
  fileName: string;
  displayName: string;
  role: ImportPartRole;
  source: ImportedAssetSource;
  svgData: string;
  metrics: VectorAssetMetrics;
  boneId: string;
  pivotX: number;
  pivotY: number;
  zOffset: number;
}

const PART_ROLE_LABELS: Record<ImportPartRole, string> = {
  auto: "Auto",
  center: "Center",
  front: "Front",
  back: "Back",
  head: "Head",
  neck: "Neck",
  chest: "Chest",
  spine: "Back / Spine",
  pelvis: "Pelvis / Waist",
  shoulder_l: "Left Shoulder",
  shoulder_r: "Right Shoulder",
  hand_l: "Left Hand",
  hand_r: "Right Hand",
  hip_l: "Left Hip",
  hip_r: "Right Hip",
  knee_l: "Left Knee / Shin",
  knee_r: "Right Knee / Shin",
  foot_l: "Left Foot",
  foot_r: "Right Foot",
};

interface WizardState {
  step: 1 | 2 | 3;
  target: ImportTarget;
  visualMode: VisualMode;
  itemName: string;
  itemDescription: string;
  category: ItemCategory;
  slotId: string;
  visualBoneId: string;
  visualZIndex: number;
  assets: ImportedAssetDraft[];
  error: string | null;
}

function getDefaultCategory(slot?: SlotDef): ItemCategory {
  return slot?.allowedCategories[0] ?? "static_part";
}

function getSlotBoneId(slot?: SlotDef): string {
  return slot?.boneId ?? "root";
}

function createDefaultState(slot?: SlotDef): WizardState {
  const category = getDefaultCategory(slot);
  return {
    step: 1,
    target: "custom_item",
    visualMode: "full_vector",
    itemName: "",
    itemDescription: "",
    category,
    slotId: slot?.id ?? "",
    visualBoneId: getSlotBoneId(slot),
    visualZIndex: (slot?.zIndex ?? 100) + 1,
    assets: [],
    error: null,
  };
}

function sanitizeName(fileName: string): string {
  return fileName.replace(/\.(svg|png)$/i, "").replace(/[_-]/g, " ").trim();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function loadRasterDimensions(dataUri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({
      width: img.naturalWidth || img.width || 64,
      height: img.naturalHeight || img.height || 64,
    });
    img.onerror = () => reject(new Error("Failed to inspect PNG dimensions"));
    img.src = dataUri;
  });
}

async function fileToAssetDraft(
  file: File,
  defaultBoneId: string,
): Promise<ImportedAssetDraft> {
  const displayName = sanitizeName(file.name) || "Imported Asset";
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    const svgData = await file.text();
    const metrics = parseMetrics(svgData);
    const pivot = getDefaultImportPivot(svgData, "center");
    return {
      id: crypto.randomUUID(),
      fileName: file.name,
      displayName,
      role: "auto",
      source: makeImportedAssetSource({
        format: "svg",
        name: displayName,
        originalFileName: file.name,
        mimeType: file.type || "image/svg+xml",
      }),
      svgData,
      metrics,
      boneId: defaultBoneId,
      pivotX: pivot.x,
      pivotY: pivot.y,
      zOffset: 0,
    };
  }

  if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
    const dataUri = await readFileAsDataUrl(file);
    const { width, height } = await loadRasterDimensions(dataUri);
    const svgData = wrapRasterDataUriAsSvg(dataUri, width, height);
    const metrics = parseMetrics(svgData);
    const pivot = getDefaultImportPivot(svgData, "center");
    return {
      id: crypto.randomUUID(),
      fileName: file.name,
      displayName,
      role: "auto",
      source: makeImportedAssetSource({
        format: "png",
        name: displayName,
        originalFileName: file.name,
        mimeType: file.type || "image/png",
        dataUri,
      }),
      svgData,
      metrics,
      boneId: defaultBoneId,
      pivotX: pivot.x,
      pivotY: pivot.y,
      zOffset: 0,
    };
  }

  throw new Error(`${file.name}: only SVG and PNG are supported.`);
}

function getRoleOptions(category: ItemCategory): ImportPartRole[] {
  switch (category) {
    case "hair":
      return ["auto", "front", "back", "head"];
    case "eyes":
    case "face":
    case "beard":
    case "head_cover":
      return ["auto", "head", "front", "back"];
    case "neck":
    case "amulet":
      return ["auto", "neck", "head", "chest"];
    case "torso":
    case "arms":
    case "cloak":
      return ["auto", "chest", "back", "spine", "shoulder_l", "shoulder_r", "hand_l", "hand_r"];
    case "hands":
    case "weapon_main":
    case "weapon_off":
    case "shield":
    case "ring":
      return ["auto", "hand_l", "hand_r", "center"];
    case "waist":
    case "legs":
    case "feet":
      return ["auto", "pelvis", "hip_l", "hip_r", "knee_l", "knee_r", "foot_l", "foot_r", "center"];
    default:
      return ["auto", "center"];
  }
}

function applyAutoPartMapping(
  assets: ImportedAssetDraft[],
  category: ItemCategory,
  template: Template,
  slotDef?: SlotDef,
): ImportedAssetDraft[] {
  return assets.map(asset => {
    const inferred = inferImportedPartDefaults({
      fileName: asset.fileName,
      displayName: asset.displayName,
      category,
      template,
      slotDef,
    });
    return {
      ...asset,
      role: inferred.role,
      boneId: inferred.boneId,
      zOffset: inferred.zOffset,
    };
  });
}

export function ImportWizard({ open, onClose, activeEntityId }: Props) {
  const project = useStore(s => s.project);
  const editor = useStore(s => s.editor);
  const addEntityVisual = useStore(s => s.addEntityVisual);
  const addProjectItem = useStore(s => s.addProjectItem);
  const setEntitySlot = useStore(s => s.setEntitySlot);
  const setSelectedSlot = useStore(s => s.setSelectedSlot);
  const setEditorSelection = useStore(s => s.setEditorSelection);
  const upsertSpriteEditorDocument = useStore(s => s.upsertSpriteEditorDocument);
  const setActiveAuthoringMode = useStore(s => s.setActiveAuthoringMode);
  const setActiveSpriteDocument = useStore(s => s.setActiveSpriteDocument);
  const setAnimBottomTab = useStore(s => s.setAnimBottomTab);

  const entity = project.entities.find(candidate => candidate.id === activeEntityId);
  const template = entity ? resolveTemplate(project, entity.templateId) : undefined;
  const visibleSlots = useMemo(() => (template ? getVisibleTemplateSlots(template) : []), [template]);
  const selectedSlot = visibleSlots.find(slot => slot.id === editor.selectedSlotId) ?? visibleSlots[0];
  const [ws, setWs] = useState<WizardState>(() => createDefaultState(selectedSlot));
  const [dragOver, setDragOver] = useState(false);

  const bones = template?.bones ?? [];
  const slots = visibleSlots;
  const categorySlots = slots.filter(slot => slot.allowedCategories.includes(ws.category));
  const activeSlot = slots.find(slot => slot.id === ws.slotId) ?? selectedSlot;
  const previewAsset = ws.assets[0] ?? null;
  const previewUrl = previewAsset
    ? (previewAsset.source.format === "png" && previewAsset.source.dataUri
      ? previewAsset.source.dataUri
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewAsset.svgData)}`)
    : null;
  const stackedPreviewAssets = useMemo(() => {
    const previewSize = 176;
    const centerX = previewSize / 2;
    const centerY = previewSize / 2;

    return [...ws.assets]
      .sort((a, b) => a.zOffset - b.zOffset)
      .map(asset => {
        const width = Math.max(asset.metrics.viewBoxWidth, 1);
        const height = Math.max(asset.metrics.viewBoxHeight, 1);
        const longestSide = Math.max(width, height, 1);
        const scale = Math.min(96 / longestSide, 1.5);
        const renderedWidth = width * scale;
        const renderedHeight = height * scale;
        const left = centerX - asset.pivotX * scale;
        const top = centerY - asset.pivotY * scale;
        const src = asset.source.format === "png" && asset.source.dataUri
          ? asset.source.dataUri
          : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svgData)}`;
        return {
          id: asset.id,
          name: asset.displayName,
          boneId: asset.boneId,
          zOffset: asset.zOffset,
          src,
          left,
          top,
          width: renderedWidth,
          height: renderedHeight,
        };
      });
  }, [ws.assets]);

  const reset = useCallback(() => {
    setWs(createDefaultState(selectedSlot));
    setDragOver(false);
  }, [selectedSlot]);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const syncSlotDefaults = useCallback((slotId: string, currentTemplate?: Template) => {
    const nextSlot = currentTemplate ? getVisibleTemplateSlots(currentTemplate).find(slot => slot.id === slotId) : undefined;
    if (!nextSlot) return;
    setWs(current => ({
      ...current,
      slotId,
      category: current.target === "custom_item" ? current.category : getDefaultCategory(nextSlot),
      visualBoneId: current.visualMode === "bone_part" ? nextSlot.boneId : current.visualBoneId,
      visualZIndex: nextSlot.zIndex + 1,
      assets: currentTemplate
        ? applyAutoPartMapping(current.assets, current.category, currentTemplate, nextSlot)
        : current.assets.map(asset => ({ ...asset, boneId: asset.boneId || nextSlot.boneId })),
    }));
  }, []);

  const loadFiles = useCallback(async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;
    try {
      const baseDrafts = await Promise.all(fileList.map(file => fileToAssetDraft(file, getSlotBoneId(selectedSlot))));
      const mappedDrafts = template
        ? applyAutoPartMapping(baseDrafts, ws.category, template, activeSlot)
        : baseDrafts;
      setWs(current => ({
        ...current,
        step: 2,
        error: null,
        assets: mappedDrafts,
        itemName: current.itemName || sanitizeName(fileList[0]?.name ?? "Imported Item"),
      }));
    } catch (error) {
      setWs(current => ({
        ...current,
        error: error instanceof Error ? error.message : "Import failed.",
      }));
    }
  }, [activeSlot, selectedSlot, template, ws.category]);

  const onFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) {
      void loadFiles(files);
    }
    event.target.value = "";
  }, [loadFiles]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files?.length) {
      void loadFiles(event.dataTransfer.files);
    }
  }, [loadFiles]);

  const canGoNext =
    ws.step === 1
      ? ws.assets.length > 0
      : ws.step === 2
        ? ws.target === "entity_visual"
          ? Boolean(previewAsset && ws.visualBoneId)
          : Boolean(ws.itemName.trim() && ws.slotId && ws.assets.length > 0)
        : true;

  function handleAssetRoleChange(assetId: string, role: ImportPartRole) {
    if (!template) return;
    setWs(current => ({
      ...current,
      assets: current.assets.map(asset => {
        if (asset.id !== assetId) return asset;
        if (role === "auto") {
          const inferred = inferImportedPartDefaults({
            fileName: asset.fileName,
            displayName: asset.displayName,
            category: current.category,
            template,
            slotDef: activeSlot,
          });
          return {
            ...asset,
            role: inferred.role,
            boneId: inferred.boneId,
            zOffset: inferred.zOffset,
          };
        }
        const resolved = resolveImportedPartRole({
          role,
          category: current.category,
          template,
          slotDef: activeSlot,
        });
        return {
          ...asset,
          role,
          boneId: resolved.boneId,
          zOffset: resolved.zOffset,
        };
      }),
    }));
  }

  function handleConfirm() {
    if (!activeEntityId || !template || ws.assets.length === 0) return;

    if (ws.target === "entity_visual") {
      const asset = ws.assets[0];
      const visual: EntityVisual = {
        ...buildImportedEntityVisual({
          id: crypto.randomUUID(),
          boneId: ws.visualMode === "full_vector" ? "root" : ws.visualBoneId,
          svgData: asset.svgData,
          zIndex: ws.visualZIndex,
          pivotPreset: "custom",
          pivotX: asset.pivotX,
          pivotY: asset.pivotY,
        }),
        source: asset.source,
        editorDocumentId: null,
      };
      addEntityVisual(activeEntityId, visual);
      const doc = createDocumentFromEntityVisual(activeEntityId, visual);
      upsertSpriteEditorDocument(doc);
      setActiveSpriteDocument(doc.id);
      setEditorSelection({
        kind: "entity-visual",
        entityId: activeEntityId,
        visualId: visual.id,
      });
      setActiveAuthoringMode("sprite-editor");
      setAnimBottomTab("authoring");
      close();
      return;
    }

    const slotDef = template.slots.find(slot => slot.id === ws.slotId);
    const parts = ws.assets.map(asset =>
      buildImportedItemPart({
        fileName: asset.fileName,
        displayName: asset.displayName,
        boneId: asset.boneId,
        svgData: asset.svgData,
        source: asset.source,
        pivotX: asset.pivotX,
        pivotY: asset.pivotY,
        zOffset: asset.zOffset,
      }),
    );

    const item = buildImportedProjectItem({
      id: makeImportedItemId(ws.itemName),
      name: ws.itemName.trim(),
      description: ws.itemDescription.trim() || `Imported ${CATEGORY_LABELS[ws.category].toLowerCase()}`,
      category: ws.category,
      slotId: ws.slotId,
      template,
      slotDef,
      parts,
    });

    addProjectItem(item);
    setSelectedSlot(ws.slotId);
    setEntitySlot(activeEntityId, ws.slotId, item.id);
    if (item.parts?.length) {
      const docs = item.parts.map(part => createDocumentFromItemPart(activeEntityId, item, part));
      for (const doc of docs) {
        upsertSpriteEditorDocument(doc);
      }
      const preferredDoc =
        docs.find(doc => doc.name.toLowerCase().includes("body"))
        ?? docs.find(doc => doc.name.toLowerCase().includes("head"))
        ?? docs[0];
      if (preferredDoc) {
        setActiveSpriteDocument(preferredDoc.id);
      }
      const preferredPart = preferredDoc?.target.partId ?? item.parts[0]?.id;
      if (preferredPart) {
        setEditorSelection({
          kind: "item-part",
          entityId: activeEntityId,
          slotId: ws.slotId,
          itemId: item.id,
          partId: preferredPart,
        });
      }
      setActiveAuthoringMode("sprite-editor");
      setAnimBottomTab("authoring");
    }
    close();
  }

  const stepDescription =
    ws.step === 1
      ? "Upload one or more SVG or PNG files."
      : ws.step === 2
        ? "Map the imported assets to a slot and bones."
        : "Review the import and create the project asset.";

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="max-w-3xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Import Asset
            <span className="ml-2 text-xs font-normal text-muted-foreground">Step {ws.step} of 3</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {stepDescription}
          </DialogDescription>
        </DialogHeader>

        {ws.step === 1 && (
          <div className="space-y-4">
            <div
              onDrop={onDrop}
              onDragOver={event => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => document.getElementById("import-asset-input")?.click()}
              className={[
                "border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
              ].join(" ")}
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {dragOver ? "Drop assets here" : "Drag SVG or PNG files here"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Single-file or multi-part item import is supported
                </p>
              </div>
            </div>
            <input
              id="import-asset-input"
              type="file"
              accept=".svg,.png,image/svg+xml,image/png"
              multiple
              className="hidden"
              onChange={onFileInput}
            />
            {ws.error && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />
                {ws.error}
              </div>
            )}
          </div>
        )}

        {ws.step === 2 && (
          <div className="grid grid-cols-[1.2fr,0.8fr] gap-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Target</Label>
                  <Select value={ws.target} onValueChange={value => setWs(current => ({ ...current, target: value as ImportTarget }))}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-xs">
                      <SelectItem value="custom_item">Custom Item</SelectItem>
                      <SelectItem value="entity_visual">Entity Visual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {ws.target === "entity_visual" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Visual Mode</Label>
                    <Select value={ws.visualMode} onValueChange={value => setWs(current => ({ ...current, visualMode: value as VisualMode }))}>
                      <SelectTrigger className="h-8 text-xs bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground text-xs">
                        <SelectItem value="full_vector">Full Vector</SelectItem>
                        <SelectItem value="bone_part">Bone Part</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Select
                      value={ws.category}
                      onValueChange={value => {
                        const nextCategory = value as ItemCategory;
                        const nextSlot = slots.find(slot => slot.allowedCategories.includes(nextCategory)) ?? selectedSlot;
                        setWs(current => ({
                          ...current,
                          category: nextCategory,
                          slotId: nextSlot?.id ?? current.slotId,
                          assets: template
                            ? applyAutoPartMapping(current.assets, nextCategory, template, nextSlot)
                            : current.assets,
                        }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground text-xs max-h-80">
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value} className="text-xs">
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {ws.target === "custom_item" && (
                  <>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Item Name</Label>
                      <Input
                        value={ws.itemName}
                        onChange={event => setWs(current => ({ ...current, itemName: event.target.value }))}
                        className="h-8 text-xs bg-background border-border"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={ws.itemDescription}
                        onChange={event => setWs(current => ({ ...current, itemDescription: event.target.value }))}
                        className="h-8 text-xs bg-background border-border"
                        placeholder="Imported armor, hair, face detail..."
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Target Slot</Label>
                      <Select
                        value={ws.slotId}
                        onValueChange={value => {
                          syncSlotDefaults(value, template);
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground text-xs max-h-80">
                          {categorySlots.map(slot => (
                            <SelectItem key={slot.id} value={slot.id} className="text-xs">
                              {slot.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {ws.target === "entity_visual" && (
                  <>
                    {ws.visualMode === "bone_part" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Bone</Label>
                        <Select value={ws.visualBoneId} onValueChange={value => setWs(current => ({ ...current, visualBoneId: value }))}>
                          <SelectTrigger className="h-8 text-xs bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-xs max-h-80">
                            {bones.map(bone => (
                              <SelectItem key={bone.id} value={bone.id} className="text-xs">
                                {bone.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Z Index</Label>
                      <Input
                        type="number"
                        value={ws.visualZIndex}
                        onChange={event => setWs(current => ({ ...current, visualZIndex: Number(event.target.value) || 0 }))}
                        className="h-8 text-xs bg-background border-border"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Imported Parts</Label>
                <div className="max-h-72 overflow-auto rounded border border-border bg-background/40">
                  <div className="grid grid-cols-[1.05fr,0.95fr,0.8fr,0.4fr,0.55fr,0.55fr] gap-2 p-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>Asset</span>
                    <span>Role</span>
                    <span>Bone</span>
                    <span>Z</span>
                    <span>Pivot X</span>
                    <span>Pivot Y</span>
                  </div>
                  {ws.assets.map(asset => (
                    <div key={asset.id} className="grid grid-cols-[1.05fr,0.95fr,0.8fr,0.4fr,0.55fr,0.55fr] gap-2 border-t border-border p-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{asset.displayName}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{asset.source.format.toUpperCase()} · {asset.fileName}</p>
                      </div>
                      <Select
                        value={asset.role}
                        onValueChange={value => handleAssetRoleChange(asset.id, value as ImportPartRole)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground text-xs max-h-80">
                          {getRoleOptions(ws.category).map(role => (
                            <SelectItem key={role} value={role} className="text-xs">
                              {PART_ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={asset.boneId}
                        onValueChange={value => setWs(current => ({
                          ...current,
                          assets: current.assets.map(candidate => candidate.id === asset.id ? { ...candidate, boneId: value } : candidate),
                        }))}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground text-xs max-h-80">
                          {bones.map(bone => (
                            <SelectItem key={bone.id} value={bone.id} className="text-xs">
                              {bone.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={asset.zOffset}
                        onChange={event => setWs(current => ({
                          ...current,
                          assets: current.assets.map(candidate => candidate.id === asset.id ? { ...candidate, zOffset: Number(event.target.value) || 0 } : candidate),
                        }))}
                        className="h-8 text-xs bg-background border-border"
                      />
                      <Input
                        type="number"
                        value={asset.pivotX}
                        onChange={event => setWs(current => ({
                          ...current,
                          assets: current.assets.map(candidate => candidate.id === asset.id ? { ...candidate, pivotX: Number(event.target.value) || 0 } : candidate),
                        }))}
                        className="h-8 text-xs bg-background border-border"
                      />
                      <Input
                        type="number"
                        value={asset.pivotY}
                        onChange={event => setWs(current => ({
                          ...current,
                          assets: current.assets.map(candidate => candidate.id === asset.id ? { ...candidate, pivotY: Number(event.target.value) || 0 } : candidate),
                        }))}
                        className="h-8 text-xs bg-background border-border"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium">Preview</p>
                  {ws.target === "custom_item" && ws.assets.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">Layered stack</span>
                  )}
                </div>
                <div className="flex items-center justify-center h-48 rounded border border-border bg-background overflow-hidden">
                  {ws.target === "custom_item" && stackedPreviewAssets.length > 0 ? (
                    <div className="relative h-44 w-44 rounded bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),rgba(255,255,255,0.02)_55%,transparent_100%)]">
                      {stackedPreviewAssets.map(asset => (
                        <img
                          key={asset.id}
                          src={asset.src}
                          alt={asset.name}
                          className="absolute pointer-events-none select-none object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                          style={{
                            left: asset.left,
                            top: asset.top,
                            width: asset.width,
                            height: asset.height,
                            zIndex: Math.round(asset.zOffset * 100),
                          }}
                        />
                      ))}
                    </div>
                  ) : previewUrl ? (
                    <img src={previewUrl} alt="Imported asset preview" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No preview</span>
                  )}
                </div>
              </div>
              {ws.target === "custom_item" && stackedPreviewAssets.length > 0 && (
                <div className="rounded border border-border bg-background/50 p-3">
                  <p className="text-[11px] font-medium mb-2">Preview Layers</p>
                  <div className="space-y-1">
                    {stackedPreviewAssets.map(asset => (
                      <div key={asset.id} className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <span className="truncate">{asset.name}</span>
                        <span className="shrink-0">{asset.boneId} · z {asset.zOffset.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded border border-border bg-background/50 p-3 text-xs text-muted-foreground space-y-1">
                <p><span className="text-foreground font-medium">Active template:</span> {template?.name ?? "None"}</p>
                <p><span className="text-foreground font-medium">Target slot:</span> {activeSlot?.name ?? "Not selected"}</p>
                <p><span className="text-foreground font-medium">Files:</span> {ws.assets.length}</p>
                <p><span className="text-foreground font-medium">Behavior:</span> {ws.target === "custom_item" ? "Creates a project item and equips it immediately." : "Adds a visual directly to the entity."}</p>
              </div>
            </div>
          </div>
        )}

        {ws.step === 3 && (
          <div className="space-y-4">
            <div className="rounded border border-border bg-background/50 p-4 space-y-2 text-xs">
              <p><span className="font-medium text-foreground">Mode:</span> {ws.target === "custom_item" ? "Custom Item" : "Entity Visual"}</p>
              {ws.target === "custom_item" ? (
                <>
                  <p><span className="font-medium text-foreground">Name:</span> {ws.itemName}</p>
                  <p><span className="font-medium text-foreground">Category:</span> {CATEGORY_LABELS[ws.category]}</p>
                  <p><span className="font-medium text-foreground">Slot:</span> {activeSlot?.name ?? ws.slotId}</p>
                  <p><span className="font-medium text-foreground">Parts:</span> {ws.assets.length}</p>
                </>
              ) : (
                <>
                  <p><span className="font-medium text-foreground">Visual Mode:</span> {ws.visualMode === "full_vector" ? "Full Vector" : "Bone Part"}</p>
                  <p><span className="font-medium text-foreground">Bone:</span> {ws.visualMode === "full_vector" ? "root" : ws.visualBoneId}</p>
                  <p><span className="font-medium text-foreground">Source File:</span> {previewAsset?.fileName ?? "None"}</p>
                </>
              )}
            </div>

            <div className="rounded border border-border bg-background/50 p-4">
              <p className="text-xs font-medium mb-2">Part Mapping</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                {ws.assets.map(asset => (
                  <p key={asset.id}>
                    {asset.displayName} → {bones.find(bone => bone.id === asset.boneId)?.name ?? asset.boneId}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              if (ws.step === 1) {
                close();
                return;
              }
              setWs(current => ({ ...current, step: (current.step - 1) as 1 | 2 | 3 }));
            }}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {ws.step === 1 ? "Cancel" : "Back"}
          </Button>

          <div className="flex items-center gap-2">
            {ws.step < 3 ? (
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!canGoNext}
                onClick={() => setWs(current => ({ ...current, step: (current.step + 1) as 1 | 2 | 3 }))}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleConfirm}
                disabled={!previewAsset}
              >
                <Check className="w-4 h-4 mr-1" />
                Import
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
