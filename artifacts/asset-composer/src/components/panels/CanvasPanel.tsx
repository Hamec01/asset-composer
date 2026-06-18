import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@/store";
import { CanvasEngine } from "@/engine/canvasEngine";
import { resolveTemplate } from "@/data/templates";
import {
  buildMultiClipPose, evaluateSkeleton, evaluateScene,
} from "@/lib/evaluationPipeline";
import { refreshCanonicalBuiltInTypedItems } from "@/lib/canonicalItems";
import { animController } from "@/core-v2/AnimationController";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ZoomIn, ZoomOut, Maximize2, MousePointer2, Move, LayoutGrid } from "lucide-react";
import type { CanvasMode } from "@/domain/types";

interface Viewport { zoom: number; panX: number; panY: number }
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 12;

const MODE_BUTTONS: Array<{
  mode: CanvasMode;
  label: string;
  title: string;
  icon: typeof MousePointer2;
}> = [
  {
    mode: "select",
    label: "Select",
    title: "Select visuals and slots without transforming them",
    icon: MousePointer2,
  },
  {
    mode: "edit-attachment",
    label: "Attachment",
    title: "Edit the equipped item part for the selected slot",
    icon: Move,
  },
  {
    mode: "edit-template-slots",
    label: "Slots",
    title: "Edit template slot positions for the active template",
    icon: LayoutGrid,
  },
];

export function CanvasPanel() {
  const project         = useStore(s => s.project);
  const editor          = useStore(s => s.editor);
  const animPlayback    = useStore(s => s.animPlayback);
  const setSelectedSlot           = useStore(s => s.setSelectedSlot);
  const previewAttachmentOverride = useStore(s => s.previewAttachmentOverride);
  const commitAttachmentOverride  = useStore(s => s.commitAttachmentOverride);
  const setCanvasMode             = useStore(s => s.setCanvasMode);
  const setEditorSelection        = useStore(s => s.setEditorSelection);
  const previewTemplateSlotTransform = useStore(s => s.previewTemplateSlotTransform);
  const commitTemplateSlotTransform  = useStore(s => s.commitTemplateSlotTransform);
  const setPlaybackPlaying        = useStore(s => s.setPlaybackPlaying);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef    = useRef<CanvasEngine | null>(null);
  const isPanning    = useRef(false);
  const lastMouse    = useRef({ x: 0, y: 0 });
  const [altHeld, setAltHeld]             = useState(false);
  const [initialized, setInitialized]     = useState(false);

  // Camera auto-fit: set true when entity changes so next reconcile triggers fit
  const cameraDirtyRef = useRef(true);
  const prevEntityIdRef = useRef<string | null>(null);

  // Viewport state — ref for callbacks, state for display
  const vpRef        = useRef<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [vp, _setVp] = useState<Viewport>(vpRef.current);

  const applyViewport = useCallback((next: Viewport | ((prev: Viewport) => Viewport)) => {
    const resolved = typeof next === "function" ? next(vpRef.current) : next;
    vpRef.current = resolved;
    _setVp(resolved);
    engineRef.current?.setViewport(resolved.zoom, resolved.panX, resolved.panY);
  }, []);

  const activeEntity = project.entities.find(e => e.id === project.activeEntityId);
  const template     = activeEntity
    ? resolveTemplate(project, activeEntity.templateId)
    : undefined;

  // Detect entity switch → mark camera dirty
  if (prevEntityIdRef.current !== project.activeEntityId) {
    prevEntityIdRef.current = project.activeEntityId;
    cameraDirtyRef.current  = true;
  }

  // ── Init Fabric canvas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || initialized) return;
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth  || 600;
    const h = container.clientHeight || 500;

    engineRef.current = new CanvasEngine({
      canvasEl: canvasRef.current,
      width:    w,
      height:   h,
      onSlotClick: (slotId) => setSelectedSlot(slotId),
      onSelectionChange: (sel) => {
        setEditorSelection(sel);
        if (sel.kind === "item-part" || sel.kind === "template-slot") {
          setSelectedSlot(sel.slotId);
          return;
        }
        setSelectedSlot(null);
      },
      onItemPreview: (entityId, slotId, override) => {
        previewAttachmentOverride(entityId, slotId, override);
      },
      onItemCommit: (entityId, slotId, beforeOverride, afterOverride) => {
        commitAttachmentOverride(entityId, slotId, beforeOverride, afterOverride);
      },
      onSlotTransformPreview: (slotId, transform) => {
        const st = useStore.getState();
        const eid = st.project.activeEntityId;
        const ent = eid ? st.project.entities.find(e => e.id === eid) : null;
        if (ent) previewTemplateSlotTransform(ent.templateId, slotId, transform);
      },
      onSlotTransformCommit: (slotId, beforeTransform, afterTransform) => {
        const st = useStore.getState();
        const eid = st.project.activeEntityId;
        const ent = eid ? st.project.entities.find(e => e.id === eid) : null;
        if (ent) commitTemplateSlotTransform(ent.templateId, slotId, beforeTransform, afterTransform);
      },
    });
    setInitialized(true);
    return () => { engineRef.current?.destroy(); engineRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized || !engineRef.current) {
      return;
    }

    if (!engineRef.current.isTransforming) {
      engineRef.current.commitPendingEdits();
    }
    engineRef.current.setMode(editor.canvasMode);
  }, [initialized, editor.canvasMode]);

  useEffect(() => {
    if (editor.canvasMode !== "select" && animPlayback.playing) {
      setPlaybackPlaying(false);
    }
  }, [animPlayback.playing, editor.canvasMode, setPlaybackPlaying]);

  // Ref to latest reconcile fn for ResizeObserver
  const rerenderRef = useRef<(() => void) | null>(null);

  // ── Heavy effect: entity / palette / slots / visuals / selectedSlot change ─
  useEffect(() => {
    if (!initialized || !engineRef.current) return;

    const doReconcile = async () => {
      if (!engineRef.current) return;

      if (!engineRef.current.isTransforming) {
        engineRef.current.commitPendingEdits();
      }
      const store = useStore.getState();
      const liveEntity = store.project.entities.find(e => e.id === store.project.activeEntityId);
      const liveTemplate = liveEntity
        ? resolveTemplate(store.project, liveEntity.templateId)
        : undefined;

      if (!liveEntity || !liveTemplate) {
        engineRef.current.renderEmpty("Select an entity to view it here");
        cameraDirtyRef.current = false;
        return;
      }

      const effectiveItems = refreshCanonicalBuiltInTypedItems(store.project.items);
      const pose  = buildMultiClipPose(
        store.project.animationClips,
        store.animPlayback.activeClipId,
        store.animPlayback.upperClipId,
        store.animPlayback.lowerClipId,
        store.animPlayback.upperBlendWeight,
        store.animPlayback.timeMs,
        liveEntity,
        effectiveItems,
      );
      const skeleton = evaluateSkeleton(liveTemplate.bones, pose);
      const scene    = evaluateScene(liveEntity, liveTemplate, skeleton, effectiveItems, store.project.itemFitProfiles);

      const itemsArr = effectiveItems;
      await engineRef.current.reconcileSceneStructure(
        scene,
        liveTemplate,
        editor.selectedSlotId,
        itemsArr,
        store.project.itemFitProfiles,
        liveEntity,
      );

      // Re-apply viewport after reconcile (new visuals reset internal state)
      engineRef.current.setViewport(vpRef.current.zoom, vpRef.current.panX, vpRef.current.panY);

      // Auto-fit on first render for this entity
      if (cameraDirtyRef.current) {
        cameraDirtyRef.current = false;
        const cam = engineRef.current.fitScene(scene, liveTemplate);
        applyViewport(cam);
      }
    };

    rerenderRef.current = () => { doReconcile(); };
    doReconcile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialized,
    project.activeEntityId,
    JSON.stringify(activeEntity?.slots),
    JSON.stringify(activeEntity?.palette),
    JSON.stringify(activeEntity?.visuals),
    JSON.stringify(template?.slots),
    activeEntity?.styleSetId,
    editor.selectedSlotId,
  ]);

  // ── Animation tick (≈12fps) — fast transforms only, no SVG loading ────────
  useEffect(() => {
    if (!initialized) return;
    const remove = animController.addSyncListener(() => {
      if (!engineRef.current) return;
      const store = useStore.getState();
      const eid   = store.project.activeEntityId;
      const ent   = store.project.entities.find(e => e.id === eid);
      const tmpl  = ent ? resolveTemplate(store.project, ent.templateId) : null;
      if (!ent || !tmpl) return;

      const effectiveItems = refreshCanonicalBuiltInTypedItems(store.project.items);
      const pose = buildMultiClipPose(
        store.project.animationClips,
        store.animPlayback.activeClipId,
        store.animPlayback.upperClipId,
        store.animPlayback.lowerClipId,
        store.animPlayback.upperBlendWeight,
        store.animPlayback.timeMs,
        ent,
        effectiveItems,
      );
      const skeleton = evaluateSkeleton(tmpl.bones, pose);
      const scene    = evaluateScene(ent, tmpl, skeleton, effectiveItems, store.project.itemFitProfiles);
      engineRef.current.updateSceneTransforms(scene);
    });
    return remove;
  }, [initialized]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && engineRef.current) {
          engineRef.current.resize(width, height);
          rerenderRef.current?.();
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [initialized]);

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const isMid     = e.button === 1;
    const isAltLeft = e.button === 0 && e.altKey;
    if (!isMid && !isAltLeft) return;
    e.preventDefault();
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    applyViewport(p => ({ ...p, panX: p.panX + dx, panY: p.panY + dy }));
  }, [applyViewport]);

  const stopPan = useCallback(() => { isPanning.current = false; }, []);

  const onAuxClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  }, []);

  // Alt cursor hint
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Alt") setAltHeld(true); };
    const up   = (e: KeyboardEvent) => { if (e.key === "Alt") setAltHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── Fit / Reset view ─────────────────────────────────────────────────────
  const fitView = useCallback(() => {
    if (!engineRef.current || !activeEntity || !template) {
      applyViewport({ zoom: 1, panX: 0, panY: 0 });
      return;
    }
    const store    = useStore.getState();
    const effectiveItems = refreshCanonicalBuiltInTypedItems(store.project.items);
    const skeleton = evaluateSkeleton(template.bones, new Map());
    const scene    = evaluateScene(activeEntity, template, skeleton, effectiveItems, store.project.itemFitProfiles);
    const cam      = engineRef.current.fitScene(scene, template);
    applyViewport(cam);
  }, [activeEntity, template, applyViewport]);

  // ── Wheel zoom towards cursor ─────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // pivotX/Y relative to viewport centre (matches new setViewport formula)
    const pivotX = e.clientX - rect.left  - rect.width  / 2;
    const pivotY = e.clientY - rect.top   - rect.height / 2;
    const delta  = e.ctrlKey ? e.deltaY * 0.005 : e.deltaY * 0.001;
    const factor = Math.exp(-delta);
    applyViewport(prev => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor));
      // Keep template point under cursor fixed: newPanX = pivotX - (pivotX - panX)*next/prev
      return {
        zoom: next,
        panX: pivotX - (pivotX - prev.panX) * (next / prev.zoom),
        panY: pivotY - (pivotY - prev.panY) * (next / prev.zoom),
      };
    });
  }, [applyViewport]);

  const cursor = isPanning.current ? "grabbing" : altHeld ? "grab" : "default";

  return (
    <div
      data-testid="canvas-panel"
      ref={containerRef}
      className="relative flex-1 min-w-0 bg-[#1e1e2e] overflow-hidden"
      style={{ cursor }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
      onAuxClick={onAuxClick}
      onWheel={onWheel}
    >
      {/* Canvas — no CSS transform; Fabric viewport handles zoom/pan */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      <TooltipProvider delayDuration={150}>
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/85 p-1 backdrop-blur">
          {MODE_BUTTONS.map(({ mode, label, title, icon: Icon }) => {
            const active = editor.canvasMode === mode;
            return (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={active ? "default" : "secondary"}
                    className={[
                      "h-8 gap-1.5 px-2.5 text-xs",
                      active ? "shadow-sm" : "bg-card/70",
                    ].join(" ")}
                    onClick={() => setCanvasMode(mode)}
                    aria-pressed={active}
                    data-testid={`canvas-mode-${mode}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {title}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
        <Button
          data-testid="canvas-zoom-in"
          size="icon" variant="secondary"
          className="h-7 w-7 bg-card/80 backdrop-blur border-border hover:bg-card"
          onClick={() => applyViewport(p => ({ ...p, zoom: Math.min(p.zoom * 1.25, MAX_ZOOM) }))}
        ><ZoomIn className="w-3.5 h-3.5" /></Button>
        <Button
          data-testid="canvas-zoom-out"
          size="icon" variant="secondary"
          className="h-7 w-7 bg-card/80 backdrop-blur border-border hover:bg-card"
          onClick={() => applyViewport(p => ({ ...p, zoom: Math.max(p.zoom * 0.8, MIN_ZOOM) }))}
        ><ZoomOut className="w-3.5 h-3.5" /></Button>
        <Button
          data-testid="canvas-zoom-reset"
          size="icon" variant="secondary"
          className="h-7 w-7 bg-card/80 backdrop-blur border-border hover:bg-card"
          onClick={fitView}
          title="Fit entity in view"
        ><Maximize2 className="w-3.5 h-3.5" /></Button>
      </div>

      {/* Zoom / pan info badge */}
      <div className="absolute bottom-3 left-3 z-10">
        <span className="text-[10px] text-muted-foreground bg-card/60 backdrop-blur px-1.5 py-0.5 rounded tabular-nums">
          {Math.round(vp.zoom * 100)}%
          {(vp.panX !== 0 || vp.panY !== 0) && (
            <span className="ml-1 opacity-60">
              {vp.panX > 0 ? "+" : ""}{Math.round(vp.panX)},{vp.panY > 0 ? "+" : ""}{Math.round(vp.panY)}
            </span>
          )}
        </span>
      </div>

      {/* Pan hint */}
      <div className="absolute top-3 right-3 z-10 pointer-events-none">
        <span className="text-[10px] text-muted-foreground/40">
          Wheel-click or Alt+drag to pan
        </span>
      </div>

      {/* No entity placeholder */}
      {!activeEntity && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm text-muted-foreground/50">Select or create an entity</p>
          <p className="text-xs text-muted-foreground/30 mt-1">to preview it here</p>
        </div>
      )}

      {/* Active slot indicator */}
      {editor.selectedSlotId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-primary/90 text-primary-foreground text-xs rounded-full px-3 py-1 shadow-lg animate-bounce">
            Slot selected — pick an item from the library
          </div>
        </div>
      )}
    </div>
  );
}
