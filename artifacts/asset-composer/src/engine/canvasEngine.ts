/**
 * canvasEngine.ts  (v3.0 — mode-aware, item-selectable, bone-local math)
 *
 * Coordinate contract
 * ───────────────────
 *  • All Fabric objects are placed in template / scene units (1 unit = 1 px in
 *    canvas-object space).  The template origin (0, 0) is the entity centre.
 *  • The viewport matrix maps scene units → screen pixels:
 *      [zoom, 0, 0, zoom,  vW/2 + panX,  vH/2 + panY]
 *
 * Canvas modes
 * ────────────
 *  select              — slot zones are clickable (no move)
 *  edit-attachment     — item-part images are selectable + transformable;
 *                        on object:modified → bone-local math → onItemModified
 *  edit-template-slots — slot zones are draggable;
 *                        on object:modified → onSlotTransformChanged
 *
 * Bone-local math for edit-attachment
 * ─────────────────────────────────────
 *  worldM = partBoneM × defaultTransformM × overrideM × partLocalM
 *
 *  After user drag:
 *   overrideM_new = inverse(partBoneM × defaultTransformM)
 *                   × worldM_new
 *                   × inverse(partLocalM)
 */

import { Canvas, FabricImage, Rect, FabricText, Circle } from "fabric";
import type { Template, Item, LocalTransform, AttachmentOverride, CanvasMode, EditorSelection } from "@/domain/types";
import type { EvaluatedScene, EvaluatedSkeleton } from "@/lib/evaluationPipeline";
import type { EvaluatedVisual } from "@/domain/types";
import { svgToDataUrl, scaleSvgToFit } from "@/lib/svgUtils";
import {
  decompose, identity, inverse, multiply, localTransformToMatrix, transformPoint,
} from "@/lib/matrixUtils";
import { computeSceneBounds, fitSceneToViewport, type CameraState } from "@/lib/sceneUtils";
import {
  evaluateSkeleton, evaluateScene,
  buildMultiClipPose, resolveItemPartBinding,
} from "@/lib/evaluationPipeline";
import { animController } from "@/core-v2/AnimationController";
import type { Entity } from "@/domain/types";
import type { BoneTransformMap } from "@/lib/animationRuntime";

export interface CanvasEngineOptions {
  canvasEl:               HTMLCanvasElement;
  width:                  number;
  height:                 number;
  onSlotClick?:           (slotId: string) => void;
  onSelectionChange?:     (selection: EditorSelection) => void;
  onItemModified?:        (entityId: string, slotId: string, override: Partial<AttachmentOverride>) => void;
  onSlotTransformChanged?:(slotId: string, transform: LocalTransform) => void;
}

// ── Augmented Fabric objects ──────────────────────────────────────────────────

interface TaggedFabricImage extends FabricImage {
  __visualId?:    string;
  __zIndex?:      number;
  __pixW?:        number;
  __pixH?:        number;
  __sourceKind?:  string;
  __slotId?:      string;
  __itemId?:      string;
  __partId?:      string;
  __entityId?:    string;
  __centerX?:     number;
  __centerY?:     number;
}

interface TaggedRect extends Rect {
  __slotId?:       string;
  __zIndex?:       number;
  __defaultLeft?:  number;
  __defaultTop?:   number;
}

// ── CanvasEngine ──────────────────────────────────────────────────────────────

export class CanvasEngine {
  private canvas:       Canvas;
  private opts:         CanvasEngineOptions;

  // Persistent registries
  private fabricImages: Map<string, TaggedFabricImage> = new Map();
  private svgCache:     Map<string, string>            = new Map();
  private slotZones:    Map<string, TaggedRect>        = new Map();
  private anchorGizmos: Map<string, Circle>            = new Map();
  private labelTexts:   FabricText[]                   = [];

  // Mode state
  private mode:            CanvasMode     = "select";
  private currentScene:    EvaluatedScene | null = null;
  private currentTemplate: Template       | null = null;
  private currentItems:    Item[]                = [];
  private currentEntity:   Entity | null         = null;
  private currentEntityId: string         | null = null;

  // Interaction state
  isTransforming = false;
  private pendingReconcile: (() => Promise<void>) | null = null;
  private pointerDownAt: { x: number; y: number } | null = null;

  constructor(opts: CanvasEngineOptions) {
    this.opts   = opts;
    this.canvas = new Canvas(opts.canvasEl, {
      width:           opts.width,
      height:          opts.height,
      selection:       false,
      backgroundColor: "#1e1e2e",
    });

    // ── Slot zone click detection ─────────────────────────────────────────────
    this.canvas.on("mouse:down", (ev) => {
      const p = (ev as any).absolutePointer as { x: number; y: number } | undefined;
      if (p) this.pointerDownAt = { x: p.x, y: p.y };
    });

    this.canvas.on("mouse:up", (ev) => {
      const pd = this.pointerDownAt;
      this.pointerDownAt = null;
      if (!ev.target || !pd) return;
      const p  = (ev as any).absolutePointer as { x: number; y: number } | undefined;
      const dx = (p?.x ?? 0) - pd.x;
      const dy = (p?.y ?? 0) - pd.y;
      if (Math.sqrt(dx * dx + dy * dy) >= 6) return;
      const zone = ev.target as TaggedRect;
      if (zone.__slotId && opts.onSlotClick) opts.onSlotClick(zone.__slotId);
    });

    // ── Transform tracking ────────────────────────────────────────────────────
    this.canvas.on("object:moving",   () => { this.isTransforming = true; });
    this.canvas.on("object:rotating", () => { this.isTransforming = true; });
    this.canvas.on("object:scaling",  () => { this.isTransforming = true; });

    this.canvas.on("object:modified", (ev) => {
      this.isTransforming = false;
      const target = ev.target;
      if (target) {
        const img = target as TaggedFabricImage;
        if (this.mode === "edit-attachment" && img.__sourceKind === "item-part") {
          this._handleItemModified(img);
        }
        const zone = target as TaggedRect;
        if (this.mode === "edit-template-slots" && zone.__slotId) {
          this._handleSlotZoneModified(zone);
        }
      }
      this._flushPendingReconcile();
    });

    // ── Selection events ──────────────────────────────────────────────────────
    this.canvas.on("selection:created", (ev: any) => this._onFabricSelection(ev));
    this.canvas.on("selection:updated", (ev: any) => this._onFabricSelection(ev));
    this.canvas.on("selection:cleared",  ()       => {
      this.opts.onSelectionChange?.({ kind: "none" });
    });
  }

  // ── Mode control ──────────────────────────────────────────────────────────

  setMode(mode: CanvasMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.canvas.discardActiveObject();
    this._applyModeSelectability();
    this._sortCanvasObjects();
    this.canvas.requestRenderAll();
  }

  getMode(): CanvasMode { return this.mode; }

  private _applyModeSelectability(): void {
    const isEditAttachment    = this.mode === "edit-attachment";
    const isEditTemplateSlots = this.mode === "edit-template-slots";
    const isSelectMode        = this.mode === "select";

    for (const img of this.fabricImages.values()) {
      const isItemPart = img.__sourceKind === "item-part";
      const isEntityVisual = img.__sourceKind === "entity-visual";
      const canSelect = isEditAttachment
        ? isItemPart
        : isSelectMode
          ? isItemPart || isEntityVisual
          : false;
      const canTransform = isEditAttachment && isItemPart;
      img.set({
        selectable:     canSelect,
        evented:        canSelect,
        hasControls:    canTransform,
        hasBorders:     canTransform,
        lockUniScaling: true,
        lockScalingFlip: false,
      });
    }

    for (const zone of this.slotZones.values()) {
      const movable = isEditTemplateSlots;
      zone.set({
        selectable:    isEditTemplateSlots || isSelectMode,
        evented:       isEditTemplateSlots || isSelectMode,
        lockMovementX: !movable,
        lockMovementY: !movable,
        hasControls:   false,
        hasBorders:    isEditTemplateSlots,
      });
    }
  }

  // ── Viewport ──────────────────────────────────────────────────────────────

  setViewport(zoom: number, panX: number, panY: number): void {
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    this.canvas.setViewportTransform([zoom, 0, 0, zoom, cw / 2 + panX, ch / 2 + panY]);
  }

  // ── Structure reconciliation (async — only when content changes) ──────────

  async reconcileSceneStructure(
    scene:             EvaluatedScene,
    template:          Template,
    highlightedSlotId: string | null,
    items:             Item[] = [],
    entity:            Entity | null = null,
  ): Promise<void> {
    if (this.isTransforming) {
      this.pendingReconcile = () =>
        this.reconcileSceneStructure(scene, template, highlightedSlotId, items, entity);
      return;
    }

    // Store current state for bone-local math
    this.currentScene    = scene;
    this.currentTemplate = template;
    this.currentItems    = items;
    this.currentEntity   = entity;
    this.currentEntityId = scene.entityId;

    const newIds = new Set(scene.visuals.map(v => v.id));

    // ── 1. Remove stale images ────────────────────────────────────────────────
    for (const [id, img] of this.fabricImages) {
      if (!newIds.has(id)) {
        this.canvas.remove(img);
        this.fabricImages.delete(id);
        this.svgCache.delete(id);
      }
    }

    // ── 2. Add / replace images whose svgData changed ─────────────────────────
    const loads: Promise<void>[] = [];
    for (const visual of scene.visuals) {
      const cached = this.svgCache.get(visual.id);
      if (this.fabricImages.has(visual.id) && cached === visual.svgData) continue;
      const old = this.fabricImages.get(visual.id);
      if (old) this.canvas.remove(old);
      loads.push(this._loadVisual(visual));
    }
    await Promise.all(loads);

    // ── 3. Sort canvas objects by zIndex (bottom → top) ───────────────────────

    // ── 4. Rebuild slot zones ─────────────────────────────────────────────────
    this._rebuildSlotZones(scene.skeleton, template, highlightedSlotId);

    // ── 5. Rebuild anchor gizmos ──────────────────────────────────────────────
    this._rebuildAnchorGizmos(scene.skeleton, template);

    // ── 6. Apply mode selectability ───────────────────────────────────────────
    this._applyModeSelectability();

    // ── 7. Apply current transforms ───────────────────────────────────────────
    this.updateSceneTransforms(scene);
  }

  private _sortCanvasObjects(): void {
    (this.canvas as any)._objects = this.canvas
      .getObjects()
      .sort((a: any, b: any) => (a.__zIndex ?? 0) - (b.__zIndex ?? 0));
  }

  private async _loadVisual(visual: EvaluatedVisual): Promise<void> {
    const vW   = visual.localBounds.maxX - visual.localBounds.minX;
    const vH   = visual.localBounds.maxY - visual.localBounds.minY;
    const pixW = Math.max(2, Math.round(vW));
    const pixH = Math.max(2, Math.round(vH));

    try {
      const sized  = scaleSvgToFit(visual.svgData, pixW, pixH);
      const imgEl  = await FabricImage.fromURL(svgToDataUrl(sized));
      const localCenterX = (visual.localBounds.minX + visual.localBounds.maxX) / 2;
      const localCenterY = (visual.localBounds.minY + visual.localBounds.maxY) / 2;
      const centerPoint = transformPoint(visual.worldMatrix, localCenterX, localCenterY);
      const d      = decompose(visual.worldMatrix);

      imgEl.set({
        left:      centerPoint.x,
        top:       centerPoint.y,
        angle:     d.rotation,
        scaleX:    d.scaleX,
        scaleY:    d.scaleY,
        originX:   "center",
        originY:   "center",
        selectable:     false,
        evented:        false,
        hasControls:    false,
        hasBorders:     false,
        lockUniScaling: true,
        lockScalingFlip: false,
      });

      const tagged              = imgEl as TaggedFabricImage;
      tagged.__visualId         = visual.id;
      tagged.__zIndex           = visual.zIndex;
      tagged.__pixW             = pixW;
      tagged.__pixH             = pixH;
      tagged.__sourceKind       = visual.sourceKind;
      tagged.__slotId           = visual.slotId;
      tagged.__itemId           = visual.itemId;
      tagged.__partId           = visual.partId;
      tagged.__entityId         = this.currentEntityId ?? undefined;
      tagged.__centerX          = localCenterX;
      tagged.__centerY          = localCenterY;

      this.fabricImages.set(visual.id, tagged);
      this.svgCache.set(visual.id, visual.svgData);
      this.canvas.add(tagged);
    } catch { /* silently skip broken SVGs */ }
  }

  // ── Fast transform update (sync — every animation tick) ──────────────────

  updateSceneTransforms(scene: EvaluatedScene): void {
    if (this.isTransforming) return;

    for (const visual of scene.visuals) {
      const img = this.fabricImages.get(visual.id);
      if (!img) continue;
      const localCenterX = (visual.localBounds.minX + visual.localBounds.maxX) / 2;
      const localCenterY = (visual.localBounds.minY + visual.localBounds.maxY) / 2;
      const centerPoint = transformPoint(visual.worldMatrix, localCenterX, localCenterY);
      const d = decompose(visual.worldMatrix);
      img.__centerX = localCenterX;
      img.__centerY = localCenterY;
      img.set({ left: centerPoint.x, top: centerPoint.y, angle: d.rotation, scaleX: d.scaleX, scaleY: d.scaleY });
      img.setCoords();
    }

    // Update anchor gizmo positions
    if (scene.skeleton && this.currentTemplate) {
      for (const [anchorId, circle] of this.anchorGizmos) {
        const anchor = this.currentTemplate.anchors?.[anchorId];
        if (!anchor) continue;
        const wb = scene.skeleton.bones.get(anchor.boneId);
        if (!wb) continue;
        circle.set({ left: wb.x + anchor.offsetX, top: wb.y + anchor.offsetY });
        circle.setCoords();
      }
    }

    this.canvas.requestRenderAll();
  }

  // ── Slot zone gizmos ─────────────────────────────────────────────────────

  private _rebuildSlotZones(
    skeleton:          EvaluatedSkeleton,
    template:          Template,
    highlightedSlotId: string | null,
  ): void {
    for (const zone of this.slotZones.values()) this.canvas.remove(zone);
    for (const lbl  of this.labelTexts)         this.canvas.remove(lbl);
    this.slotZones.clear();
    this.labelTexts = [];

    const hitW = Math.max(6, template.previewWidth  * 0.09);
    const hitH = Math.max(4, template.previewHeight * 0.06);

    const boneGroups = new Map<string, string[]>();
    for (const s of template.slots) {
      const g = boneGroups.get(s.boneId) ?? [];
      g.push(s.id);
      boneGroups.set(s.boneId, g);
    }

    for (const slotDef of template.slots) {
      const wb    = skeleton.bones.get(slotDef.boneId);
      const boneX = wb?.x ?? 0;
      const boneY = wb?.y ?? 0;

      // Apply defaultTransform offset if present
      const dt    = slotDef.defaultTransform;
      const dtX   = dt?.x ?? 0;
      const dtY   = dt?.y ?? 0;

      const isHigh = slotDef.id === highlightedSlotId;

      const group  = boneGroups.get(slotDef.boneId) ?? [slotDef.id];
      const idx    = group.indexOf(slotDef.id);
      const spread = hitW * 1.3;
      const ofsX   = (idx - (group.length - 1) / 2) * spread;

      const cx = boneX + dtX + ofsX;
      const cy = boneY + dtY;

      const isEditSlots = this.mode === "edit-template-slots";
      const zone = new Rect({
        left:            cx,
        top:             cy,
        width:           hitW,
        height:          hitH,
        originX:         "center",
        originY:         "center",
        fill:            isHigh ? "rgba(245,158,11,0.18)" : "rgba(99,102,241,0.10)",
        stroke:          isHigh ? "#F59E0B"               : "rgba(99,102,241,0.6)",
        strokeWidth:     isHigh ? 2 : 1,
        strokeDashArray: isHigh ? undefined : [4, 3],
        rx: 2, ry: 2,
        selectable:    isEditSlots || this.mode === "select",
        evented:       isEditSlots || this.mode === "select",
        hoverCursor:   isEditSlots ? "move" : "grab",
        moveCursor:    "grabbing",
        hasControls:   false,
        hasBorders:    isEditSlots,
        lockScalingX:  true,
        lockScalingY:  true,
        lockRotation:  true,
        lockMovementX: !isEditSlots,
        lockMovementY: !isEditSlots,
      }) as TaggedRect;
      zone.__slotId      = slotDef.id;
      zone.__zIndex      = slotDef.zIndex - 0.25;
      zone.__defaultLeft = cx;
      zone.__defaultTop  = cy;

      this.slotZones.set(slotDef.id, zone);
      this.canvas.add(zone);

      if (isHigh) {
        const lbl = new FabricText(slotDef.name, {
          left: cx, top: cy + hitH / 2 + 2,
          fontSize: Math.max(5, template.previewWidth * 0.055),
          fill: "#F59E0B",
          fontFamily: "Inter, sans-serif",
          originX: "center",
          selectable: false, evented: false,
        });
        (lbl as any).__zIndex = slotDef.zIndex - 0.2;
        this.labelTexts.push(lbl);
        this.canvas.add(lbl);
      }
    }
  }

  // ── Anchor gizmos (small circles) ────────────────────────────────────────

  private _rebuildAnchorGizmos(
    skeleton: EvaluatedSkeleton,
    template: Template,
  ): void {
    for (const c of this.anchorGizmos.values()) this.canvas.remove(c);
    this.anchorGizmos.clear();

    if (!template.anchors) return;

    for (const [anchorId, anchor] of Object.entries(template.anchors)) {
      const wb = skeleton.bones.get(anchor.boneId);
      if (!wb) continue;

      const circle = new Circle({
        left:        wb.x + anchor.offsetX,
        top:         wb.y + anchor.offsetY,
        radius:      2,
        originX:     "center",
        originY:     "center",
        fill:        "rgba(16,185,129,0.7)",
        stroke:      "rgba(16,185,129,0.9)",
        strokeWidth: 1,
        selectable:  false,
        evented:     false,
        opacity:     0,   // hidden by default; shown via showAnchors()
      });
      (circle as any).__zIndex = 85000;
      (circle as any).__anchorId = anchorId;
      this.anchorGizmos.set(anchorId, circle);
      this.canvas.add(circle);
    }
  }

  showAnchors(visible: boolean): void {
    for (const c of this.anchorGizmos.values()) c.set({ opacity: visible ? 1 : 0 });
    this.canvas.requestRenderAll();
  }

  // ── Bone-local math for item:modified ────────────────────────────────────

  private _handleItemModified(img: TaggedFabricImage): void {
    if (!img.__slotId || !img.__itemId || !img.__partId || !this.currentEntityId) return;
    if (!this.currentScene || !this.currentTemplate || !this.currentEntity) return;

    const entityId = this.currentEntityId;

    const slotDef = this.currentTemplate.slots.find(s => s.id === img.__slotId);
    if (!slotDef) return;

    const item = this.currentItems.find(i => i.id === img.__itemId);
    if (!item) return;

    const slotAssign = this.currentEntity.slots.find(s => s.slotId === img.__slotId);
    if (!slotAssign) return;
    const part = item.parts?.find(p => p.id === img.__partId);

    // New world matrix from current Fabric position
    const worldM_new = localTransformToMatrix(
      img.left  ?? 0,
      img.top   ?? 0,
      img.angle ?? 0,
      img.scaleX ?? 1,
      img.scaleY ?? 1,
    );
    const centerX = img.__centerX ?? 0;
    const centerY = img.__centerY ?? 0;
    const worldOriginM = multiply(worldM_new, localTransformToMatrix(-centerX, -centerY, 0, 1, 1));

    if (!part || part.coordinateMode === "legacy_full_frame") {
      const dt = slotDef.defaultTransform;
      const defaultTransformMatrix = dt
        ? localTransformToMatrix(dt.x, dt.y, dt.rotation, dt.scaleX, dt.scaleY)
        : identity();
      const overrideM_legacy = multiply(inverse(defaultTransformMatrix), worldOriginM);
      const d_legacy = decompose(overrideM_legacy);
      this.opts.onItemModified?.(entityId, img.__slotId!, {
        offsetX:  d_legacy.tx,
        offsetY:  d_legacy.ty,
        rotation: d_legacy.rotation,
        scaleX:   d_legacy.scaleX,
        scaleY:   d_legacy.scaleY,
      });
      return;
    }

    // overrideM = inverse(partBoneM × defaultM) × worldM_new × inverse(partLocalM)
    const lt  = part.localTransform;
    const piv = part.pivot;
    const partLocalM = localTransformToMatrix(lt.x, lt.y, lt.rotation, lt.scaleX, lt.scaleY, piv.x, piv.y);
    const binding = resolveItemPartBinding(
      this.currentEntity,
      this.currentTemplate,
      this.currentScene.skeleton,
      item,
      slotAssign,
      slotDef,
      part,
    );
    const overrideM = multiply(
      inverse(multiply(binding.parentMatrix, multiply(binding.anchorMatrix, binding.defaultTransformMatrix))),
      multiply(worldOriginM, inverse(partLocalM)),
    );

    const d = decompose(overrideM);
    this.opts.onItemModified?.(entityId, img.__slotId!, {
      offsetX:  d.tx,
      offsetY:  d.ty,
      rotation: d.rotation,
      scaleX:   d.scaleX,
      scaleY:   d.scaleY,
    });
  }

  // ── Slot zone drag for Edit Template Slots mode ───────────────────────────

  private _handleSlotZoneModified(zone: TaggedRect): void {
    if (!zone.__slotId || !this.currentTemplate) return;

    const slotDef = this.currentTemplate.slots.find(s => s.id === zone.__slotId);
    if (!slotDef) return;

    // Compute offset from bone center to new zone position
    const boneWb = this.currentScene?.skeleton.bones.get(slotDef.boneId);
    const boneX  = boneWb?.x ?? 0;
    const boneY  = boneWb?.y ?? 0;

    const newTransform: LocalTransform = {
      x:        (zone.left ?? 0) - boneX,
      y:        (zone.top  ?? 0) - boneY,
      rotation: 0,
      scaleX:   1,
      scaleY:   1,
    };

    // Update stored default so next updateSceneTransforms doesn't reset zone
    zone.__defaultLeft = zone.left ?? 0;
    zone.__defaultTop  = zone.top  ?? 0;

    this.opts.onSlotTransformChanged?.(zone.__slotId!, newTransform);
  }

  // ── Selection events ──────────────────────────────────────────────────────

  private _onFabricSelection(ev: any): void {
      const target = (ev.selected?.[0] ?? ev.target) as (TaggedFabricImage & TaggedRect) | undefined;
    if (!target || !this.opts.onSelectionChange) return;

    if (this.mode === "edit-attachment") {
      this.commitPendingEdits();
    }

    if (target.__sourceKind === "item-part" && target.__slotId && target.__itemId && target.__partId && this.currentEntityId) {
      this.opts.onSelectionChange({
        kind:     "item-part",
        entityId: this.currentEntityId,
        slotId:   target.__slotId,
        itemId:   target.__itemId,
        partId:   target.__partId,
      });
      return;
    }

    if (target.__sourceKind === "entity-visual" && target.__visualId && this.currentEntityId) {
      this.opts.onSelectionChange({
        kind: "entity-visual",
        entityId: this.currentEntityId,
        visualId: target.__visualId,
      });
      return;
    }

    if (target.__slotId && this.currentTemplate) {
      this.opts.onSelectionChange({
        kind:       "template-slot",
        templateId: this.currentTemplate.id,
        slotId:     target.__slotId,
      });
    }
  }

  private _flushPendingReconcile(): void {
    if (this.pendingReconcile) {
      const fn = this.pendingReconcile;
      this.pendingReconcile = null;
      fn();
    }
  }

  // ── Compat wrapper — called by CanvasPanel (legacy path) ──────────────────

  async renderEntityScene(
    entity:            Entity,
    template:          Template,
    items:             Map<string, Item>,
    highlightedSlotId: string | null,
    pose:              BoneTransformMap | null,
    isAnimTick         = false,
  ): Promise<void> {
    const skeleton = evaluateSkeleton(template.bones, pose ?? new Map());
    const scene    = evaluateScene(entity, template, skeleton, [...items.values()]);

    if (isAnimTick) {
      this.updateSceneTransforms(scene);
    } else {
      await this.reconcileSceneStructure(scene, template, highlightedSlotId, [...items.values()], entity);
    }
  }

  // ── Camera ───────────────────────────────────────────────────────────────

  fitScene(scene: EvaluatedScene, template: Template): CameraState {
    const bounds = computeSceneBounds(scene.visuals, template.previewWidth, template.previewHeight);
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    return fitSceneToViewport(bounds, cw, ch);
  }

  fitSceneFromVisuals(visuals: EvaluatedVisual[], frameW: number, frameH: number): CameraState {
    const bounds = computeSceneBounds(visuals, frameW, frameH);
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    return fitSceneToViewport(bounds, cw, ch);
  }

  // ── Misc ─────────────────────────────────────────────────────────────────

  renderEmpty(message = "No entity selected"): void {
    for (const img  of this.fabricImages.values()) this.canvas.remove(img);
    for (const zone of this.slotZones.values())    this.canvas.remove(zone);
    for (const c    of this.anchorGizmos.values())  this.canvas.remove(c);
    for (const lbl  of this.labelTexts)             this.canvas.remove(lbl);
    this.fabricImages.clear();
    this.svgCache.clear();
    this.slotZones.clear();
    this.anchorGizmos.clear();
    this.labelTexts = [];
    this.currentScene    = null;
    this.currentTemplate = null;
    this.currentItems    = [];
    this.currentEntity   = null;
    this.currentEntityId = null;

    this.canvas.clear();
    this.canvas.backgroundColor = "#1e1e2e";
    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    this.canvas.add(new FabricText(message, {
      left: cw / 2, top: ch / 2 - 12,
      fontSize: 14, fill: "#475569",
      fontFamily: "Inter, sans-serif",
      originX: "center", originY: "center",
      selectable: false,
    }));
    this.canvas.renderAll();
  }

  resize(width: number, height: number): void {
    this.canvas.setDimensions({ width, height });
    this.canvas.renderAll();
  }

  getCanvas(): Canvas { return this.canvas; }

  commitPendingEdits(): void {
    const target = this.canvas.getActiveObject() as (TaggedFabricImage & TaggedRect) | undefined;
    if (!target) return;

    if (this.mode === "edit-attachment" && target.__sourceKind === "item-part") {
      this._handleItemModified(target);
      return;
    }

    if (this.mode === "edit-template-slots" && target.__slotId) {
      this._handleSlotZoneModified(target);
    }
  }

  destroy(): void { this.canvas.dispose(); }
}
