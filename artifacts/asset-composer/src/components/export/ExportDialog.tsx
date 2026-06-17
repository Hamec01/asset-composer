import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { useStore } from "@/store";
import { resolveTemplate } from "@/data/templates";
import { renderFrameToCanvas } from "@/lib/frameRenderer";
import { renderSvgToBlob, applyPaletteToSvg } from "@/lib/svgUtils";
import { DEFAULT_EXPORT_PROFILES } from "@/data/exportProfiles";
import { formatFrameName } from "@/lib/exportTypes";
import type { ExportProfile, Item, Template, Entity, PaletteTokens, AnimationClip } from "@/domain/types";
import type { ExportWorkerJob, WorkerOutputMessage } from "@/lib/exportTypes";
import ExportWorker from "@/workers/export.worker?worker";
import {
  Download, Package, FileImage, Code, FileJson,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Loader2,
  Film, Layers,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const FRAME_SIZES: ExportProfile["frameSizeKey"][] = [
  "32", "48", "64", "96", "128", "256", "512",
];

const FORMAT_META: Record<
  string,
  { label: string; desc: string; icon: React.ReactNode }
> = {
  png_sheet:      { label: "PNG sprite sheet",  desc: "+ atlas JSON", icon: <FileImage className="w-3.5 h-3.5" /> },
  webp_sheet:     { label: "WebP sprite sheet", desc: "+ atlas JSON", icon: <FileImage className="w-3.5 h-3.5" /> },
  svg_parts:      { label: "SVG part pack",     desc: "each slot as .svg", icon: <Code className="w-3.5 h-3.5" /> },
  frame_sequence: { label: "Frame sequence",    desc: "numbered PNGs per clip", icon: <Package className="w-3.5 h-3.5" /> },
  entity_json:    { label: "Entity JSON",       desc: "runtime entity record", icon: <FileJson className="w-3.5 h-3.5" /> },
  jpeg_preview:   { label: "JPEG preview",      desc: "single thumbnail frame", icon: <FileImage className="w-3.5 h-3.5" /> },
};

const LICENSE_RANK: Record<string, number> = {
  cc0: 0, cc_by: 1, cc_by_sa: 2, royalty_free: 3, proprietary: 4,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectLicenseConflicts(entities: Entity[], items: Item[]): { itemName: string; reason: string }[] {
  const conflicts: { itemName: string; reason: string }[] = [];
  const itemsMap = new Map(items.map(i => [i.id, i]));
  for (const entity of entities) {
    const entityRank = LICENSE_RANK[entity.licenseMeta.licenseType] ?? 0;
    for (const slotAssign of entity.slots) {
      if (!slotAssign.itemId) continue;
      const item = itemsMap.get(slotAssign.itemId);
      if (!item) continue;
      const itemRank = LICENSE_RANK[item.licenseMeta.licenseType] ?? 0;
      if (itemRank > entityRank)
        conflicts.push({ itemName: item.name, reason: `${item.licenseMeta.licenseType} is more restrictive` });
      if (!item.licenseMeta.commercialUseAllowed && entity.licenseMeta.commercialUseAllowed)
        conflicts.push({ itemName: item.name, reason: "item does not allow commercial use" });
    }
  }
  const seen = new Set<string>();
  return conflicts.filter(c => { if (seen.has(c.itemName)) return false; seen.add(c.itemName); return true; });
}

async function prerasterizeAll(
  entities:     Entity[],
  items:        Item[],
  findTemplate: (id: string) => Template | undefined,
  onStep:       (msg: string) => void,
): Promise<Record<string, ArrayBuffer>> {
  const cache: Record<string, ArrayBuffer> = {};
  const itemsMap = new Map(items.map(i => [i.id, i]));

  for (const entity of entities) {
    const template = findTemplate(entity.templateId);
    if (!template) continue;

    for (const layer of template.baseBodyLayers) {
      const key = `base:${entity.id}:${layer.id}`;
      if (!cache[key]) {
        onStep(`Preparing textures: ${entity.name} base…`);
        const svgData = applyPaletteToSvg(layer.svgData, template.paletteTokens, entity.palette);
        const blob    = await renderSvgToBlob(svgData, template.previewWidth, template.previewHeight);
        if (blob) cache[key] = await blob.arrayBuffer();
      }
    }

    for (const slotAssign of entity.slots) {
      if (!slotAssign.itemId) continue;
      const item = itemsMap.get(slotAssign.itemId);
      if (!item) continue;
      const effectivePalette: PaletteTokens = slotAssign.paletteOverride
        ? { ...entity.palette, ...slotAssign.paletteOverride } as PaletteTokens
        : entity.palette;
      for (let li = 0; li < item.svgLayers.length; li++) {
        const svgLayer = item.svgLayers[li];
        const key = `slot:${entity.id}:${slotAssign.slotId}:${li}`;
        if (!cache[key]) {
          onStep(`Preparing textures: ${entity.name} · ${slotAssign.slotId}…`);
          const svgData = applyPaletteToSvg(svgLayer.svgData, template.paletteTokens, effectivePalette);
          const blob    = await renderSvgToBlob(svgData, template.previewWidth, template.previewHeight);
          if (blob) cache[key] = await blob.arrayBuffer();
        }
      }
    }

    // Stage 3 — bone part rasterization (8× for quality; worker resizes at render time)
    for (const part of template.boneParts ?? []) {
      const key = `part:${entity.id}:${part.id}`;
      if (!cache[key]) {
        onStep(`Preparing textures: ${entity.name} bone parts…`);
        const svgData = applyPaletteToSvg(part.svgData, template.paletteTokens, entity.palette);
        const partW   = Math.ceil(part.naturalWidth  * 8);
        const partH   = Math.ceil(part.naturalHeight * 8);
        const blob    = await renderSvgToBlob(svgData, partW, partH);
        if (blob) cache[key] = await blob.arrayBuffer();
      }
    }

    // v2.0 entity visuals (EntityVisual imports via Import Wizard)
    for (const visual of entity.visuals ?? []) {
      const key = `visual:${entity.id}:${visual.id}`;
      if (!cache[key]) {
        onStep(`Preparing textures: ${entity.name} visual…`);
        const svgData = applyPaletteToSvg(visual.svgData, template.paletteTokens, entity.palette);
        const pxW     = Math.max(1, Math.ceil(visual.metrics.visualWidth));
        const pxH     = Math.max(1, Math.ceil(visual.metrics.visualHeight));
        const blob    = await renderSvgToBlob(svgData, pxW, pxH);
        if (blob) cache[key] = await blob.arrayBuffer();
      }
    }
  }

  return cache;
}

async function buildSvgPartFiles(
  entities:     Entity[],
  items:        Item[],
  profile:      ExportProfile,
  findTemplate: (id: string) => Template | undefined,
): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  if (!profile.formats.includes("svg_parts")) return files;

  const enc      = new TextEncoder();
  const itemsMap = new Map(items.map(i => [i.id, i]));

  for (const entity of entities) {
    const template = findTemplate(entity.templateId);
    if (!template) continue;
    const entitySlug = entity.name.toLowerCase().replace(/[^a-z0-9]/g, "_");

    for (const layer of template.baseBodyLayers) {
      const svgData = applyPaletteToSvg(layer.svgData, template.paletteTokens, entity.palette);
      files[`${entitySlug}/svg/${entitySlug}_base_${layer.zOffset ?? 0}.svg`] = enc.encode(svgData);
    }

    for (const slotAssign of entity.slots) {
      if (!slotAssign.itemId) continue;
      const item    = itemsMap.get(slotAssign.itemId);
      if (!item?.svgLayers[0]) continue;
      const slotDef = template.slots.find(s => s.id === slotAssign.slotId);
      if (!slotDef)  continue;
      const effectivePalette: PaletteTokens = slotAssign.paletteOverride
        ? { ...entity.palette, ...slotAssign.paletteOverride } as PaletteTokens
        : entity.palette;
      const svgData  = applyPaletteToSvg(item.svgLayers[0].svgData, template.paletteTokens, effectivePalette);
      const slotName = formatFrameName(profile.namingTemplate, {
        entity: entity.name, animation: "slot", frame: 0, slot: slotDef.id,
      });
      files[`${entitySlug}/svg/${slotName}.svg`] = enc.encode(svgData);
    }
  }

  return files;
}

function previewNamingTemplate(tmpl: string, entityName: string): string {
  return formatFrameName(tmpl, { entity: entityName, animation: "idle", frame: 0 });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function clipFrameCount(clip: AnimationClip): number {
  return Math.max(1, Math.ceil((clip.durationMs / 1000) * Math.max(1, clip.fps)));
}

// ── Progress view ─────────────────────────────────────────────────────────────

function ExportProgress({ pct, msg, onCancel }: { pct: number; msg: string; onCancel: () => void }) {
  return (
    <div className="space-y-4 py-4" data-testid="export-progress">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
        <p className="text-sm font-medium text-foreground">Exporting…</p>
      </div>
      <div className="h-2 rounded-full bg-accent overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground truncate">{msg}</p>
      <p className="text-[10px] text-muted-foreground">{Math.round(pct * 100)}% complete</p>
      <Button variant="ghost" size="sm" className="text-xs w-full" onClick={onCancel}>
        Cancel export
      </Button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ExportDialog() {
  const editor          = useStore(s => s.editor);
  const project         = useStore(s => s.project);
  const closeExport     = useStore(s => s.closeExport);
  const getActiveEntity = useStore(s => s.getActiveEntity);

  const activeEntity = getActiveEntity();

  const [profile, setProfile]                         = useState<ExportProfile>({ ...DEFAULT_EXPORT_PROFILES[0] });
  const [selectedProfileId, setSelectedProfileId]     = useState(DEFAULT_EXPORT_PROFILES[0].id);
  const [selectedEntityIds, setSelectedEntityIds]     = useState<string[]>([]);
  const [showEntityPicker, setShowEntityPicker]       = useState(false);
  const [showProfilePicker, setShowProfilePicker]     = useState(false);
  const [showClipPicker, setShowClipPicker]           = useState(false);
  const [selectedClipIds, setSelectedClipIds]         = useState<string[] | null>(null);
  const [exportState, setExportState]                 = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress]                       = useState<{ pct: number; msg: string } | null>(null);
  const [errorMsg, setErrorMsg]                       = useState<string | null>(null);
  const [fileCount, setFileCount]                     = useState(0);
  const [downloadedFilename, setDownloadedFilename]   = useState<string | null>(null);

  const workerRef    = useRef<InstanceType<typeof ExportWorker> | null>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedEntities = useMemo(() => {
    const ids =
      selectedEntityIds.length > 0
        ? selectedEntityIds
        : activeEntity
          ? [activeEntity.id]
          : [];
    return project.entities.filter(e => ids.includes(e.id));
  }, [selectedEntityIds, activeEntity, project.entities]);

  // Clips available across all selected entities' skeleton families
  const availableClips = useMemo(() => {
    const families = new Set<string>();
    for (const entity of selectedEntities) {
      const tmpl = resolveTemplate(project, entity.templateId);
      if (tmpl) families.add(tmpl.skeletonFamily);
    }
    return project.animationClips.filter(c => families.has(c.skeletonFamily));
  }, [selectedEntities, project.animationClips, project]);

  // Effective clip selection: null → all available
  const effectiveClipIds = useMemo<string[]>(
    () => selectedClipIds ?? availableClips.map(c => c.id),
    [selectedClipIds, availableClips]
  );

  const effectiveClips = useMemo(
    () => availableClips.filter(c => effectiveClipIds.includes(c.id)),
    [availableClips, effectiveClipIds]
  );

  // Frame count estimate
  const totalFrames = useMemo(() => {
    const needsFrames = profile.formats.some(f =>
      ["png_sheet", "webp_sheet", "frame_sequence", "jpeg_preview"].includes(f)
    );
    if (!needsFrames) return 0;
    return effectiveClips.reduce((sum, c) => sum + clipFrameCount(c), 0) * Math.max(1, selectedEntities.length);
  }, [effectiveClips, profile.formats, selectedEntities.length]);

  // Sheet size estimate (square-ish packing)
  const sheetEstimate = useMemo(() => {
    const frameSz = parseInt(profile.frameSizeKey, 10);
    if (totalFrames === 0) return null;
    const perEntity = Math.ceil(totalFrames / Math.max(1, selectedEntities.length));
    const cols = Math.max(1, Math.ceil(Math.sqrt(perEntity)));
    const rows = Math.ceil(perEntity / cols);
    return { w: cols * frameSz, h: rows * frameSz };
  }, [totalFrames, profile.frameSizeKey, selectedEntities.length]);

  const licenseConflicts = useMemo(
    () => detectLicenseConflicts(selectedEntities, project.items),
    [selectedEntities, project.items]
  );

  const namingPreview = useMemo(() => {
    const entity = selectedEntities[0] ?? activeEntity;
    if (!entity) return "";
    return previewNamingTemplate(profile.namingTemplate, entity.name);
  }, [profile.namingTemplate, selectedEntities, activeEntity]);

  // Reset on open
  useEffect(() => {
    if (editor.isExportOpen) {
      if (activeEntity) setSelectedEntityIds([activeEntity.id]);
      setSelectedClipIds(null);
      setExportState("idle");
      setErrorMsg(null);
      setProgress(null);
      setFileCount(0);
    }
  }, [editor.isExportOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live preview
  const schedulePreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      const canvas = canvasRef.current;
      const entity = selectedEntities[0] ?? activeEntity;
      if (!canvas || !entity) return;
      const template = resolveTemplate(project, entity.templateId);
      if (!template) return;
      const frameSz = parseInt(profile.frameSizeKey, 10);
      try {
        await renderFrameToCanvas({
          canvas, entity, template,
          items: project.items,
          frameSz,
          bgColor: profile.bgColor,
          outlinePadding: profile.outlinePadding,
          antiAlias: profile.antiAlias,
        });
      } catch { /* silent */ }
    }, 100);
  }, [activeEntity, selectedEntities, profile, project.items]);

  useEffect(() => {
    if (editor.isExportOpen && exportState === "idle") schedulePreview();
  }, [editor.isExportOpen, exportState, schedulePreview]);

  // Settings helpers
  function loadPreset(preset: ExportProfile) {
    setProfile({ ...preset });
    setSelectedProfileId(preset.id);
    setShowProfilePicker(false);
  }
  function updateProfile(patch: Partial<ExportProfile>) {
    setProfile(p => ({ ...p, ...patch }));
    setSelectedProfileId("custom");
  }
  function toggleFormat(fmt: string) {
    setProfile(p => {
      const has  = p.formats.includes(fmt as never);
      const next = has ? p.formats.filter(f => f !== fmt) : [...p.formats, fmt as never];
      return { ...p, formats: next };
    });
    setSelectedProfileId("custom");
  }

  function toggleClip(clipId: string) {
    setSelectedClipIds(prev => {
      const current = prev ?? availableClips.map(c => c.id);
      const has     = current.includes(clipId);
      return has ? current.filter(id => id !== clipId) : [...current, clipId];
    });
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    const entities = selectedEntities;
    if (entities.length === 0 || profile.formats.length === 0) return;

    const findTemplate = (id: string) => resolveTemplate(project, id);

    const templateMap = new Map<string, Template>();
    for (const entity of entities) {
      if (!templateMap.has(entity.templateId)) {
        const tmpl = findTemplate(entity.templateId);
        if (tmpl) templateMap.set(entity.templateId, tmpl);
      }
    }
    if (templateMap.size === 0) return;

    setExportState("running");
    setProgress({ pct: 0, msg: "Preparing textures…" });
    setErrorMsg(null);

    try {
      const rasterizedImages = await prerasterizeAll(entities, project.items, findTemplate, msg => {
        setProgress({ pct: 0.05, msg });
      });

      const svgPartFiles = await buildSvgPartFiles(entities, project.items, profile, findTemplate);

      const job: ExportWorkerJob & { svgPartFiles?: Record<string, Uint8Array> } = {
        entities,
        templates:       Array.from(templateMap.values()),
        items:           project.items,
        animationClips:  project.animationClips,
        profile,
        rasterizedImages,
        selectedClipIds: effectiveClipIds.length < availableClips.length ? effectiveClipIds : undefined,
        svgPartFiles: Object.keys(svgPartFiles).length > 0 ? svgPartFiles : undefined,
      };

      setProgress({ pct: 0.1, msg: "Starting export worker…" });

      const worker = new ExportWorker();
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<WorkerOutputMessage>) => {
        const msg = e.data;
        if (msg.type === "progress") {
          setProgress({ pct: 0.1 + msg.pct * 0.9, msg: msg.msg });
        } else if (msg.type === "done") {
          const slug = entities[0].name.toLowerCase().replace(/[^a-z0-9]/g, "_");
          if (msg.singleFile) {
            const { filename, mimeType, buffer } = msg.singleFile;
            triggerDownload(new Blob([buffer], { type: mimeType }), filename);
            setDownloadedFilename(filename);
          } else {
            const zipFilename =
              entities.length === 1
                ? `${slug}_export.zip`
                : `batch_${entities.length}entities_export.zip`;
            triggerDownload(new Blob([msg.zipBuffer], { type: "application/zip" }), zipFilename);
            setDownloadedFilename(null);
          }
          setFileCount(msg.fileCount);
          setExportState("done");
          setProgress(null);
          workerRef.current = null;
        } else if (msg.type === "error") {
          setErrorMsg(msg.message);
          setExportState("error");
          setProgress(null);
          workerRef.current = null;
        }
      };

      worker.onerror = (ev) => {
        setErrorMsg(ev.message ?? "Worker failed. Check browser console.");
        setExportState("error");
        setProgress(null);
        workerRef.current = null;
      };

      worker.postMessage({ type: "start", job });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setExportState("error");
      setProgress(null);
    }
  }

  function handleCancel() {
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    setExportState("idle");
    setProgress(null);
  }

  function handleClose() {
    handleCancel();
    closeExport();
  }

  function toggleEntityId(id: string) {
    setSelectedEntityIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const frameSz   = parseInt(profile.frameSizeKey, 10);
  const isRunning = exportState === "running";

  return (
    <Dialog
      open={editor.isExportOpen}
      onOpenChange={open => { if (!open && !isRunning) handleClose(); }}
    >
      <DialogContent className="max-w-2xl bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Export Studio
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure and export sprite sheets, atlases, and SVG packs for your entities.
          </DialogDescription>
        </DialogHeader>

        {!activeEntity && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No entity selected. Select an entity to export.
          </p>
        )}

        {activeEntity && isRunning && progress && (
          <ExportProgress pct={progress.pct} msg={progress.msg} onCancel={handleCancel} />
        )}

        {activeEntity && !isRunning && (
          <div className="space-y-5">

            {/* License warning */}
            {licenseConflicts.length > 0 && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-yellow-300 mb-1">License conflicts detected</p>
                  {licenseConflicts.map(c => (
                    <p key={c.itemName} className="text-xs text-yellow-200/80">
                      <span className="font-medium">{c.itemName}</span> — {c.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Done banner */}
            {exportState === "done" && (
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 flex gap-2 items-center">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-xs text-primary">
                  {downloadedFilename
                    ? `Export complete — downloaded ${downloadedFilename}`
                    : `Export complete — ${fileCount} file${fileCount !== 1 ? "s" : ""} downloaded as ZIP.`}
                </p>
              </div>
            )}

            {/* Error banner */}
            {exportState === "error" && errorMsg && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{errorMsg}</p>
              </div>
            )}

            {/* Two-column: settings + preview */}
            <div className="grid grid-cols-[1fr_auto] gap-5">

              {/* LEFT — settings */}
              <div className="space-y-4">

                {/* Profile preset picker */}
                <section>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Profile</p>
                    <button
                      onClick={() => setShowProfilePicker(v => !v)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {selectedProfileId === "custom"
                        ? "Custom"
                        : DEFAULT_EXPORT_PROFILES.find(p => p.id === selectedProfileId)?.name ?? "Pick…"}
                      {showProfilePicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                  {showProfilePicker && (
                    <div className="rounded-lg border border-border bg-accent/10 divide-y divide-border overflow-hidden mb-2">
                      {DEFAULT_EXPORT_PROFILES.map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => loadPreset(preset)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="text-xs font-medium text-foreground">{preset.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {preset.frameSizeKey}px · {preset.formats.join(", ")} · pivot: {preset.pivotPolicy}
                            </p>
                          </div>
                          {selectedProfileId === preset.id && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* Output formats */}
                <section>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                    Output Formats
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(FORMAT_META).map(([fmt, meta]) => {
                      const checked = profile.formats.includes(fmt as never);
                      return (
                        <button
                          key={fmt}
                          onClick={() => toggleFormat(fmt)}
                          className={`flex items-center gap-2 rounded-md border p-2 text-left transition-colors ${
                            checked ? "border-primary/50 bg-primary/10" : "border-border bg-accent/10 hover:border-primary/30"
                          }`}
                        >
                          <div className={`flex-shrink-0 ${checked ? "text-primary" : "text-muted-foreground"}`}>
                            {meta.icon}
                          </div>
                          <div>
                            <p className={`text-[11px] font-medium leading-tight ${checked ? "text-foreground" : "text-muted-foreground"}`}>
                              {meta.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70">{meta.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Frame size */}
                <section>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Frame Size (px)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FRAME_SIZES.map(sz => (
                      <button
                        key={sz}
                        onClick={() => updateProfile({ frameSizeKey: sz })}
                        className={`px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
                          profile.frameSizeKey === sz
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border bg-accent/20 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Animation clip selector */}
                {availableClips.length > 0 && (
                  <section>
                    <button
                      onClick={() => setShowClipPicker(v => !v)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full mb-1"
                    >
                      <Film className="w-3 h-3 flex-shrink-0" />
                      <span className="uppercase tracking-wider">Animation Clips</span>
                      {showClipPicker ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                      <span className="ml-auto font-mono text-primary text-xs">
                        {effectiveClipIds.length}/{availableClips.length}
                      </span>
                    </button>

                    {showClipPicker && (
                      <div className="rounded-lg border border-border bg-accent/5 overflow-hidden">
                        {/* Select all / none */}
                        <div className="flex gap-1 px-2.5 py-1.5 border-b border-border bg-accent/10">
                          <button
                            onClick={() => setSelectedClipIds(null)}
                            className="text-[10px] text-primary hover:underline"
                          >
                            All
                          </button>
                          <span className="text-[10px] text-muted-foreground">/</span>
                          <button
                            onClick={() => setSelectedClipIds([])}
                            className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                          >
                            None
                          </button>
                        </div>

                        {/* Clip list */}
                        <div className="max-h-44 overflow-y-auto divide-y divide-border/50">
                          {availableClips.map(clip => {
                            const selected = effectiveClipIds.includes(clip.id);
                            const frames   = clipFrameCount(clip);
                            return (
                              <button
                                key={clip.id}
                                onClick={() => toggleClip(clip.id)}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors hover:bg-accent/20 ${
                                  selected ? "" : "opacity-50"
                                }`}
                              >
                                <div className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${
                                  selected ? "border-primary bg-primary/20" : "border-border"
                                }`}>
                                  {selected && <div className="w-1.5 h-1.5 rounded-sm bg-primary" />}
                                </div>
                                <p className="text-xs text-foreground flex-1 truncate">
                                  {clip.label ?? clip.name}
                                </p>
                                <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                                  {fmtMs(clip.durationMs)} · {frames}f
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* Pivot + Atlas mode (inline row) */}
                <section className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Pivot</p>
                    <div className="flex gap-1 flex-wrap">
                      {(["center", "feet", "per_animation"] as const).map(pol => (
                        <button
                          key={pol}
                          onClick={() => updateProfile({ pivotPolicy: pol })}
                          className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                            profile.pivotPolicy === pol
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-border bg-accent/20 text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          {pol === "per_animation" ? "per anim" : pol}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Atlas Mode</p>
                    <div className="flex gap-1">
                      {(["per_entity", "combined"] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => updateProfile({ atlasMode: mode })}
                          className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                            profile.atlasMode === mode
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-border bg-accent/20 text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          {mode === "per_entity" ? "per entity" : "combined"}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Fine-tuning */}
                <section className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Outline px</label>
                    <input
                      type="number" min={0} max={16}
                      value={profile.outlinePadding}
                      onChange={e => updateProfile({ outlinePadding: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-accent/20 border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Background</label>
                    <div className="flex gap-1 items-center">
                      <input
                        type="color"
                        value={profile.bgColor ?? "#111111"}
                        onChange={e => updateProfile({ bgColor: e.target.value })}
                        className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer flex-shrink-0"
                      />
                      <button
                        onClick={() => updateProfile({ bgColor: null })}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          profile.bgColor === null ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        α
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Anti-alias</label>
                    <button
                      onClick={() => updateProfile({ antiAlias: !profile.antiAlias })}
                      className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                        profile.antiAlias ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-accent/20 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {profile.antiAlias ? "on" : "off"}
                    </button>
                  </div>
                </section>

                {/* Naming template */}
                <section>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Naming Template</p>
                  <input
                    type="text"
                    value={profile.namingTemplate}
                    onChange={e => updateProfile({ namingTemplate: e.target.value })}
                    className="w-full bg-accent/20 border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50"
                    placeholder="{entity}_{animation}_{frame:03d}"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Preview: <span className="font-mono text-foreground/80">{namingPreview}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    Tokens: {"{entity}"} {"{animation}"} {"{frame:03d}"} {"{slot}"}
                  </p>
                </section>

                {/* Export summary */}
                {totalFrames > 0 && (
                  <section className="rounded-lg border border-border/60 bg-accent/5 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Layers className="w-3 h-3 text-muted-foreground" />
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Export Summary</p>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-[11px] text-muted-foreground">Clips</span>
                        <span className="text-[11px] font-mono text-foreground">
                          {effectiveClipIds.length} of {availableClips.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[11px] text-muted-foreground">Frames</span>
                        <span className="text-[11px] font-mono text-foreground">
                          {totalFrames.toLocaleString()}
                          {selectedEntities.length > 1 ? ` (×${selectedEntities.length} entities)` : ""}
                        </span>
                      </div>
                      {sheetEstimate && (
                        <div className="flex justify-between">
                          <span className="text-[11px] text-muted-foreground">Sheet per entity</span>
                          <span className="text-[11px] font-mono text-foreground">
                            {sheetEstimate.w}×{sheetEstimate.h}px
                          </span>
                        </div>
                      )}
                    </div>
                  </section>
                )}

              </div>

              {/* RIGHT — preview + entity picker */}
              <div className="space-y-3 w-44 flex-shrink-0">

                <section>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                    Preview ({frameSz}px)
                  </p>
                  <div
                    className="border border-border rounded-lg bg-accent/10 overflow-hidden flex items-center justify-center"
                    style={{ width: 176, height: 176 }}
                  >
                    <canvas
                      ref={canvasRef}
                      width={frameSz}
                      height={frameSz}
                      style={{
                        imageRendering: frameSz <= 64 ? "pixelated" : "auto",
                        width:  160,
                        height: 160,
                        objectFit: "contain",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">
                    Rest pose · {frameSz}×{frameSz}
                  </p>
                </section>

                <section>
                  <button
                    onClick={() => setShowEntityPicker(v => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                  >
                    <span className="uppercase tracking-wider">Entities</span>
                    {showEntityPicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <span className="ml-auto font-mono text-primary text-xs">{selectedEntities.length}</span>
                  </button>
                  {showEntityPicker && (
                    <div className="mt-1.5 rounded-lg border border-border bg-accent/10 overflow-hidden max-h-40 overflow-y-auto">
                      {project.entities.map(entity => {
                        const isSelected =
                          selectedEntityIds.includes(entity.id) ||
                          (selectedEntityIds.length === 0 && entity.id === activeEntity?.id);
                        return (
                          <button
                            key={entity.id}
                            onClick={() => toggleEntityId(entity.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-accent/30 transition-colors ${isSelected ? "bg-primary/10" : ""}`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? "bg-primary" : "bg-transparent border border-border"}`} />
                            <p className="text-xs text-foreground truncate">{entity.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" className="text-xs" onClick={handleClose}>
                Close
              </Button>
              {profile.formats.length === 0 && (
                <p className="text-xs text-muted-foreground">Select at least one format.</p>
              )}
              {effectiveClipIds.length === 0 && profile.formats.some(f =>
                ["png_sheet", "webp_sheet", "frame_sequence"].includes(f)) && (
                <p className="text-xs text-yellow-400/80">No clips selected — only rest pose will be exported.</p>
              )}
              <Button
                data-testid="export-download-btn"
                size="sm"
                className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                onClick={handleExport}
                disabled={selectedEntities.length === 0 || profile.formats.length === 0}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export{selectedEntities.length > 1 ? ` ${selectedEntities.length} entities` : ""}
                {totalFrames > 0 && ` · ${totalFrames}f`}
              </Button>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
