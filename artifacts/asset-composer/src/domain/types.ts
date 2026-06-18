export type EntityType =
  | "character"
  | "monster"
  | "animal"
  | "item"
  | "static_object"
  | "animation_pack";

export type SkeletonFamilyId =
  | "humanoid_topdown_v1"
  | "humanoid_side_v1"
  | "quadruped_side_v1"
  | "bird_side_v1"
  | "humanoid_monster_v1"
  | "siege_static_v1";

export type ViewProfile =
  | "topdown_45"
  | "isometric_34"
  | "side_view"
  | "front_view"
  | "static";

export type LayerMask = "full_body" | "upper_body" | "lower_body" | "additive";

export type ShadingMode = "flat" | "cel" | "textured";

export type EyeStyle = "simple" | "round_kawaii" | "angular_intense" | "hollow";

export type LicenseType =
  | "cc0"
  | "cc_by"
  | "cc_by_sa"
  | "proprietary"
  | "royalty_free";

export type ItemCategory =
  | "head_cover"
  | "hair"
  | "face"
  | "neck"
  | "torso"
  | "arms"
  | "hands"
  | "waist"
  | "legs"
  | "feet"
  | "cloak"
  | "weapon_main"
  | "weapon_off"
  | "shield"
  | "ring"
  | "amulet"
  | "eyes"
  | "beard"
  | "creature_horn"
  | "creature_wing"
  | "creature_tail"
  | "creature_saddle"
  | "creature_pack"
  | "creature_shell"
  | "static_part";

export type CoordinateMode = "bone_local" | "legacy_full_frame";

// ── Matrix / bounds ───────────────────────────────────────────────────────────

/**
 * 2-D affine matrix: [a, b, c, d, tx, ty]  (CSS / Fabric.js convention)
 * x' = a·x + c·y + tx,  y' = b·x + d·y + ty
 */
export type Matrix2D = [number, number, number, number, number, number];

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ── Visual metrics & pivot ────────────────────────────────────────────────────

/**
 * Dimensions derived from an imported SVG.
 * viewBox* = raw SVG viewBox values.
 * visual* = actual content bounds within the viewBox (padding stripped where possible).
 * All values in SVG local / viewBox coordinate units.
 */
export interface VectorAssetMetrics {
  viewBoxX:      number;
  viewBoxY:      number;
  viewBoxWidth:  number;
  viewBoxHeight: number;
  visualMinX:    number;
  visualMinY:    number;
  visualWidth:   number;
  visualHeight:  number;
}

/**
 * Pivot point in local content coordinate units (NOT 0-1 fractions).
 * For a visual imported at viewBox 0 0 64 64 with preset "center":
 *   pivot = { x: 32, y: 32, preset: "center" }
 */
export interface Pivot {
  x:      number;
  y:      number;
  preset: "center" | "feet" | "custom";
}

// ── Local transform ───────────────────────────────────────────────────────────

/**
 * Position/rotation/scale of a visual in its parent bone's coordinate space.
 * Units: template units.  Rotation: degrees.
 */
export interface LocalTransform {
  x:       number;
  y:       number;
  rotation: number;
  scaleX:  number;
  scaleY:  number;
}

// ── Entity-level visual (full-vector or assembled SVG body) ───────────────────

/**
 * A visual attached to a specific bone.
 * Full-vector imports use boneId = "root".
 * After "Convert to Rigged", each part has its own boneId.
 *
 * Never placed in entity.slots — entity.visuals is its home.
 */
export interface EntityVisual {
  id:             string;
  svgData:        string;
  /** Bone this visual follows.  "root" for monolithic full-vector imports. */
  boneId:         string;
  metrics:        VectorAssetMetrics;
  pivot:          Pivot;
  localTransform: LocalTransform;
  zIndex:         number;
}

// ── Item part (single rigid piece of multi-bone equipment) ────────────────────

/**
 * One rigid piece of an equipment item that attaches to a specific bone.
 *
 * Examples:
 *   boots   → { boot_l → foot_l, boot_r → foot_r }
 *   pants   → { waist → pelvis, thigh_l → hip_l, ... }
 *   armor   → { chest → chest, shoulder_l → shoulder_l, ... }
 *
 * legacy_full_frame: the part uses a viewBox-sized full-frame overlay (v1.x compat).
 */
export interface ItemPart {
  id:             string;
  boneId:         string;
  svgData:        string;
  metrics:        VectorAssetMetrics;
  pivot:          Pivot;
  localTransform: LocalTransform;
  coordinateMode: CoordinateMode;
  zOffset:        number;
}

// ── Evaluated visual (output of evaluationPipeline) ──────────────────────────

/**
 * A fully-resolved visual layer ready for rendering by any renderer.
 *
 * worldMatrix encodes the complete transform chain:
 *   entityRootTransform × boneWorldMatrix × anchorMatrix × attachmentOverrideMatrix
 *   × T(pivotX, pivotY) × localTransform × T(-pivotX, -pivotY)
 *
 * Renderers perform only the final scene→viewport projection:
 *   screenMatrix = viewportMatrix × worldMatrix
 * They must NOT re-compute bone transforms or apply their own skelScale.
 */
export type VisualSourceKind = "item-part" | "bone-part" | "entity-visual" | "base-layer";

export interface EvaluatedVisual {
  id:           string;
  svgData:      string;
  zIndex:       number;
  /** SVG fitting policy used by rasterizers. */
  svgFitMode?:  "legacy_full_frame" | "v2_vector";
  /** Full world matrix in template/scene units. */
  worldMatrix:  Matrix2D;
  /** Content bounds in local (pre-transform) space, template units. */
  localBounds:  AABB;
  /** World-space AABB (4-corner transform of localBounds through worldMatrix). */
  worldBounds:  AABB;
  /** M1-E3B selection model — how this visual was produced. */
  sourceKind?:     VisualSourceKind;
  slotId?:         string;
  itemId?:         string;
  partId?:         string;
  entityVisualId?: string;
  boneId?:         string;
}

// ── Canvas editor types (M1-E3B) ──────────────────────────────────────────────

export type CanvasMode =
  | "select"
  | "edit-attachment"
  | "edit-template-slots";

export type EditorSelection =
  | { kind: "none" }
  | { kind: "template-slot";  templateId: string; slotId: string }
  | { kind: "anchor";         templateId: string; boneId: string; anchorId: string }
  | { kind: "equipped-item";  entityId: string; slotId: string; itemId: string }
  | { kind: "item-part";      entityId: string; slotId: string; itemId: string; partId: string }
  | { kind: "bone";           entityId: string; boneId: string }
  | { kind: "entity-visual";  entityId: string; visualId: string };

export interface ItemFitProfile {
  id: string;
  fitProfile: string;
  templateId:     string;
  family?:        string;
  slotId:         string;
  partTransforms: Record<string, LocalTransform>;
  anchorOverrides?: Record<string, string>;
}

// ── Existing domain types (unchanged below) ───────────────────────────────────

export interface PaletteTokens {
  skin: string;
  hair: string;
  primaryCloth: string;
  secondaryCloth: string;
  metal: string;
  accent: string;
  outline: string;
  shadow: string;
}

export interface BoneTransform {
  tx: number;
  ty: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Bone {
  id: string;
  name: string;
  parentId: string | null;
  restPose: BoneTransform;
  length: number;
}

export interface SlotDef {
  id: string;
  name: string;
  boneId: string;
  zIndex: number;
  allowedCategories: ItemCategory[];
  required: boolean;
  defaultItemId: string | null;
  /** Optional built-in anchor used when the slot has no per-item/per-entity override. */
  defaultAnchorId?: string;
  /** Default attachment position relative to the bone. Editable in Edit Template Slots mode. */
  defaultTransform?: LocalTransform;
}

export interface AnchorPoint {
  id: string;
  boneId: string;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

export interface SvgLayer {
  id: string;
  styleSetId: string | null;
  svgData: string;
  paletteChannels: (keyof PaletteTokens)[];
  zOffset: number;
}

/**
 * Per-bone SVG body part (Stage 3 skeletal rendering).
 * When a Template has boneParts, evaluateScene emits bone-local visuals
 * instead of the full-frame baseBodyLayers.
 */
export interface BonePart {
  id:            string;
  boneId:        string;
  svgData:       string;
  naturalWidth:  number;
  naturalHeight: number;
  localX:        number;
  localY:        number;
  /** Used as EvaluatedVisual.zIndex — keep negative to stay below slot items */
  zOffset:       number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  skeletonFamily: SkeletonFamilyId;
  viewProfile: ViewProfile;
  entityTypes: EntityType[];
  bones: Bone[];
  slots: SlotDef[];
  anchors: Record<string, AnchorPoint>;
  paletteTokens: PaletteTokens;
  baseBodyLayers: SvgLayer[];
  /**
   * Optional per-bone SVG body parts (Stage 3).
   * When present and non-empty, evaluateScene emits bone-local visuals.
   */
  boneParts?: BonePart[];
  previewWidth: number;
  previewHeight: number;
  thumbnailSvg: string;
}

export interface AttachmentShape {
  id: string;
  svgPath: string;
  paletteChannels: (keyof PaletteTokens)[];
  zOffset: number;
}

export interface Attachment {
  id: string;
  name: string;
  boneId: string;
  shapes: AttachmentShape[];
}

export interface Animation {
  id: string;
  name: string;
  durationMs: number;
  fps: number;
  loops: boolean;
  keyframeTracks: KeyframeTrack[];
}

export interface LicenseMeta {
  source: string;
  author: string;
  licenseType: LicenseType;
  aiGenerated: boolean;
  commercialUseAllowed: boolean;
  purchaseRef: string | null;
  derivativePolicy: string;
}

export interface CompatibilityRule {
  skeletonFamilies: SkeletonFamilyId[];
  species: string[];
  viewProfiles: ViewProfile[];
}

export interface Item {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  compatibility: CompatibilityRule;
  allowedSlots: string[];
  fitProfile: string;
  paletteChannels: (keyof PaletteTokens)[];
  hasOwnAnimation: boolean;
  animationClipId: string | null;
  anchorRules: Record<string, { anchorId: string; bindMode: string }>;
  svgLayers: SvgLayer[];
  /** Multi-bone parts (v2.0+). Empty array = legacy svgLayers-only item. */
  parts?: ItemPart[];
  /** How this item's visuals are positioned. */
  coordinateMode?: CoordinateMode;
  licenseMeta: LicenseMeta;
  tags: string[];
}

export interface Keyframe {
  timeMs: number;
  transform: BoneTransform;
  easing: "linear" | "ease_in" | "ease_out" | "ease_in_out";
}

export interface KeyframeTrack {
  boneId: string;
  keyframes: Keyframe[];
}

export interface AnimationLayer {
  mask: LayerMask;
  tracks: KeyframeTrack[];
}

export interface AnimationClip {
  id: string;
  name: string;
  label: string;
  skeletonFamily: SkeletonFamilyId;
  durationMs: number;
  fps: number;
  loops: boolean;
  layers: AnimationLayer[];
}

export interface AnimationState {
  id: string;
  clipId: string;
  speed: number;
  loop: boolean;
}

export interface Transition {
  id: string;
  fromStateId: string;
  toStateId: string;
  condition: string;
  durationMs: number;
  priority: number;
}

export interface StateMachine {
  id: string;
  name: string;
  skeletonFamily: SkeletonFamilyId;
  entryStateId: string;
  states: AnimationState[];
  transitions: Transition[];
}

export interface AttachmentOverride {
  anchorId: string;
  bindMode: string;
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface SlotAssignment {
  slotId: string;
  itemId: string | null;
  paletteOverride: Partial<PaletteTokens>;
  attachmentOverride: Partial<AttachmentOverride>;
}

export interface StyleSet {
  id: string;
  name: string;
  label: string;
  paletteDefaults: PaletteTokens;
  strokeWeight: number;
  shadingMode: ShadingMode;
  eyeStyle: EyeStyle;
  silhouetteBias: "sharp" | "rounded";
  materialPresets: Record<string, string>;
}

export interface ExportProfile {
  id: string;
  name: string;
  frameSizeKey: "32" | "48" | "64" | "96" | "128" | "256" | "512";
  formats: ("png_sheet" | "webp_sheet" | "svg_parts" | "frame_sequence" | "entity_json" | "jpeg_preview")[];
  pivotPolicy: "center" | "feet" | "per_animation";
  outlinePadding: number;
  bgColor: string | null;
  antiAlias: boolean;
  namingTemplate: string;
  atlasMode: "per_entity" | "combined";
}

export interface Entity {
  id: string;
  name: string;
  entityType: EntityType;
  templateId: string;
  styleSetId: string;
  species: string;
  palette: PaletteTokens;
  slots: SlotAssignment[];
  /** Full-vector or assembled SVG body parts (v2.0+). */
  visuals?: EntityVisual[];
  /** Entity-level root transform for moving/scaling the whole entity (v2.0+). */
  rootTransform?: LocalTransform | null;
  activeAnimationClipId: string | null;
  activeStateMachineId: string | null;
  licenseMeta: LicenseMeta;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  version: string;
  name: string;
  description: string;
  entities: Entity[];
  templates: Template[];
  items: Item[];
  animationClips: AnimationClip[];
  stateMachines: StateMachine[];
  styleSets: StyleSet[];
  exportProfiles: ExportProfile[];
  activeEntityId: string | null;
  createdAt: number;
  updatedAt: number;
}
