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
  source: z.object({
    format: z.enum(["svg", "png"]),
    name: z.string(),
    originalFileName: z.string(),
    mimeType: z.string(),
    dataUri: z.string().optional(),
  }).optional(),
  editorDocumentId: z.string().nullable().optional(),
});

const CoordinateModeSchema = z.enum(["bone_local", "legacy_full_frame"]);
const FacingPolicySchema = z.enum(["profile_mirror", "directional_4", "directional_5", "directional_8"]);
const ViewKeySchema = z.enum([
  "south",
  "south_east",
  "east",
  "north_east",
  "north",
  "north_west",
  "west",
  "south_west",
]);

const TemplateViewSchema = z.object({
  key: ViewKeySchema,
  viewProfile: z.string(),
  mirrorOf: ViewKeySchema.optional(),
  thumbnailSvg: z.string().optional(),
});

const TemplateViewsSchema = z.object({
  south: TemplateViewSchema.optional(),
  south_east: TemplateViewSchema.optional(),
  east: TemplateViewSchema.optional(),
  north_east: TemplateViewSchema.optional(),
  north: TemplateViewSchema.optional(),
  north_west: TemplateViewSchema.optional(),
  west: TemplateViewSchema.optional(),
  south_west: TemplateViewSchema.optional(),
});

const ItemPartSchema = z.object({
  id:             z.string(),
  boneId:         z.string(),
  svgData:        z.string(),
  metrics:        VectorAssetMetricsSchema,
  pivot:          PivotSchema,
  localTransform: LocalTransformSchema,
  coordinateMode: CoordinateModeSchema,
  zOffset:        z.number(),
  source: z.object({
    format: z.enum(["svg", "png"]),
    name: z.string(),
    originalFileName: z.string(),
    mimeType: z.string(),
    dataUri: z.string().optional(),
  }).optional(),
  editorDocumentId: z.string().nullable().optional(),
});

const BodyMorphValuesSchema = z.object({
  headSize: z.number().default(1),
  neckLength: z.number().default(1),
  torsoHeight: z.number().default(1),
  torsoWidth: z.number().default(1),
  armLength: z.number().default(1),
  forearmLength: z.number().default(1),
  handSize: z.number().default(1),
  legLength: z.number().default(1),
  shinLength: z.number().default(1),
  footSize: z.number().default(1),
  pelvisWidth: z.number().default(1),
  overallHeightScale: z.number().default(1),
});

const BodyMorphRegionSchema = z.enum(["head", "torso", "arms", "legs", "global"]);
const BodyAuthoringIntentSchema = z.enum(["morph", "inspect", "preview"]);
const BodyAuthoringViewportModeSchema = z.enum(["full_body", "focus_region"]);
const FaceOverlayRoleSchema = z.enum(["base", "line", "detail", "shadow", "highlight"]);
const SpriteEditorSymmetryModeSchema = z.enum(["none", "mirror_x"]);
const FaceAuthoringToolSchema = z.enum(["select", "pencil", "closed-pencil", "fill", "eraser"]);
const FaceCanvasFocusModeSchema = z.enum(["document", "head"]);
const SpriteEditorPaintTargetSchema = z.enum(["fill", "stroke", "both"]);
const FaceAuthoringWorkflowModeSchema = z.enum(["feature", "overlay"]);

const BodyAuthoringStateSchema = z.object({
  focusRegion: BodyMorphRegionSchema.default("global"),
  activeBoneId: z.string().nullable().optional(),
  activeSlotId: z.string().nullable().optional(),
  intent: BodyAuthoringIntentSchema.optional().default("morph"),
  viewportMode: BodyAuthoringViewportModeSchema.optional().default("focus_region"),
  activePoseBoneId: z.string().nullable().optional(),
  regionPresetIds: z.object({
    head: z.string().nullable().optional(),
    torso: z.string().nullable().optional(),
    arms: z.string().nullable().optional(),
    legs: z.string().nullable().optional(),
    global: z.string().nullable().optional(),
  }).optional(),
});

const FaceFeatureTransformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  rotation: z.number().default(0),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
});

const FaceFeatureConfigSchema = z.object({
  presetId: z.string().default("none"),
  color: z.string().default("#000000"),
  visible: z.boolean().default(false),
  transform: FaceFeatureTransformSchema.default({
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
  }),
});

const FaceOverlaySchema = z.object({
  id: z.string(),
  name: z.string(),
  featureTag: z.enum(["generic", "eyes", "mouth", "brows", "beard", "hair"]).optional(),
  overlayRole: FaceOverlayRoleSchema.optional(),
  symmetryMode: SpriteEditorSymmetryModeSchema.optional().default("none"),
  paintTarget: SpriteEditorPaintTargetSchema.optional().default("both"),
  svgData: z.string(),
  zOffset: z.number(),
  pivot: PivotSchema,
  metrics: VectorAssetMetricsSchema,
  localTransform: LocalTransformSchema,
  source: z.object({
    format: z.enum(["svg", "png"]),
    name: z.string(),
    originalFileName: z.string(),
    mimeType: z.string(),
    dataUri: z.string().optional(),
  }).optional(),
  editorDocumentId: z.string().nullable().optional(),
});

const FaceCustomizationSchema = z.object({
  eyes: FaceFeatureConfigSchema.default({
    presetId: "round_kawaii",
    color: "#2B1D18",
    visible: true,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  }),
  mouth: FaceFeatureConfigSchema.default({
    presetId: "soft_smile",
    color: "#1A1A1A",
    visible: true,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  }),
  brows: FaceFeatureConfigSchema.default({
    presetId: "soft_arc",
    color: "#3B2314",
    visible: false,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  }),
  beard: FaceFeatureConfigSchema.default({
    presetId: "none",
    color: "#3B2314",
    visible: false,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  }),
  hair: FaceFeatureConfigSchema.default({
    presetId: "none",
    color: "#3B2314",
    visible: false,
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  }),
  overlays: z.array(FaceOverlaySchema).default([]),
});

const FaceAuthoringStateSchema = z.object({
  activeFeatureKey: z.enum(["eyes", "mouth", "brows", "beard", "hair", "generic"]).nullable().default(null),
  overlayFilter: z.enum(["all", "eyes", "mouth", "brows", "beard", "hair", "generic"]).default("all"),
  selectedOverlayId: z.string().nullable().optional(),
  activeBoneId: z.string().nullable().optional(),
  activeSlotId: z.string().nullable().optional(),
  workflowMode: FaceAuthoringWorkflowModeSchema.optional().default("feature"),
  draftOverlayRole: FaceOverlayRoleSchema.optional().default("detail"),
  draftPaintTarget: SpriteEditorPaintTargetSchema.optional().default("both"),
  draftSymmetryMode: SpriteEditorSymmetryModeSchema.optional().default("none"),
  overlayRoleFilter: FaceOverlayRoleSchema.or(z.literal("all")).optional().default("all"),
  paintTargetFilter: SpriteEditorPaintTargetSchema.or(z.literal("all")).optional().default("all"),
  overlayGrouping: z.enum(["feature", "feature_role", "feature_role_paint"]).optional().default("feature"),
  drawMode: FaceAuthoringToolSchema.nullable().optional().default(null),
  focusMode: FaceCanvasFocusModeSchema.optional().default("document"),
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
  bodyMorphs: BodyMorphValuesSchema.optional().default({
    headSize: 1,
    neckLength: 1,
    torsoHeight: 1,
    torsoWidth: 1,
    armLength: 1,
    forearmLength: 1,
    handSize: 1,
    legLength: 1,
    shinLength: 1,
    footSize: 1,
    pelvisWidth: 1,
    overallHeightScale: 1,
  }),
  bodyMorphPresetId: z.string().nullable().optional(),
  bodyAuthoring: BodyAuthoringStateSchema.optional().default({
    focusRegion: "global",
    activePoseBoneId: null,
    regionPresetIds: {},
  }),
  poseOverrides: z.record(BoneTransformSchema).optional().default({}),
  faceCustomization: FaceCustomizationSchema.optional().default({
    eyes: { presetId: "round_kawaii", color: "#2B1D18", visible: true, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
    mouth: { presetId: "soft_smile", color: "#1A1A1A", visible: true, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
    brows: { presetId: "soft_arc", color: "#3B2314", visible: false, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
    beard: { presetId: "none", color: "#3B2314", visible: false, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
    hair: { presetId: "none", color: "#3B2314", visible: false, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
    overlays: [],
  }),
  faceAuthoring: FaceAuthoringStateSchema.optional().default({
    activeFeatureKey: null,
    overlayFilter: "all",
    selectedOverlayId: null,
  }),
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
  rigFamilyId: z.string().optional(),
  defaultFacing: ViewKeySchema.optional(),
  views: TemplateViewsSchema.optional(),
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

const SlotEditorStateSchema = z.object({
  hiddenSlotIds: z.array(z.string()).default([]),
  lockedSlotIds: z.array(z.string()).default([]),
});

const ProjectEditorMetaSchema = z.object({
  slotEditorByTemplateId: z.record(SlotEditorStateSchema).default({}),
  spriteEditorDocuments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    width: z.number(),
    height: z.number(),
    pivot: PivotSchema,
    referenceAsset: z.object({
      format: z.enum(["svg", "png"]),
      name: z.string(),
      originalFileName: z.string(),
      mimeType: z.string(),
      dataUri: z.string().optional(),
    }).nullable().optional(),
    layers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      visible: z.boolean(),
      zIndex: z.number(),
      shapes: z.array(z.object({
        id: z.string(),
        type: z.enum(["rect", "ellipse", "path"]),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        rotation: z.number(),
        fill: z.string(),
        stroke: z.string(),
        strokeWidth: z.number(),
        pathData: z.string().optional(),
      })),
    })).default([]),
        authoringHint: z.object({
          faceFeatureKey: z.enum(["eyes", "mouth", "brows", "beard", "hair", "generic"]).optional(),
          faceOverlayRole: FaceOverlayRoleSchema.optional(),
          symmetryMode: SpriteEditorSymmetryModeSchema.optional(),
          paintTarget: SpriteEditorPaintTargetSchema.optional(),
          paintToolPreset: z.enum(["vector_brush", "shape_stamp"]).optional(),
          bodyMorphPresetId: z.string().nullable().optional(),
        }).optional(),
    target: z.object({
      kind: z.enum(["item-part", "face-overlay", "entity-visual"]),
      entityId: z.string().optional(),
      itemId: z.string().optional(),
      partId: z.string().optional(),
      overlayId: z.string().optional(),
      visualId: z.string().optional(),
    }),
    updatedAt: z.number(),
  })).default([]),
  activeSpriteDocumentId: z.string().nullable().optional(),
  activeAuthoringMode: z.enum(["asset-import", "sprite-editor", "body-morph", "face-editor"]).nullable().optional(),
  activeFaceCanvasOverlayId: z.string().nullable().optional(),
  activeFaceCanvasTool: FaceAuthoringToolSchema.nullable().optional(),
  activeFaceCanvasFocusMode: FaceCanvasFocusModeSchema.nullable().optional(),
});

const ItemFitProfileSchema = z.object({
  id: z.string(),
  fitProfile: z.string(),
  templateId: z.string(),
  family: z.string().optional(),
  slotId: z.string(),
  partTransforms: z.record(LocalTransformSchema),
  anchorOverrides: z.record(z.string()).optional(),
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
  itemFitProfiles: z.array(ItemFitProfileSchema).default([]),
  animationClips: z.array(AnimationClipSchema),
  stateMachines: z.array(StateMachineSchema),
  styleSets: z.array(StyleSetSchema),
  exportProfiles: z.array(ExportProfileSchema),
  editorMeta: ProjectEditorMetaSchema.default({ slotEditorByTemplateId: {}, spriteEditorDocuments: [], activeSpriteDocumentId: null, activeAuthoringMode: null, activeFaceCanvasOverlayId: null, activeFaceCanvasTool: null, activeFaceCanvasFocusMode: null }),
  activeEntityId: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProjectSchemaType = z.infer<typeof ProjectSchema>;
