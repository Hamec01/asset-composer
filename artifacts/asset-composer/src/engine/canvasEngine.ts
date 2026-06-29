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

import { Canvas, FabricImage, Rect, FabricText, Circle, util as fabricUtil } from "fabric";
import type { Template, Item, LocalTransform, AttachmentOverride, CanvasMode, EditorSelection, ItemFitProfile, SlotEditorState } from "@/domain/types";
import type { EvaluatedScene, EvaluatedSkeleton } from "@/lib/evaluationPipeline";
import type { EvaluatedVisual } from "@/domain/types";
import { svgToDataUrl, scaleSvgToFit } from "@/lib/svgUtils";
import {
  decompose, identity, inverse, multiply, localTransformToMatrix, transformPoint, worldBoneToMatrix,
} from "@/lib/matrixUtils";
import { computeSceneBounds, fitSceneToViewport, type CameraState } from "@/lib/sceneUtils";
import {
  getTemplateSlotTransformFromWorldCenter,
  getTemplateSlotWorldCenter,
} from "@/lib/templateSlotTransforms";
import { getVisibleTemplateSlots } from "@/lib/slotVisibility";
import {
  evaluateSkeleton, evaluateScene,
  buildMultiClipPose, resolveItemPartBinding,
} from "@/lib/evaluationPipeline";
import { resolveItemFitPartTransform } from "@/lib/itemFitProfiles";
import { animController } from "@/core-v2/AnimationController";
import type { Entity } from "@/domain/types";
import type { BoneTransformMap } from "@/lib/animationRuntime";

export interface CanvasEngineOptions {
  canvasEl:               HTMLCanvasElement;
  width:                  number;
  height:                 number;
  onSlotClick?:           (slotId: string) => void;
  onSelectionChange?:     (selection: EditorSelection) => void;
  onItemPreview?:         (entityId: string, slotId: string, override: AttachmentOverride) => void;
  onItemCommit?:          (
    entityId: string,
    slotId: string,
    beforeOverride: AttachmentOverride,
    afterOverride: AttachmentOverride,
  ) => void;
  isEditingFitTransform?: (
    entityId: string,
    slotId: string,
    itemId: string,
    partId: string,
  ) => boolean;
  onItemFitPreview?: (
    entityId: string,
    slotId: string,
    itemId: string,
    partId: string,
    transform: LocalTransform,
  ) => void;
  onItemFitCommit?: (
    entityId: string,
    slotId: string,
    itemId: string,
    partId: string,
    beforeTransform: LocalTransform,
    afterTransform: LocalTransform,
  ) => void;
  onSlotTransformPreview?: (slotId: string, transform: LocalTransform) => void;
  onSlotTransformCommit?: (
    slotId: string,
    beforeTransform: LocalTransform,
    afterTransform: LocalTransform,
  ) => void;
  onItemModified?:        (entityId: string, slotId: string, override: Partial<AttachmentOverride>) => void;
  onSlotTransformChanged?:(slotId: string, transform: LocalTransform) => void;
}

// ── Augmented Fabric objects ──────────────────────────────────────────────────

interface TaggedFabricImage extends FabricImage {
  __visualId?:    string;
  __zIndex?:      number;
  __pixW?:        number;
  __pixH?:        number;
  __generation?:  number;
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
  __locked?:       boolean;
}

interface TaggedText extends FabricText {
  __slotId?: string;
}

interface AttachmentTransformGestureSnapshot {
  entityId: string;
  slotId: string;
  beforeOverride: AttachmentOverride;
}

interface FitTransformGestureSnapshot {
  entityId: string;
  slotId: string;
  itemId: string;
  partId: string;
  beforeTransform: LocalTransform;
}

interface SlotTransformGestureSnapshot {
  slotId: string;
  beforeTransform: LocalTransform;
}

type ActiveSelectionSnapshot =
  | { kind: "visual"; visualId: string }
  | { kind: "slot"; slotId: string }
  | null;

function normalizeAttachmentOverride(override: Partial<AttachmentOverride> | undefined): AttachmentOverride {
  return {
    anchorId: override?.anchorId ?? "",
    bindMode: override?.bindMode ?? "",
    offsetX: override?.offsetX ?? 0,
    offsetY: override?.offsetY ?? 0,
    rotation: override?.rotation ?? 0,
    scaleX: override?.scaleX ?? 1,
    scaleY: override?.scaleY ?? 1,
  };
}

function normalizeLocalTransform(transform: LocalTransform | undefined): LocalTransform {
  return {
    x: transform?.x ?? 0,
    y: transform?.y ?? 0,
    rotation: transform?.rotation ?? 0,
    scaleX: transform?.scaleX ?? 1,
    scaleY: transform?.scaleY ?? 1,
  };
}

function sameAttachmentOverride(a: AttachmentOverride, b: AttachmentOverride): boolean {
  return (
    a.anchorId === b.anchorId &&
    a.bindMode === b.bindMode &&
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY &&
    a.rotation === b.rotation &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY
  );
}

function sameLocalTransform(a: LocalTransform, b: LocalTransform): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.rotation === b.rotation &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY
  );
}

function slotBoneMatrix(
  skeleton: EvaluatedSkeleton | null,
  slotDef: Template["slots"][number],
) {
  const worldBone = skeleton?.bones.get(slotDef.boneId);
  return worldBone ? worldBoneToMatrix(worldBone) : identity();
}

function makeFabricImagePlacement(
  worldMatrix: ReturnType<typeof identity>,
  localCenterX: number,
  localCenterY: number,
) {
  const centeredMatrix = multiply(worldMatrix, localTransformToMatrix(localCenterX, localCenterY, 0, 1, 1));
  return fabricUtil.qrDecompose(centeredMatrix);
}

function devLogCanvas(event: string, details: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  console.info("[asset-composer][canvas]", event, details);
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
  private slotLabels:   Map<string, TaggedText>        = new Map();

  // Mode state
  private mode:            CanvasMode     = "select";
  private currentScene:    EvaluatedScene | null = null;
  private currentTemplate: Template       | null = null;
  private currentItems:    Item[]                = [];
  private currentFitProfiles: ItemFitProfile[]   = [];
  private currentEntity:   Entity | null         = null;
  private currentEntityId: string         | null = null;

  // Interaction state
  isTransforming = false;
  private pendingReconcile: (() => Promise<void>) | null = null;
  private pointerDownAt: { x: number; y: number } | null = null;
  private activeAttachmentGesture: AttachmentTransformGestureSnapshot | null = null;
  private activeFitGesture: FitTransformGestureSnapshot | null = null;
  private activeSlotGesture: SlotTransformGestureSnapshot | null = null;
  private reconcileGeneration = 0;

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
    this.canvas.on("object:moving",   (ev) => {
      this.isTransforming = true;
      this._handleTransformPreview(ev.target as (TaggedFabricImage & TaggedRect) | undefined);
    });
    this.canvas.on("object:rotating", (ev) => {
      this.isTransforming = true;
      const target = ev.target as (TaggedFabricImage & TaggedRect) | undefined;
      const shiftHeld = Boolean((ev as any)?.e?.shiftKey);
      if (shiftHeld && target && typeof target.angle === "number") {
        target.set({ angle: Math.round(target.angle / 15) * 15 });
        target.setCoords();
      }
      this._handleTransformPreview(target);
    });
    this.canvas.on("object:scaling",  (ev) => {
      this.isTransforming = true;
      this._handleTransformPreview(ev.target as (TaggedFabricImage & TaggedRect) | undefined);
    });

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
      this.activeAttachmentGesture = null;
      this.activeFitGesture = null;
      this.activeSlotGesture = null;
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

  private _captureActiveSelection(): ActiveSelectionSnapshot {
    const activeObject = this.canvas.getActiveObject() as (TaggedFabricImage & TaggedRect) | undefined;
    if (!activeObject) return null;
    if (activeObject.__visualId) return { kind: "visual", visualId: activeObject.__visualId };
    if (activeObject.__slotId) return { kind: "slot", slotId: activeObject.__slotId };
    return null;
  }

  private _restoreActiveSelection(snapshot: ActiveSelectionSnapshot): void {
    if (!snapshot) return;
    if (snapshot.kind === "visual") {
      const visual = this.fabricImages.get(snapshot.visualId);
      if (visual) this.canvas.setActiveObject(visual);
      return;
    }
    const zone = this.slotZones.get(snapshot.slotId);
    if (zone) this.canvas.setActiveObject(zone);
  }

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
        lockMovementX: !movable || Boolean(zone.__locked),
        lockMovementY: !movable || Boolean(zone.__locked),
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
    fitProfiles:       ItemFitProfile[] = [],
    entity:            Entity | null = null,
    slotEditorState:   SlotEditorState = { hiddenSlotIds: [], lockedSlotIds: [] },
  ): Promise<void> {
    const generation = ++this.reconcileGeneration;
    if (this.isTransforming) {
      this.pendingReconcile = () =>
        this.reconcileSceneStructure(scene, template, highlightedSlotId, items, fitProfiles, entity, slotEditorState);
      return;
    }

    const activeSelection = this._captureActiveSelection();

    // Store current state for bone-local math
    this.currentScene    = scene;
    this.currentTemplate = template;
    this.currentItems    = items;
    this.currentFitProfiles = fitProfiles;
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
      if (old) {
        this.canvas.remove(old);
        this.fabricImages.delete(visual.id);
        this.svgCache.delete(visual.id);
      }
      loads.push(this._loadVisual(visual, generation));
    }
    await Promise.all(loads);
    if (generation !== this.reconcileGeneration) return;
    this._pruneOrphanedFabricObjects(newIds);

    // ── 3. Sort canvas objects by zIndex (bottom → top) ───────────────────────

    // ── 4. Rebuild slot zones ─────────────────────────────────────────────────
    this._rebuildSlotZones(scene.skeleton, template, highlightedSlotId, slotEditorState);

    // ── 5. Rebuild anchor gizmos ──────────────────────────────────────────────
    this._rebuildAnchorGizmos(scene.skeleton, template);

    // ── 6. Apply mode selectability ───────────────────────────────────────────
    this._applyModeSelectability();

    // ── 7. Apply current transforms ───────────────────────────────────────────
    this.updateSceneTransforms(scene);
    this._restoreActiveSelection(activeSelection);

    const DEBUG_CANVAS_INVARIANTS = false;
    if (DEBUG_CANVAS_INVARIANTS) {
      const sceneIds = new Set(scene.visuals.map(v => v.id));
      const fabricIds = new Set(this.fabricImages.keys());

      for (const id of sceneIds) {
        if (!fabricIds.has(id)) {
          console.error(`[Invariant] Missing Fabric object for visual ID: ${id}`);
        }
      }
      for (const id of fabricIds) {
        if (!sceneIds.has(id)) {
          console.error(`[Invariant] Stale Fabric object remains for ID: ${id}`);
        }
      }
    }
  }

  private _sortCanvasObjects(): void {
    (this.canvas as any)._objects = this.canvas
      .getObjects()
      .sort((a: any, b: any) => (a.__zIndex ?? 0) - (b.__zIndex ?? 0));
  }

  private async _loadVisual(visual: EvaluatedVisual, generation: number): Promise<void> {
    const vW   = visual.localBounds.maxX - visual.localBounds.minX;
    const vH   = visual.localBounds.maxY - visual.localBounds.minY;
    const pixW = Math.max(2, Math.round(vW));
    const pixH = Math.max(2, Math.round(vH));

    try {
      const sized  = scaleSvgToFit(visual.svgData, pixW, pixH, visual.svgFitMode ?? "legacy_full_frame");
      const imgEl  = await FabricImage.fromURL(svgToDataUrl(sized));
      const localCenterX = (visual.localBounds.minX + visual.localBounds.maxX) / 2;
      const localCenterY = (visual.localBounds.minY + visual.localBounds.maxY) / 2;
      const placement = makeFabricImagePlacement(visual.worldMatrix, localCenterX, localCenterY);

      imgEl.set({
        left:      placement.translateX,
        top:       placement.translateY,
        angle:     placement.angle,
        scaleX:    placement.scaleX,
        scaleY:    placement.scaleY,
        skewX:     placement.skewX ?? 0,
        skewY:     placement.skewY ?? 0,
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
      tagged.__generation       = generation;
      tagged.__sourceKind       = visual.sourceKind;
      tagged.__slotId           = visual.slotId;
      tagged.__itemId           = visual.itemId;
      tagged.__partId           = visual.partId;
      tagged.__entityId         = this.currentEntityId ?? undefined;
      tagged.__centerX          = localCenterX;
      tagged.__centerY          = localCenterY;

      if (generation !== this.reconcileGeneration) {
        devLogCanvas("skip-stale-visual-load", {
          visualId: visual.id,
          loadGeneration: generation,
          currentGeneration: this.reconcileGeneration,
        });
        return;
      }

      this.fabricImages.set(visual.id, tagged);
      this.svgCache.set(visual.id, visual.svgData);
      this.canvas.add(tagged);
    } catch { /* silently skip broken SVGs */ }
  }

  private _pruneOrphanedFabricObjects(validIds: Set<string>): void {
    for (const object of this.canvas.getObjects()) {
      const image = object as TaggedFabricImage;
      const visualId = image.__visualId;
      if (!visualId) continue;

      const tracked = this.fabricImages.get(visualId);
      const isTrackedInstance = tracked === image;
      if (isTrackedInstance && validIds.has(visualId)) continue;

      devLogCanvas("prune-orphan-visual", {
        visualId,
        trackedInstance: isTrackedInstance,
        hasValidId: validIds.has(visualId),
      });
      this.canvas.remove(image);
      if (tracked === image) {
        this.fabricImages.delete(visualId);
        this.svgCache.delete(visualId);
      }
    }
  }

  // ── Fast transform update (sync — every animation tick) ──────────────────

  updateSceneTransforms(scene: EvaluatedScene): void {
    if (this.isTransforming) return;

    for (const visual of scene.visuals) {
      const img = this.fabricImages.get(visual.id);
      if (!img) continue;
      const localCenterX = (visual.localBounds.minX + visual.localBounds.maxX) / 2;
      const localCenterY = (visual.localBounds.minY + visual.localBounds.maxY) / 2;
      const placement = makeFabricImagePlacement(visual.worldMatrix, localCenterX, localCenterY);
      img.__centerX = localCenterX;
      img.__centerY = localCenterY;
      img.set({
        left: placement.translateX,
        top: placement.translateY,
        angle: placement.angle,
        scaleX: placement.scaleX,
        scaleY: placement.scaleY,
        skewX: placement.skewX ?? 0,
        skewY: placement.skewY ?? 0,
      });
      img.setCoords();
    }

    // Update anchor gizmo positions
    this.currentScene = scene;

    if (scene.skeleton && this.currentTemplate) {
      const visibleSlots = getVisibleTemplateSlots(this.currentTemplate);
      const boneGroups = new Map<string, string[]>();
      for (const slotDef of visibleSlots) {
        const group = boneGroups.get(slotDef.boneId) ?? [];
        group.push(slotDef.id);
        boneGroups.set(slotDef.boneId, group);
      }

      for (const slotDef of visibleSlots) {
        const zone = this.slotZones.get(slotDef.id);
        if (!zone) continue;

        const bone = scene.skeleton.bones.get(slotDef.boneId);
        const center = getTemplateSlotWorldCenter(slotDef, bone);
        const group = boneGroups.get(slotDef.boneId) ?? [slotDef.id];
        const spreadIndex = group.indexOf(slotDef.id);
        const spread = this.mode === "edit-template-slots"
          ? 0
          : (spreadIndex - (group.length - 1) / 2) * Math.max(6, this.currentTemplate.previewWidth * 0.09) * 1.3;
        zone.set({
          left: center.x + spread,
          top: center.y,
        });
        zone.__defaultLeft = center.x + spread;
        zone.__defaultTop = center.y;
        zone.setCoords();

        const label = this.slotLabels.get(slotDef.id);
        if (label) {
          const hitH = Math.max(4, this.currentTemplate.previewHeight * 0.06);
          label.set({
            left: center.x + spread,
            top: center.y + hitH / 2 + 2,
          });
          label.setCoords();
        }
      }

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
    slotEditorState:   SlotEditorState = { hiddenSlotIds: [], lockedSlotIds: [] },
  ): void {
    for (const zone of this.slotZones.values()) this.canvas.remove(zone);
    for (const lbl of this.slotLabels.values()) this.canvas.remove(lbl);
    this.slotZones.clear();
    this.slotLabels.clear();

    const hitW = Math.max(6, template.previewWidth  * 0.09);
    const hitH = Math.max(4, template.previewHeight * 0.06);

    const boneGroups = new Map<string, string[]>();
    const visibleSlots = getVisibleTemplateSlots(template);
    for (const s of visibleSlots) {
      const g = boneGroups.get(s.boneId) ?? [];
      g.push(s.id);
      boneGroups.set(s.boneId, g);
    }

    const hiddenSlotIds = new Set(slotEditorState.hiddenSlotIds);
    const lockedSlotIds = new Set(slotEditorState.lockedSlotIds);

    for (const slotDef of visibleSlots) {
      if (hiddenSlotIds.has(slotDef.id)) continue;
      const wb    = skeleton.bones.get(slotDef.boneId);
      const center = getTemplateSlotWorldCenter(slotDef, wb);

      const isHigh = slotDef.id === highlightedSlotId;

      const group  = boneGroups.get(slotDef.boneId) ?? [slotDef.id];
      const idx    = group.indexOf(slotDef.id);
      const spread = this.mode === "edit-template-slots" ? 0 : hitW * 1.3;
      const ofsX   = (idx - (group.length - 1) / 2) * spread;

      const cx = center.x + ofsX;
      const cy = center.y;

      const isEditSlots = this.mode === "edit-template-slots";
      const isLocked = lockedSlotIds.has(slotDef.id);
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
        lockMovementX: !isEditSlots || isLocked,
        lockMovementY: !isEditSlots || isLocked,
      }) as TaggedRect;
      zone.__slotId      = slotDef.id;
      zone.__zIndex      = slotDef.zIndex - 0.25;
      zone.__defaultLeft = cx;
      zone.__defaultTop  = cy;
      zone.__locked      = isLocked;

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
        }) as TaggedText;
        (lbl as any).__zIndex = slotDef.zIndex - 0.2;
        lbl.__slotId = slotDef.id;
        this.slotLabels.set(slotDef.id, lbl);
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

  private _handleTransformPreview(target: (TaggedFabricImage & TaggedRect) | undefined): void {
    if (!target) return;

    if (this.mode === "edit-attachment" && target.__sourceKind === "item-part") {
      if (this._isEditingFitTransform(target)) {
        this._ensureFitGestureSnapshot(target);
        const transform = this._computePartTransformFromFabricImage(target);
        if (transform && this.currentEntityId && target.__slotId && target.__itemId && target.__partId) {
          this.opts.onItemFitPreview?.(
            this.currentEntityId,
            target.__slotId,
            target.__itemId,
            target.__partId,
            transform,
          );
        }
        return;
      }
      this._ensureAttachmentGestureSnapshot(target);
      this._previewMultiPartAttachment(target);
      const override = this._computeOverrideFromFabricImage(target);
      if (override && this.currentEntityId && target.__slotId) {
        this.opts.onItemPreview?.(this.currentEntityId, target.__slotId, override);
      }
      return;
    }

    if (this.mode === "edit-template-slots" && target.__slotId) {
      this._ensureSlotGestureSnapshot(target);
      const nextTransform = this._getSlotTransformFromZone(target);
      if (nextTransform) {
        this.opts.onSlotTransformPreview?.(target.__slotId, nextTransform);
      }
    }
  }

  private _ensureAttachmentGestureSnapshot(img: TaggedFabricImage): void {
    if (this.activeAttachmentGesture || !this.currentEntity || !img.__slotId || !this.currentEntityId) return;
    const slotAssign = this.currentEntity.slots.find(slot => slot.slotId === img.__slotId);
    if (!slotAssign) return;
    this.activeAttachmentGesture = {
      entityId: this.currentEntityId,
      slotId: img.__slotId,
      beforeOverride: normalizeAttachmentOverride(slotAssign.attachmentOverride),
    };
  }

  private _isEditingFitTransform(img: TaggedFabricImage): boolean {
    return Boolean(
      this.currentEntityId &&
      img.__slotId &&
      img.__itemId &&
      img.__partId &&
      this.opts.isEditingFitTransform?.(this.currentEntityId, img.__slotId, img.__itemId, img.__partId),
    );
  }

  private _getEffectivePartTransform(
    item: Item,
    slotDef: Template["slots"][number],
    part: NonNullable<Item["parts"]>[number],
  ): LocalTransform {
    return resolveItemFitPartTransform(
      item,
      this.currentTemplate!,
      slotDef,
      part.id,
      this.currentFitProfiles,
    ) ?? part.localTransform;
  }

  private _ensureFitGestureSnapshot(img: TaggedFabricImage): void {
    if (this.activeFitGesture || !this.currentEntityId || !this.currentTemplate || !this.currentEntity) return;
    if (!img.__slotId || !img.__itemId || !img.__partId) return;
    const slotDef = this.currentTemplate.slots.find(slot => slot.id === img.__slotId);
    const item = this.currentItems.find(candidate => candidate.id === img.__itemId);
    const part = item?.parts?.find(candidate => candidate.id === img.__partId);
    if (!slotDef || !item || !part) return;
    this.activeFitGesture = {
      entityId: this.currentEntityId,
      slotId: img.__slotId,
      itemId: img.__itemId,
      partId: img.__partId,
      beforeTransform: normalizeLocalTransform(this._getEffectivePartTransform(item, slotDef, part)),
    };
  }

  private _ensureSlotGestureSnapshot(zone: TaggedRect): void {
    if (this.activeSlotGesture || !this.currentTemplate || !zone.__slotId) return;
    const slotDef = this.currentTemplate.slots.find(slot => slot.id === zone.__slotId);
    if (!slotDef) return;
    this.activeSlotGesture = {
      slotId: zone.__slotId,
      beforeTransform: normalizeLocalTransform(slotDef.defaultTransform),
    };
  }

  // ── Bone-local math for item:modified ────────────────────────────────────

  private _handleItemModified(img: TaggedFabricImage): void {
    if (!img.__slotId || !this.currentEntityId) return;
    if (this._isEditingFitTransform(img)) {
      const snapshot = this.activeFitGesture;
      const afterTransform = this._computePartTransformFromFabricImage(img);
      if (snapshot && afterTransform) {
        if (
          snapshot.entityId === this.currentEntityId &&
          snapshot.slotId === img.__slotId &&
          snapshot.itemId === img.__itemId &&
          snapshot.partId === img.__partId
        ) {
          if (!sameLocalTransform(snapshot.beforeTransform, afterTransform)) {
            this.opts.onItemFitCommit?.(
              snapshot.entityId,
              snapshot.slotId,
              snapshot.itemId,
              snapshot.partId,
              snapshot.beforeTransform,
              afterTransform,
            );
          }
        }
      }
      return;
    }

    const snapshot = this.activeAttachmentGesture;
    const afterOverride = this._computeOverrideFromFabricImage(img);
    if (snapshot && afterOverride) {
      if (snapshot.slotId === img.__slotId && snapshot.entityId === this.currentEntityId) {
        if (!sameAttachmentOverride(snapshot.beforeOverride, afterOverride)) {
          this.opts.onItemCommit?.(snapshot.entityId, snapshot.slotId, snapshot.beforeOverride, afterOverride);
        }
        return;
      }
    }

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

    if (!part || part.coordinateMode === "legacy_full_frame") {
      const worldOriginM = this._getFabricImageWorldOriginMatrix(img);
      const dt = slotDef.defaultTransform;
      const defaultTransformMatrix = dt
        ? localTransformToMatrix(dt.x, dt.y, dt.rotation, dt.scaleX, dt.scaleY)
        : identity();
      const parentMatrix = slotBoneMatrix(this.currentScene.skeleton, slotDef);
      const overrideM_legacy = multiply(
        inverse(multiply(parentMatrix, defaultTransformMatrix)),
        worldOriginM,
      );
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
    const overrideM = this._computeAttachmentOverrideMatrix(slotDef, item, slotAssign, part, img);
    if (!overrideM) return;

    const d = decompose(overrideM);
    this.opts.onItemModified?.(entityId, img.__slotId!, {
      offsetX:  d.tx,
      offsetY:  d.ty,
      rotation: d.rotation,
      scaleX:   d.scaleX,
      scaleY:   d.scaleY,
    });
  }

  private _getFabricImageWorldOriginMatrix(img: TaggedFabricImage): ReturnType<typeof localTransformToMatrix> {
    const worldM = fabricUtil.composeMatrix({
      translateX: img.left ?? 0,
      translateY: img.top ?? 0,
      angle: img.angle ?? 0,
      scaleX: img.scaleX ?? 1,
      scaleY: img.scaleY ?? 1,
      skewX: img.skewX ?? 0,
      skewY: img.skewY ?? 0,
    }) as ReturnType<typeof localTransformToMatrix>;
    const centerX = img.__centerX ?? 0;
    const centerY = img.__centerY ?? 0;
    return multiply(worldM, localTransformToMatrix(-centerX, -centerY, 0, 1, 1));
  }

  private _computeAttachmentOverrideMatrix(
    slotDef: Template["slots"][number],
    item: Item,
    slotAssign: Entity["slots"][number],
    part: NonNullable<Item["parts"]>[number],
    img: TaggedFabricImage,
  ) {
    if (!this.currentEntity || !this.currentTemplate || !this.currentScene) return null;
    const lt  = this._getEffectivePartTransform(item, slotDef, part);
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
      this.currentFitProfiles,
    );
    const worldOriginM = this._getFabricImageWorldOriginMatrix(img);
    return multiply(
      inverse(multiply(binding.parentMatrix, multiply(binding.anchorMatrix, binding.defaultTransformMatrix))),
      multiply(worldOriginM, inverse(partLocalM)),
    );
  }

  private _computePartTransformFromFabricImage(img: TaggedFabricImage): LocalTransform | null {
    if (!img.__slotId || !img.__itemId || !img.__partId) return null;
    if (!this.currentScene || !this.currentTemplate || !this.currentEntity) return null;

    const slotDef = this.currentTemplate.slots.find(slot => slot.id === img.__slotId);
    if (!slotDef) return null;
    const item = this.currentItems.find(candidate => candidate.id === img.__itemId);
    if (!item) return null;
    const slotAssign = this.currentEntity.slots.find(slot => slot.slotId === img.__slotId);
    if (!slotAssign) return null;
    const part = item.parts?.find(candidate => candidate.id === img.__partId);
    if (!part || part.coordinateMode !== "bone_local") return null;

    const binding = resolveItemPartBinding(
      this.currentEntity,
      this.currentTemplate,
      this.currentScene.skeleton,
      item,
      slotAssign,
      slotDef,
      part,
      this.currentFitProfiles,
    );
    const override = normalizeAttachmentOverride(slotAssign.attachmentOverride);
    const attachmentOverrideMatrix = localTransformToMatrix(
      override.offsetX,
      override.offsetY,
      override.rotation,
      override.scaleX,
      override.scaleY,
    );
    const worldOriginM = this._getFabricImageWorldOriginMatrix(img);
    const partLocalM = multiply(
      inverse(multiply(binding.parentMatrix, multiply(binding.anchorMatrix, multiply(binding.defaultTransformMatrix, attachmentOverrideMatrix)))),
      worldOriginM,
    );
    const pivotWorld = transformPoint(partLocalM, part.pivot.x, part.pivot.y);
    const decomposed = decompose(partLocalM);
    return {
      x: pivotWorld.x,
      y: pivotWorld.y,
      rotation: decomposed.rotation,
      scaleX: decomposed.scaleX,
      scaleY: decomposed.scaleY,
    };
  }

  private _computeOverrideFromFabricImage(img: TaggedFabricImage): AttachmentOverride | null {
    if (!img.__slotId || !img.__itemId || !img.__partId) return null;
    if (!this.currentScene || !this.currentTemplate || !this.currentEntity) return null;

    const slotDef = this.currentTemplate.slots.find(s => s.id === img.__slotId);
    if (!slotDef) return null;

    const item = this.currentItems.find(i => i.id === img.__itemId);
    if (!item) return null;

    const slotAssign = this.currentEntity.slots.find(s => s.slotId === img.__slotId);
    if (!slotAssign) return null;

    const current = normalizeAttachmentOverride(slotAssign.attachmentOverride);
    const part = item.parts?.find(p => p.id === img.__partId);

    if (!part || part.coordinateMode === "legacy_full_frame") {
      const worldOriginM = this._getFabricImageWorldOriginMatrix(img);
      const dt = slotDef.defaultTransform;
      const defaultTransformMatrix = dt
        ? localTransformToMatrix(dt.x, dt.y, dt.rotation, dt.scaleX, dt.scaleY)
        : identity();
      const parentMatrix = slotBoneMatrix(this.currentScene.skeleton, slotDef);
      const overrideM = multiply(
        inverse(multiply(parentMatrix, defaultTransformMatrix)),
        worldOriginM,
      );
      const d = decompose(overrideM);
      return {
        ...current,
        offsetX: d.tx,
        offsetY: d.ty,
        rotation: d.rotation,
        scaleX: d.scaleX,
        scaleY: d.scaleY,
      };
    }

    const binding = resolveItemPartBinding(
      this.currentEntity,
      this.currentTemplate,
      this.currentScene.skeleton,
      item,
      slotAssign,
      slotDef,
      part,
      this.currentFitProfiles,
    );
    const overrideM = this._computeAttachmentOverrideMatrix(slotDef, item, slotAssign, part, img);
    if (!overrideM) return null;
    const d = decompose(overrideM);
    return {
      ...current,
      offsetX: d.tx,
      offsetY: d.ty,
      rotation: d.rotation,
      scaleX: d.scaleX,
      scaleY: d.scaleY,
    };
  }

  private _previewMultiPartAttachment(img: TaggedFabricImage): void {
    if (!img.__slotId || !img.__itemId || !img.__partId) return;
    if (!this.currentScene || !this.currentTemplate || !this.currentEntity) return;

    const slotDef = this.currentTemplate.slots.find(s => s.id === img.__slotId);
    if (!slotDef) return;
    const item = this.currentItems.find(i => i.id === img.__itemId);
    if (!item?.parts || item.parts.length < 2) return;
    const slotAssign = this.currentEntity.slots.find(s => s.slotId === img.__slotId);
    if (!slotAssign) return;
    const selectedPart = item.parts.find(p => p.id === img.__partId);
    if (!selectedPart || selectedPart.coordinateMode !== "bone_local") return;

    const overrideM = this._computeAttachmentOverrideMatrix(slotDef, item, slotAssign, selectedPart, img);
    if (!overrideM) return;

    for (const siblingPart of item.parts) {
      if (siblingPart.id === selectedPart.id) continue;
      if (siblingPart.coordinateMode !== "bone_local") continue;

      const visualId = `slot__${img.__slotId}__${item.id}__${siblingPart.id}`;
      const siblingImg = this.fabricImages.get(visualId);
      const siblingVisual = this.currentScene.visuals.find(v => v.id === visualId);
      if (!siblingImg || !siblingVisual) continue;

      const binding = resolveItemPartBinding(
        this.currentEntity,
        this.currentTemplate,
        this.currentScene.skeleton,
        item,
        slotAssign,
        slotDef,
        siblingPart,
        this.currentFitProfiles,
      );
      const lt = this._getEffectivePartTransform(item, slotDef, siblingPart);
      const piv = siblingPart.pivot;
      const partLocalM = localTransformToMatrix(lt.x, lt.y, lt.rotation, lt.scaleX, lt.scaleY, piv.x, piv.y);
      const worldM = multiply(
        binding.parentMatrix,
        multiply(
          binding.anchorMatrix,
          multiply(
            binding.defaultTransformMatrix,
            multiply(overrideM, partLocalM),
          ),
        ),
      );
      const localCenterX = (siblingVisual.localBounds.minX + siblingVisual.localBounds.maxX) / 2;
      const localCenterY = (siblingVisual.localBounds.minY + siblingVisual.localBounds.maxY) / 2;
        const placement = makeFabricImagePlacement(worldM, localCenterX, localCenterY);
        siblingImg.__centerX = localCenterX;
        siblingImg.__centerY = localCenterY;
        siblingImg.set({
          left: placement.translateX,
          top: placement.translateY,
          angle: placement.angle,
          scaleX: placement.scaleX,
          scaleY: placement.scaleY,
          skewX: placement.skewX ?? 0,
          skewY: placement.skewY ?? 0,
        });
        siblingImg.setCoords();
      }

    this.canvas.requestRenderAll();
  }

  private _getSlotTransformFromZone(zone: TaggedRect): LocalTransform | null {
    if (!zone.__slotId || !this.currentTemplate) return null;
    const slotDef = this.currentTemplate.slots.find(s => s.id === zone.__slotId);
    if (!slotDef) return null;
    const boneWb = this.currentScene?.skeleton.bones.get(slotDef.boneId);
    return getTemplateSlotTransformFromWorldCenter(slotDef, boneWb, {
      x: zone.left ?? 0,
      y: zone.top ?? 0,
    });
  }

  // ── Slot zone drag for Edit Template Slots mode ───────────────────────────

  private _handleSlotZoneModified(zone: TaggedRect): void {
    if (zone.__locked) return;
    const snapshot = this.activeSlotGesture;
    const nextTransform = this._getSlotTransformFromZone(zone);
    if (snapshot && nextTransform && zone.__slotId === snapshot.slotId) {
      zone.__defaultLeft = zone.left ?? 0;
      zone.__defaultTop  = zone.top  ?? 0;
      if (!sameLocalTransform(snapshot.beforeTransform, nextTransform)) {
        this.opts.onSlotTransformCommit?.(snapshot.slotId, snapshot.beforeTransform, nextTransform);
      }
      return;
    }

    if (!zone.__slotId || !this.currentTemplate) return;

    const slotDef = this.currentTemplate.slots.find(s => s.id === zone.__slotId);
    if (!slotDef) return;

    // Compute offset from bone center to new zone position
    const boneWb = this.currentScene?.skeleton.bones.get(slotDef.boneId);
    const newTransform = getTemplateSlotTransformFromWorldCenter(slotDef, boneWb, {
      x: zone.left ?? 0,
      y: zone.top ?? 0,
    });

    // Update stored default so next updateSceneTransforms doesn't reset zone
    zone.__defaultLeft = zone.left ?? 0;
    zone.__defaultTop  = zone.top  ?? 0;

    this.opts.onSlotTransformCommit?.(
      zone.__slotId!,
      normalizeLocalTransform(slotDef.defaultTransform),
      newTransform,
    );
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
    fitProfiles:       ItemFitProfile[] = [],
    highlightedSlotId: string | null,
    pose:              BoneTransformMap | null,
    isAnimTick         = false,
  ): Promise<void> {
    const skeleton = evaluateSkeleton(template.bones, pose ?? new Map(), entity.bodyMorphs);
    const scene    = evaluateScene(entity, template, skeleton, [...items.values()], fitProfiles);

    if (isAnimTick) {
      this.updateSceneTransforms(scene);
    } else {
      await this.reconcileSceneStructure(scene, template, highlightedSlotId, [...items.values()], fitProfiles, entity);
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
    for (const lbl of this.slotLabels.values())     this.canvas.remove(lbl);
    this.fabricImages.clear();
    this.svgCache.clear();
    this.slotZones.clear();
    this.anchorGizmos.clear();
    this.slotLabels.clear();
    this.currentScene    = null;
    this.currentTemplate = null;
    this.currentItems    = [];
    this.currentFitProfiles = [];
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
