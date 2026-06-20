/**
 * ImportWizard.tsx
 *
 * Three-step dialog for importing an SVG as an entity visual.
 *
 * Step 1 — Upload:   Drag & drop or file-pick a .svg file.
 * Step 2 — Configure: Choose import mode, bone attachment, display name, pivot.
 * Step 3 — Confirm:  Preview + confirm.  Calls store.addEntityVisual.
 *
 * Import modes
 * ────────────
 *  full_vector  → whole-entity vector art (EntityVisual bound to "root").
 *                 Added to entity.visuals[]; replaces bone-part SVGs with a
 *                 single crisp vector at any zoom level.
 *
 *  bone_part    → attaches SVG to a specific bone (EntityVisual with localTransform).
 *                 Useful for swapping just a head, cloak, or weapon visual.
 */

import { useState, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, ChevronRight, ChevronLeft, Check, AlertCircle } from "lucide-react";
import { useStore } from "@/store";
import { resolveTemplate } from "@/data/templates";
import type { EntityVisual } from "@/domain/types";
import { buildImportedEntityVisual, getDefaultImportPivot } from "@/lib/entityVisualImport";

type ImportMode = "full_vector" | "bone_part";

interface Props {
  open:           boolean;
  onClose:        () => void;
  activeEntityId: string | null;
}

interface WizardState {
  step:       1 | 2 | 3;
  svgData:    string;
  fileName:   string;
  name:       string;
  mode:       ImportMode;
  boneId:     string;
  pivotX:     number;
  pivotY:     number;
  zIndex:     number;
  error:      string | null;
}

const DEFAULT: WizardState = {
  step:     1,
  svgData:  "",
  fileName: "",
  name:     "",
  mode:     "full_vector",
  boneId:   "root",
  pivotX:   0,
  pivotY:   0,
  zIndex:   100,
  error:    null,
};

export function ImportWizard({ open, onClose, activeEntityId }: Props) {
  const [ws, setWs] = useState<WizardState>({ ...DEFAULT });
  const dropRef     = useRef<HTMLDivElement>(null);
  const isDragging  = useRef(false);
  const [dragOver, setDragOver] = useState(false);

  const project          = useStore(s => s.project);
  const addEntityVisual  = useStore(s => s.addEntityVisual);

  const entity   = project.entities.find(e => e.id === activeEntityId);
  const template = entity ? resolveTemplate(project, entity.templateId) : undefined;
  const bones    = template?.bones ?? [];

  function reset() { setWs({ ...DEFAULT }); }

  function close() { reset(); onClose(); }

  // ── File helpers ──────────────────────────────────────────────────────────

  async function loadFile(file: File) {
    if (!file.name.endsWith(".svg") && file.type !== "image/svg+xml") {
      setWs(w => ({ ...w, error: "Only .svg files are supported." }));
      return;
    }
    const text = await file.text();
    const baseName = file.name.replace(/\.svg$/i, "").replace(/[_-]/g, " ").trim();
    const defaultPivot = getDefaultImportPivot(text, "center");
    setWs(w => ({
      ...w,
      svgData:  text,
      fileName: file.name,
      name:     baseName,
      pivotX:   defaultPivot.x,
      pivotY:   defaultPivot.y,
      error:    null,
      step:     2,
    }));
  }

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    isDragging.current = false;
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragging.current) { isDragging.current = true; setDragOver(true); }
  }, []);

  const onDragLeave = useCallback(() => {
    isDragging.current = false;
    setDragOver(false);
  }, []);

  // ── Confirm import ────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!activeEntityId || !ws.svgData) return;

    const visual: EntityVisual = buildImportedEntityVisual({
      id: crypto.randomUUID(),
      boneId: ws.mode === "full_vector" ? "root" : ws.boneId,
      svgData: ws.svgData,
      zIndex: ws.zIndex,
      pivotPreset: "custom",
      pivotX: ws.pivotX,
      pivotY: ws.pivotY,
    });

    addEntityVisual(activeEntityId, visual);
    close();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const svgPreviewUrl = ws.svgData
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ws.svgData)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) close(); }}>
      <DialogContent
        className="bg-card border-border text-foreground max-w-lg"
        data-testid="import-wizard"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Import SVG Asset
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Step {ws.step} of 3
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {ws.step === 1 && "Upload an SVG file to import as a visual asset."}
            {ws.step === 2 && "Configure how this SVG attaches to the entity."}
            {ws.step === 3 && "Review and confirm the import."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {ws.step === 1 && (
          <div className="space-y-4">
            <div
              ref={dropRef}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={[
                "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
              ].join(" ")}
              onClick={() => document.getElementById("import-svg-input")?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {dragOver ? "Drop SVG here" : "Drag & drop an SVG file"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to browse — .svg only
                </p>
              </div>
            </div>
            <input
              id="import-svg-input"
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={onFileInput}
            />
            {ws.error && (
              <div className="flex items-center gap-2 text-destructive text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                {ws.error}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Configure ──────────────────────────────────────────── */}
        {ws.step === 2 && (
          <div className="space-y-4">
            {svgPreviewUrl && (
              <div className="flex items-center justify-center h-32 bg-background rounded border border-border overflow-hidden">
                <img
                  src={svgPreviewUrl}
                  alt="Preview"
                  className="max-h-28 max-w-full object-contain"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Display Name</Label>
                <Input
                  value={ws.name}
                  onChange={e => setWs(w => ({ ...w, name: e.target.value }))}
                  className="h-8 text-xs bg-background border-border"
                  placeholder="e.g. Warrior Body"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Import Mode</Label>
                <Select
                  value={ws.mode}
                  onValueChange={v => setWs(w => ({ ...w, mode: v as ImportMode }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground text-xs">
                    <SelectItem value="full_vector" className="text-xs">
                      Full Vector (whole entity)
                    </SelectItem>
                    <SelectItem value="bone_part" className="text-xs">
                      Bone Part (attach to bone)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ws.mode === "bone_part" && bones.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Attach to Bone</Label>
                  <Select
                    value={ws.boneId}
                    onValueChange={v => setWs(w => ({ ...w, boneId: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-xs max-h-48">
                      {bones.map(b => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Z-Index</Label>
                <Input
                  type="number"
                  value={ws.zIndex}
                  onChange={e => setWs(w => ({ ...w, zIndex: Number(e.target.value) }))}
                  className="h-8 text-xs bg-background border-border"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ────────────────────────────────────────────── */}
        {ws.step === 3 && (
          <div className="space-y-4">
            {svgPreviewUrl && (
              <div className="flex items-center justify-center h-36 bg-background rounded border border-border overflow-hidden">
                <img
                  src={svgPreviewUrl}
                  alt="Preview"
                  className="max-h-32 max-w-full object-contain"
                />
              </div>
            )}
            <div className="rounded bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{ws.name || ws.fileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span className="font-medium capitalize">{ws.mode.replace("_", " ")}</span>
              </div>
              {ws.mode === "bone_part" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bone</span>
                  <span className="font-medium">
                    {bones.find(b => b.id === ws.boneId)?.name ?? ws.boneId}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Z-Index</span>
                <span className="font-medium">{ws.zIndex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">File</span>
                <span className="font-medium text-muted-foreground/70">{ws.fileName}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer buttons ─────────────────────────────────────────────── */}
        <div className="flex justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              if (ws.step === 1) close();
              else setWs(w => ({ ...w, step: (w.step - 1) as 1 | 2 | 3 }));
            }}
          >
            {ws.step === 1 ? "Cancel" : (
              <><ChevronLeft className="w-3.5 h-3.5 mr-1" />Back</>
            )}
          </Button>

          {ws.step < 3 && (
            <Button
              size="sm"
              className="h-7 text-xs bg-primary text-primary-foreground"
              disabled={ws.step === 1 ? !ws.svgData : false}
              onClick={() => setWs(w => ({ ...w, step: (w.step + 1) as 2 | 3 }))}
            >
              Next<ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}

          {ws.step === 3 && (
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={handleConfirm}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Import
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
