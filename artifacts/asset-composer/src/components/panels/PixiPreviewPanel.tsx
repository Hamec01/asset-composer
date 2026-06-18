import { useEffect, useRef, useState, useCallback } from "react";
import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { useStore } from "@/store";
import { resolveTemplate } from "@/data/templates";
import { ITEM_ANIMATION_CLIPS } from "@/data/presetAnimations";
import {
  buildMultiClipPose,
  evaluateSkeleton,
  evaluateScene,
} from "@/lib/evaluationPipeline";
import { refreshCanonicalBuiltInTypedItems } from "@/lib/canonicalItems";
import { animController } from "@/core-v2/AnimationController";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decompose, transformPoint } from "@/lib/matrixUtils";

// ── Bone accent colours (debug skeleton overlay) ──────────────────────────────
const BONE_HEX: Record<string, number> = {
  head: 0xC89A7B, neck: 0xAA8060, chest: 0x4f9eff,
  spine: 0x3a7fd5, pelvis: 0x2a5fa5,
  shoulder_l: 0xff9f40, elbow_l: 0xff7a1a, hand_l: 0xffbc6e,
  shoulder_r: 0xff9f40, elbow_r: 0xff7a1a, hand_r: 0xffbc6e,
  hip_l: 0x4caf50, knee_l: 0x2e7d32, foot_l: 0x80e27e,
  hip_r: 0x4caf50, knee_r: 0x2e7d32, foot_r: 0x80e27e,
  body: 0x4f9eff, wing_l: 0x9c27b0, wing_r: 0x9c27b0,
  tail: 0xff5722, front_leg_l: 0x4caf50, front_leg_r: 0x2e7d32,
  back_leg_l: 0x8bc34a, back_leg_r: 0x558b2f,
  leg_l: 0x4caf50, leg_r: 0x2e7d32,
  base: 0x8E8A80, arm_main: 0xB87333, arm_counter: 0x9a6020,
  root: 0xffffff,
};

// ── SVG → rasterised PixiJS Texture ──────────────────────────────────────────
async function rasterizeSvg(svgData: string, size = 256): Promise<Texture> {
  const blob    = new Blob([svgData], { type: "image/svg+xml" });
  const blobUrl = URL.createObjectURL(blob);

  const svgImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(size, size);
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("SVG load failed"));
    img.src = blobUrl;
  });
  URL.revokeObjectURL(blobUrl);

  const offscreen = document.createElement("canvas");
  offscreen.width  = size;
  offscreen.height = size;
  offscreen.getContext("2d")!.drawImage(svgImg, 0, 0, size, size);

  const pngUrl = offscreen.toDataURL("image/png");
  const pngImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(size, size);
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("PNG load failed"));
    img.src = pngUrl;
  });

  return Texture.from(pngImg);
}

// ── Pooled sprite record ──────────────────────────────────────────────────────
interface PooledSprite {
  sprite:        Sprite;
  visualId:      string;
  localWidth:    number;
  localHeight:   number;
}

// ── Camera state ──────────────────────────────────────────────────────────────
interface CameraState {
  /** Pan offset from the viewport centre, in screen pixels */
  x:    number;
  y:    number;
  /** Zoom multiplier (1 = default "fit 220-unit skeleton to short edge") */
  zoom: number;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.15;       // factor per button click
const WHEEL_SENSITIVITY = 0.001;

// ── Component ─────────────────────────────────────────────────────────────────
export function PixiPreviewPanel() {
  const activeEntityId = useStore(s => s.project.activeEntityId);

  const entityVisualKey = useStore(s => {
    const eId    = s.project.activeEntityId;
    if (!eId) return "";
    const entity = s.project.entities.find(e => e.id === eId);
    if (!entity) return eId;
    const slotKey = entity.slots
      .map(sa => `${sa.slotId}:${sa.itemId ?? ""}:${JSON.stringify(sa.paletteOverride)}`)
      .join("|");
    return `${eId}|${entity.styleSetId}|${slotKey}|${JSON.stringify(entity.palette)}`;
  });

  const mountRef = useRef<HTMLDivElement>(null);

  // PixiJS scene refs
  const appRef             = useRef<Application | null>(null);
  const viewRef            = useRef({ w: 400, h: 300 });
  const textureCacheRef    = useRef<Map<string, Texture>>(new Map());
  const bgGfxRef           = useRef<Graphics | null>(null);
  const lineGfxRef         = useRef<Graphics | null>(null);
  const nodeGfxRef         = useRef<Graphics | null>(null);
  const hudRef             = useRef<Text | null>(null);
  const spriteLayerRef     = useRef<Container | null>(null);
  const spritePoolRef      = useRef<PooledSprite[]>([]);
  /** The container that receives pan / zoom transforms. */
  const cameraContainerRef = useRef<Container | null>(null);

  // Camera state — mutated directly to avoid React re-renders inside Pixi ticker.
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1 });
  // React state for the zoom display badge only (updated lazily).
  const [camZoom, setCamZoom] = useState(1);

  const [status, setStatus] = useState<"init" | "ready" | "error">("init");

  // Time is now owned by animController — no local clock needed.

  // ── One-time PixiJS init ──────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const app  = new Application();
    let alive  = true;

    (async () => {
      try {
        const w = el.clientWidth  || 400;
        const h = el.clientHeight || 300;
        viewRef.current = { w, h };

        await app.init({
          width:           w,
          height:          h,
          backgroundColor: 0x111218,
          antialias:       true,
          resolution:      Math.min(window.devicePixelRatio ?? 1, 2),
          autoDensity:     true,
        });
        if (!alive) { app.destroy(true); return; }

        el.appendChild(app.canvas);
        appRef.current = app;

        // ── Scene graph ────────────────────────────────────────────────────
        // bgGfx: always fills the whole viewport (no camera transform)
        // cameraContainer: receives pan/zoom; everything character-related lives here
        //   ├─ spriteLayer (character sprites, sorted by zIndex)
        //   ├─ lineGfx    (skeleton bone lines debug overlay)
        //   └─ nodeGfx    (bone dot nodes debug overlay)
        // hud: screen-space overlay (no camera transform)
        const bgGfx           = new Graphics();
        const cameraContainer = new Container();
        const spriteLayer     = new Container();
        spriteLayer.sortableChildren = true;
        const lineGfx = new Graphics();
        const nodeGfx = new Graphics();

        cameraContainer.addChild(spriteLayer, lineGfx, nodeGfx);

        const hud = new Text({
          text:  "PixiJS v8",
          style: { fontSize: 10, fill: 0x444466, fontFamily: "monospace" },
        });
        hud.position.set(8, 8);

        app.stage.addChild(bgGfx, cameraContainer, hud);

        bgGfxRef.current           = bgGfx;
        cameraContainerRef.current = cameraContainer;
        spriteLayerRef.current     = spriteLayer;
        lineGfxRef.current         = lineGfx;
        nodeGfxRef.current         = nodeGfx;
        hudRef.current             = hud;

        // Responsive resize — only resizes the renderer; camera re-centres next tick.
        const ro = new ResizeObserver(entries => {
          for (const e of entries) {
            const { width, height } = e.contentRect;
            if (width > 0 && height > 0) {
              viewRef.current = { w: width, h: height };
              app.renderer.resize(width, height);
            }
          }
        });
        ro.observe(el);
        (app as unknown as { _ro: ResizeObserver })._ro = ro;

        // ── Per-frame ticker ──────────────────────────────────────────────
        app.ticker.add(() => {
          const store = useStore.getState();
          const {
            activeClipId, upperClipId, lowerClipId, upperBlendWeight,
          } = store.animPlayback;
          const { entities, animationClips, activeEntityId: eId } = store.project;
          const items = refreshCanonicalBuiltInTypedItems(store.project.items);

          // Time is authoritative from animController — no local clock needed.
          const renderTime = animController.currentTimeMs;

          const entity   = entities.find(e => e.id === eId)          ?? null;
          const template = entity ? resolveTemplate(store.project, entity.templateId) : null;
          const { w, h } = viewRef.current;
          const cam      = cameraRef.current;
          const cc       = cameraContainerRef.current!;

          // Apply camera transform every tick (handles resize re-centring too)
          cc.x     = w / 2 + cam.x;
          cc.y     = h / 2 + cam.y;
          cc.scale.set(cam.zoom);

          // Background + dot grid (screen-space, no camera)
          const bg = bgGfxRef.current!;
          bg.clear();
          bg.rect(0, 0, w, h).fill({ color: 0x111218 });
          for (let gx = 20; gx < w; gx += 20)
            for (let gy = 20; gy < h; gy += 20)
              bg.circle(gx, gy, 0.8).fill({ color: 0xffffff, alpha: 0.04 });

          if (!template || !entity) {
            lineGfxRef.current!.clear();
            nodeGfxRef.current!.clear();
            for (const ps of spritePoolRef.current) ps.sprite.visible = false;
            hudRef.current!.text = "Select an entity to preview";
            return;
          }

          // Step 1: Build local pose
          const localPose = buildMultiClipPose(
            animationClips,
            activeClipId,
            upperClipId,
            lowerClipId,
            upperBlendWeight,
            renderTime,
            entity,
            items,
            ITEM_ANIMATION_CLIPS,
          );

          // Step 2: canonical evaluated scene
          const skeleton = evaluateSkeleton(template.bones, localPose);
          const scene = evaluateScene(entity, template, skeleton, items);

          // Step 3: viewport scale from template units to preview pixels
          const sceneScale = Math.min(w, h) / Math.max(template.previewWidth, template.previewHeight);

          // Step 4: Position sprites from canonical world matrices
          for (const ps of spritePoolRef.current) {
            const visual = scene.visuals.find(v => v.id === ps.visualId);
            if (!visual) { ps.sprite.visible = false; continue; }
            const localCenterX = (visual.localBounds.minX + visual.localBounds.maxX) / 2;
            const localCenterY = (visual.localBounds.minY + visual.localBounds.maxY) / 2;
            const center = transformPoint(visual.worldMatrix, localCenterX, localCenterY);
            const d = decompose(visual.worldMatrix);
            ps.sprite.visible  = true;
            ps.sprite.x        = center.x * sceneScale;
            ps.sprite.y        = center.y * sceneScale;
            ps.sprite.rotation = (d.rotation * Math.PI) / 180;
            ps.sprite.width    = ps.localWidth * sceneScale * d.scaleX;
            ps.sprite.height   = ps.localHeight * sceneScale * d.scaleY;
          }

          const skelScale = sceneScale;

          // Step 5: Skeleton lines (camera-local)
          const lg = lineGfxRef.current!;
          lg.clear();
          for (const bone of template.bones) {
            if (!bone.parentId) continue;
            const wb     = skeleton.bones.get(bone.id);
            const parent = skeleton.bones.get(bone.parentId);
            if (!wb || !parent) continue;
            lg.moveTo(parent.x * skelScale, parent.y * skelScale)
              .lineTo(wb.x * skelScale, wb.y * skelScale)
              .stroke({ color: 0xffffff, alpha: 0.08, width: 1.5 * skelScale });
          }

          // Step 6: Bone dots (camera-local)
          const ng = nodeGfxRef.current!;
          ng.clear();
          for (const bone of template.bones) {
            const wb = skeleton.bones.get(bone.id);
            if (!wb) continue;
            const color = BONE_HEX[bone.id] ?? 0x888888;
            const r     = bone.id === "root" ? 2 * skelScale
              : bone.id.includes("head") ? 6 * skelScale
              : 2.5 * skelScale;
            ng.circle(wb.x * skelScale, wb.y * skelScale, r)
              .fill({ color, alpha: 0.35 });
          }

          const visibleCount = scene.visuals.length;
          hudRef.current!.text =
            `PixiJS v8 · ${template.skeletonFamily} · `+
            `${visibleCount} layers · `+
            `${Math.round(renderTime)}ms`;
        });

        setStatus("ready");
      } catch (err) {
        console.error("[PixiPreviewPanel] init failed:", err);
        if (alive) setStatus("error");
      }
    })();

    return () => {
      alive = false;
      const a = appRef.current;
      if (a) {
        (a as unknown as { _ro?: ResizeObserver })._ro?.disconnect();
        a.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  // ── Rebuild sprite pool on entity visual changes ──────────────────────────
  useEffect(() => {
    const spriteLayer = spriteLayerRef.current;
    if (!spriteLayer) return;

    for (const { sprite } of spritePoolRef.current) {
      spriteLayer.removeChild(sprite);
      sprite.destroy({ texture: false });
    }
    spritePoolRef.current = [];
    textureCacheRef.current.clear();

    if (!activeEntityId) return;

    const store    = useStore.getState();
    const entity   = store.project.entities.find(e => e.id === activeEntityId);
    const template = entity ? resolveTemplate(store.project, entity.templateId) : null;
    if (!entity || !template) return;

    const restSkeleton = evaluateSkeleton(template.bones, new Map());
    const items        = refreshCanonicalBuiltInTypedItems(store.project.items);
    const scene        = evaluateScene(entity, template, restSkeleton, items);

    (async () => {
      const newPool: PooledSprite[] = [];

      for (const visual of scene.visuals) {
        if (!spriteLayerRef.current) return;

        const cacheKey = visual.id;
        let texture = textureCacheRef.current.get(cacheKey);
        if (!texture) {
          try {
            texture = await rasterizeSvg(visual.svgData, 256);
            textureCacheRef.current.set(cacheKey, texture);
          } catch (e) {
            console.warn("[PixiPreviewPanel] rasterize failed:", cacheKey, e);
            continue;
          }
        }

        const sprite       = new Sprite(texture);
        sprite.anchor.set(0.5, 0.5);
        sprite.zIndex      = visual.zIndex;
        sprite.visible     = false;
        spriteLayerRef.current.addChild(sprite);
        const localWidth = visual.localBounds.maxX - visual.localBounds.minX;
        const localHeight = visual.localBounds.maxY - visual.localBounds.minY;

        newPool.push({
          sprite,
          visualId:      visual.id,
          localWidth,
          localHeight,
        });
      }

      spritePoolRef.current = newPool;
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityVisualKey]);

  // ── Camera helpers ────────────────────────────────────────────────────────
  /** Apply a zoom factor around a screen-space point (px, py). */
  const applyZoom = useCallback((factor: number, pivotX?: number, pivotY?: number) => {
    const cam = cameraRef.current;
    const { w, h } = viewRef.current;
    const oldZoom = cam.zoom;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
    if (newZoom === oldZoom) return;

    // Zoom towards pivot (default: viewport centre = no pan change)
    const px = (pivotX ?? w / 2) - w / 2;
    const py = (pivotY ?? h / 2) - h / 2;
    // The world point under the pivot must stay fixed:
    //   worldX = (px - cam.x) / oldZoom
    //   newCamX = px - worldX * newZoom
    cameraRef.current = {
      x:    px - ((px - cam.x) / oldZoom) * newZoom,
      y:    py - ((py - cam.y) / oldZoom) * newZoom,
      zoom: newZoom,
    };
    setCamZoom(newZoom);
  }, []);

  const fitView = useCallback(() => {
    cameraRef.current = { x: 0, y: 0, zoom: 1 };
    setCamZoom(1);
  }, []);

  // ── Mouse / pointer event handlers (pan + wheel zoom) ─────────────────────
  const isPanningRef  = useRef(false);
  const lastPanRef    = useRef({ x: 0, y: 0 });

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect   = mountRef.current?.getBoundingClientRect();
    const pivotX = rect ? e.clientX - rect.left : undefined;
    const pivotY = rect ? e.clientY - rect.top  : undefined;
    // Pinch-to-zoom sends ctrlKey=true with deltaY in pixels; wheel sends deltaY in lines.
    const delta  = e.ctrlKey ? e.deltaY * WHEEL_SENSITIVITY * 5 : e.deltaY * WHEEL_SENSITIVITY;
    const factor = Math.exp(-delta);
    applyZoom(factor, pivotX, pivotY);
  }, [applyZoom]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Middle-click or Space+left-drag: start pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      isPanningRef.current = true;
      lastPanRef.current   = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastPanRef.current.x;
    const dy = e.clientY - lastPanRef.current.y;
    lastPanRef.current = { x: e.clientX, y: e.clientY };
    cameraRef.current = {
      ...cameraRef.current,
      x: cameraRef.current.x + dx,
      y: cameraRef.current.y + dy,
    };
  }, []);

  const onPointerUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#111218]">
      <div
        ref={mountRef}
        className="flex-1 relative overflow-hidden"
        data-testid="pixi-preview-mount"
        style={{ cursor: isPanningRef.current ? "grabbing" : "default" }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {status === "init" && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Initialising renderer…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center text-destructive text-sm">
            WebGL not available
          </div>
        )}

        {/* Camera controls */}
        {status === "ready" && (
          <>
            <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 bg-card/80 backdrop-blur border-border hover:bg-card"
                onClick={() => applyZoom(1 + ZOOM_STEP)}
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 bg-card/80 backdrop-blur border-border hover:bg-card"
                onClick={() => applyZoom(1 / (1 + ZOOM_STEP))}
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 bg-card/80 backdrop-blur border-border hover:bg-card"
                onClick={fitView}
                title="Fit to screen (reset camera)"
              >
                <Maximize className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Zoom level badge */}
            <div className="absolute bottom-3 left-3 z-10">
              <span className="text-[10px] text-muted-foreground bg-card/60 backdrop-blur px-1.5 py-0.5 rounded tabular-nums">
                {Math.round(camZoom * 100)}%
              </span>
            </div>

            {/* Pan hint */}
            <div className="absolute top-3 right-3 z-10 pointer-events-none">
              <span className="text-[10px] text-muted-foreground/40">
                Scroll to zoom · Alt+drag to pan
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
