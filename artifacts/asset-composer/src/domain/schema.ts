import { z } from "zod";

// ── Primitives ────────────────────────────────────────────────────────────────

const BoneTransformSchema = z.object({
  tx: z.number(),
  ty: z.number(),
  rotation: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
});

const BoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  restPose: BoneTransformSchema,
  length: z.number(),
});

export const PaletteTokensSchema = z.object({
  skin: z.string(),
  hair: z.string(),
  primaryCloth: z.string(),
  secondaryCloth: z.string(),
  metal: z.string(),
  accent: z.string(),
  outline: z.string(),
  shadow: z.string(),
});

// ── v2.0 NEW schemas ──────────────────────────────────────────────────────────

const VectorAssetMetricsSchema = z.object({
  viewBoxX:      z.number(),
  viewBoxY:      z.number(),
  viewBoxWidth:  z.number(),
  viewBoxHeight: z.number(),
  visualMinX:    z.number(),
  visualMinY:    z.number(),
  visualWidth:   z.number(),
  visualHeight:  z.number(),
});

const PivotSchema = z.object({
  x:      z.number(),
  y:      z.number(),
  preset: z.enum(["center", "feet", "custom"]),
});

const LocalTransformSchema = z.object({
  x:        z.number(),
  y:        z.number(),
  rotation: z.number(),
  scaleX:   z.number(),
  scaleY:   z.number(),
});

const EntityVisualSchema = z.object({
  id:             z.string(),
  svgData:        z.string(),
  boneId:         z.string(),
  metrics:        VectorAssetMetricsSchema,
  pivot:          PivotSchema,
  localTransform: LocalTransformSchema,
  zIndex:         z.number(),
});

const CoordinateModeSchema = z.enum(["bone_local", "legacy_full_frame"]);

const ItemPartSchema = z.object({
  id:             z.string(),
  boneId:         z.string(),
  svgData:        z.string(),
  metrics:        VectorAssetMetricsSchema,
  pivot:          PivotSchema,
  localTransform: LocalTransformSchema,
  coordinateMode: CoordinateModeSchema,
  zOffset:        z.number(),
});

const BonePartSchema = z.object({
  id:            z.string(),
  boneId:        z.string(),
  svgData:       z.string(),
  naturalWidth:  z.number(),
  naturalHeight: z.number(),
  localX:        z.number(),
  localY:        z.number(),
  zOffset:       z.number(),
});

// ── Core schemas ──────────────────────────────────────────────────────────────

const SlotAssignmentSchema = z.object({
  slotId: z.string(),
  itemId: z.string().nullable(),
  paletteOverride: PaletteTokensSchema.partial(),
  attachmentOverride: z.object({
    anchorId: z.string(),
    bindMode: z.string(),
    offsetX: z.number(),
    offsetY: z.number(),
    rotation: z.number(),
    scaleX: z.number(),
    scaleY: z.number(),
  }).partial(),
});

const LicenseMetaSchema = z.object({
  source: z.string(),
  author: z.string(),
  licenseType: z.enum(["cc0", "cc_by", "cc_by_sa", "proprietary", "royalty_free"]),
  aiGenerated: z.boolean(),
  commercialUseAllowed: z.boolean(),
  purchaseRef: z.string().nullable(),
  derivativePolicy: z.string(),
});

export const EntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  entityType: z.enum(["character", "monster", "animal", "item", "static_object", "animation_pack"]),
  templateId: z.string(),
  styleSetId: z.string(),
  species: z.string().default(""),
  palette: PaletteTokensSchema,
  slots: z.array(SlotAssignmentSchema),
  visuals: z.array(EntityVisualSchema).optional().default([]),
  rootTransform: LocalTransformSchema.nullable().optional(),
  activeAnimationClipId: z.string().nullable(),
  activeStateMachineId: z.string().nullable(),
  licenseMeta: LicenseMetaSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

const SvgLayerSchema = z.object({
  id: z.string(),
  styleSetId: z.string().nullable(),
  svgData: z.string(),
  paletteChannels: z.array(z.string()),
  zOffset: z.number(),
});

const AnchorPointSchema = z.object({
  id: z.string(),
  boneId: z.string(),
  offsetX: z.number(),
  offsetY: z.number(),
  rotation: z.number(),
});

const SlotDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  boneId: z.string(),
  zIndex: z.number(),
  allowedCategories: z.array(z.string()),
  required: z.boolean(),
  defaultItemId: z.string().nullable(),
  defaultAnchorId: z.string().optional(),
  defaultTransform: LocalTransformSchema.optional(),
});

const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  skeletonFamily: z.string(),
  viewProfile: z.string(),
  entityTypes: z.array(z.string()),
  bones: z.array(BoneSchema),
  slots: z.array(SlotDefSchema),
  anchors: z.record(AnchorPointSchema),
  paletteTokens: PaletteTokensSchema,
  baseBodyLayers: z.array(SvgLayerSchema),
  boneParts: z.array(BonePartSchema).optional().default([]),
  previewWidth: z.number(),
  previewHeight: z.number(),
  thumbnailSvg: z.string(),
});

const CompatibilityRuleSchema = z.object({
  skeletonFamilies: z.array(z.string()),
  species: z.array(z.string()),
  viewProfiles: z.array(z.string()),
});

const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  compatibility: CompatibilityRuleSchema,
  allowedSlots: z.array(z.string()),
  fitProfile: z.string(),
  paletteChannels: z.array(z.string()),
  hasOwnAnimation: z.boolean(),
  animationClipId: z.string().nullable(),
  anchorRules: z.record(z.object({ anchorId: z.string(), bindMode: z.string() })),
  svgLayers: z.array(SvgLayerSchema),
  parts: z.array(ItemPartSchema).optional().default([]),
  coordinateMode: CoordinateModeSchema.optional().default("legacy_full_frame"),
  licenseMeta: LicenseMetaSchema,
  tags: z.array(z.string()),
});

const KeyframeSchema = z.object({
  timeMs: z.number(),
  transform: BoneTransformSchema,
  easing: z.enum(["linear", "ease_in", "ease_out", "ease_in_out"]),
});

const KeyframeTrackSchema = z.object({
  boneId: z.string(),
  keyframes: z.array(KeyframeSchema),
});

const AnimationLayerSchema = z.object({
  mask: z.string(),
  tracks: z.array(KeyframeTrackSchema),
});

const AnimationClipSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  skeletonFamily: z.string(),
  durationMs: z.number(),
  fps: z.number(),
  loops: z.boolean(),
  layers: z.array(AnimationLayerSchema),
});

const AnimationStateSchema = z.object({
  id: z.string(),
  clipId: z.string(),
  speed: z.number(),
  loop: z.boolean(),
});

const TransitionSchema = z.object({
  id: z.string(),
  fromStateId: z.string(),
  toStateId: z.string(),
  condition: z.string(),
  durationMs: z.number(),
  priority: z.number(),
});

const StateMachineSchema = z.object({
  id: z.string(),
  name: z.string(),
  skeletonFamily: z.string(),
  entryStateId: z.string(),
  states: z.array(AnimationStateSchema),
  transitions: z.array(TransitionSchema),
});

const StyleSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  paletteDefaults: PaletteTokensSchema,
  strokeWeight: z.number(),
  shadingMode: z.string(),
  eyeStyle: z.string(),
  silhouetteBias: z.enum(["sharp", "rounded"]),
  materialPresets: z.record(z.string()),
});

const ExportProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  frameSizeKey: z.string(),
  formats: z.array(z.string()),
  pivotPolicy: z.string(),
  outlinePadding: z.number(),
  bgColor: z.string().nullable(),
  antiAlias: z.boolean(),
  namingTemplate: z.string(),
  atlasMode: z.string(),
});

// ── Project schema v2.0 ───────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  description: z.string(),
  entities: z.array(EntitySchema),
  templates: z.array(TemplateSchema),
  items: z.array(ItemSchema),
  animationClips: z.array(AnimationClipSchema),
  stateMachines: z.array(StateMachineSchema),
  styleSets: z.array(StyleSetSchema),
  exportProfiles: z.array(ExportProfileSchema),
  activeEntityId: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProjectSchemaType = z.infer<typeof ProjectSchema>;
