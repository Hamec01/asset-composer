import { z } from "zod";

// ── Primitives ────────────────────────────────────────────────────────────────

const VisualContentSchema: z.ZodType<import("./types").VisualContent> = z.lazy(() => z.union([
  z.object({kind:z.literal("vector"),svgData:z.string()}),
  z.object({kind:z.literal("raster"),assetId:z.string()}),
  z.object({kind:z.literal("document"),documentId:z.string(),nodeId:z.string().optional()}),
  z.object({kind:z.literal("composite"),width:z.number().positive(),height:z.number().positive(),children:z.array(z.object({content:VisualContentSchema,matrix:z.tuple([z.number(),z.number(),z.number(),z.number(),z.number(),z.number()]),opacity:z.number().min(0).max(1)}))})
]));
const VisualMeshSchema = z.object({
  vertices:z.array(z.object({x:z.number().finite(),y:z.number().finite(),u:z.number().finite(),v:z.number().finite(),weights:z.array(z.object({boneId:z.string(),weight:z.number().finite().nonnegative()})).min(1)})).min(3),
  triangles:z.array(z.number().int().nonnegative()),bindMatrices:z.record(z.string(),z.tuple([z.number(),z.number(),z.number(),z.number(),z.number(),z.number()])),
  manualMesh:z.boolean().optional(),manualWeights:z.boolean().optional(),quality:z.enum(["low","medium","high"])
}).superRefine((m,c)=>{if(m.triangles.length%3 || m.triangles.some(i=>i>=m.vertices.length) || m.vertices.some(v=>v.weights.reduce((a,w)=>a+w.weight,0)<1e-8 || v.weights.some(w=>!m.bindMatrices[w.boneId])))c.addIssue({code:z.ZodIssueCode.custom,message:"Invalid visual mesh"});});
const RigBindingSchema = z.discriminatedUnion("mode",[
  z.object({setupMatrix:z.tuple([z.number(),z.number(),z.number(),z.number(),z.number(),z.number()]).optional(),mode:z.literal("rigid"),boneId:z.string(),bindMatrix:z.tuple([z.number(),z.number(),z.number(),z.number(),z.number(),z.number()])}),
  z.object({setupMatrix:z.tuple([z.number(),z.number(),z.number(),z.number(),z.number(),z.number()]).optional(),mode:z.literal("weighted"),boneId:z.string(),bindMatrix:z.tuple([z.number(),z.number(),z.number(),z.number(),z.number(),z.number()]),mesh:VisualMeshSchema})
]);
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
  bodyPartId:     z.string().optional(),
  bodyView: z.enum(["front", "side"]).optional(),
  svgData:        z.string().optional(),
  content: VisualContentSchema.optional(),
  boneId:         z.string(),
  metrics:        VectorAssetMetricsSchema,
  pivot:          PivotSchema,
  localTransform: LocalTransformSchema,
  zIndex:         z.number(),
  source: z.object({
    format: z.enum(["svg", "png", "webp", "jpeg"]),
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

const SkinMeshSchema = z.object({
  vertices: z.array(z.object({x:z.number().finite(),y:z.number().finite(),weights:z.array(z.object({boneId:z.string(),weight:z.number().finite().nonnegative()})).min(1)})).min(3),
  bindMatrices:z.record(z.string(),z.tuple([z.number().finite(),z.number().finite(),z.number().finite(),z.number().finite(),z.number().finite(),z.number().finite()])),
  triangles:z.array(z.number().int().nonnegative()),
  paths:z.array(z.object({indices:z.array(z.number().int().nonnegative()).min(2),closed:z.boolean(),smooth:z.boolean(),fill:z.string(),stroke:z.string(),strokeWidth:z.number().finite().nonnegative()})).min(1),
}).superRefine((mesh,ctx)=>{
  const invalid = mesh.triangles.length%3!==0 || [...mesh.triangles,...mesh.paths.flatMap(p=>p.indices)].some(i=>i>=mesh.vertices.length)
    || mesh.vertices.some(v=>v.weights.reduce((s,w)=>s+w.weight,0)<=0 || v.weights.some(w=>!mesh.bindMatrices[w.boneId]))
    || Object.values(mesh.bindMatrices).some(m=>Math.abs(m[0]*m[3]-m[1]*m[2])<1e-9);
  if(invalid)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Invalid mesh topology, weights or bind matrices"});
});

const DepthSlotSchema = z.enum(["FAR_BACK","FAR_LIMB","BODY_BACK","BODY","CROSS_BODY","BODY_FRONT","NEAR_LIMB","HAND_FRONT","EQUIPMENT_FRONT"]);

const ItemPartSchema = z.object({
  occludedByBones: z.array(z.string().min(1)).optional(),
  depthBinding: z.object({boneId:z.string(),nearSlot:DepthSlotSchema,farSlot:DepthSlotSchema}).optional(),
  mesh: SkinMeshSchema.optional(),
  dynamicLine:z.object({kind:z.enum(["string","arrow"]).optional(),pathId:z.string(),targetBoneId:z.string(),clipId:z.string(),start:z.object({x:z.number().finite(),y:z.number().finite()}),end:z.object({x:z.number().finite(),y:z.number().finite()}),attachMs:z.number().finite().nonnegative(),releaseMs:z.number().finite().nonnegative(),settleMs:z.number().finite().positive()}).optional(),
  id:             z.string(),
  boneId:         z.string(),
  svgData:        z.string().optional(),
  content: VisualContentSchema.optional(),
  metrics:        VectorAssetMetricsSchema,
  pivot:          PivotSchema,
  localTransform: LocalTransformSchema,
  coordinateMode: CoordinateModeSchema,
  zOffset:        z.number(),
  source: z.object({
    format: z.enum(["svg", "png", "webp", "jpeg"]),
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
  content: VisualContentSchema.optional(),
  artworkBounds: z.object({minX:z.number().finite(),minY:z.number().finite(),maxX:z.number().finite(),maxY:z.number().finite()}).optional(),
  eyeOpenness: z.number().min(0).max(1).optional(),
  mouthOpenness: z.number().min(0).max(1).optional(),
  mouthMotion: z.object({enabled:z.boolean(),periodMs:z.number().min(200).max(3000)}).optional(),
  blink: z.object({enabled:z.boolean(),intervalMs:z.number().min(600).max(10000),durationMs:z.number().min(80).max(500)}).optional(),
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
  svgData: z.string().optional(),
  content: VisualContentSchema.optional(),
  zOffset: z.number(),
  pivot: PivotSchema,
  metrics: VectorAssetMetricsSchema,
  localTransform: LocalTransformSchema,
  source: z.object({
    format: z.enum(["svg", "png", "webp", "jpeg"]),
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
  svgData:       z.string().optional(),
  content: VisualContentSchema.optional(),
  naturalWidth:  z.number(),
  naturalHeight: z.number(),
  localX:        z.number(),
  localY:        z.number(),
  zOffset:       z.number(),
  attachments:   z.record(z.string(), z.union([z.string(), VisualContentSchema])).optional(),
  attachmentGrips: z.record(z.string(), z.object({x:z.number().finite(),y:z.number().finite(),rotation:z.number().finite().optional()})).optional(),
  grip:          z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
  gripSocket: z.object({x:z.number().finite(),y:z.number().finite(),rotation:z.number().finite().optional()}).optional(),
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
  appearance: z.object({
    tokenAge: z.enum(["child", "teen", "adult", "elder"]).optional(),
    tokenFace: z.object({ emotion: z.enum(["auto", "neutral", "happy", "angry", "sad", "surprised"]), blink: z.boolean(), mouthMotion: z.boolean() }).optional(),
    view: z.enum(["front", "right", "left"]).optional(),
    projection: z.enum(["profile", "authored"]).optional(),
    sex: z.enum(["male", "female"]),
    slimness: z.number().min(0).max(1),
    muscle: z.number().min(0).max(1),
    fat: z.number().min(0).max(1),
    nose: z.enum(["none", "button", "small", "straight", "pointed", "rounded", "broad", "upturned", "aquiline", "soft_round", "delicate_bridge", "roman", "flat_wide", "heart_tip", "long_bridge", "painted_nose"]),
    noseArtwork: z.object({content:VisualContentSchema,bounds:z.object({minX:z.number().finite(),minY:z.number().finite(),maxX:z.number().finite(),maxY:z.number().finite()})}).optional(),
    freckles: z.boolean(),
    freckleStyle: z.enum(["light", "nose", "dense", "full"]).optional(),
    freckleIntensity: z.number().min(0).max(1).optional(),
    mole: z.boolean(),
    scar: z.enum(["none", "cheek", "brow", "eye", "cross", "lip", "temple", "claw", "long"]),
  }).optional(),
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
  svgData: z.string().optional(),
  content: VisualContentSchema.optional(),
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
  rotationMode: z.enum(["shortest", "unwrapped"]).optional(),
  keyframes: z.array(KeyframeSchema),
});

const AnimationLayerSchema = z.object({
  mask: z.string(),
  tracks: z.array(KeyframeTrackSchema),
});

const AnimationClipSchema = z.object({
  equipmentDepth: z.array(z.object({
    slotId: z.string().min(1), partId: z.string().min(1).optional(),
    keyframes: z.array(z.object({timeMs: z.number().finite().nonnegative(), facing: z.enum(["left", "right"]).optional(), slot: DepthSlotSchema.nullable(), occludedByBones: z.array(z.string().min(1)).optional()})),
  })).optional(),
  templateId:z.string().optional(),
  reviewMarkers: z.array(z.object({ label: z.string().trim().min(1), timeMs: z.number().finite().nonnegative() })).optional(),
  headOverlap:z.array(z.object({startMs:z.number().finite().nonnegative(),endMs:z.number().finite().nonnegative(),bones:z.array(z.string()).min(1),reason:z.string().trim().min(1)}).refine(p=>p.endMs>p.startMs,"Head-overlap phase must have a positive duration")).optional(),
  limbDepth:z.array(z.object({timeMs:z.number().finite().nonnegative(),facing:z.enum(["left","right"]).optional(),state:z.object({
    nearUpperArm:DepthSlotSchema.optional(),nearForearm:DepthSlotSchema.optional(),nearHand:DepthSlotSchema.optional(),
    farUpperArm:DepthSlotSchema.optional(),farForearm:DepthSlotSchema.optional(),farHand:DepthSlotSchema.optional(),
  })})).optional(),
  drawOrder:z.array(z.object({timeMs:z.number().finite().nonnegative(),boneOrder:z.array(z.string()),slotOrder:z.array(z.string()),raise:z.array(z.object({boneId:z.string(),above:z.string(),onlyNear:z.boolean().optional()})).optional()})).optional(),
  deform:z.array(z.object({partId:z.string(),keyframes:z.array(z.object({timeMs:z.number().finite().nonnegative(),offsets:z.array(z.object({x:z.number().finite(),y:z.number().finite()}))}))})).optional(),
  attachments:z.array(z.object({boneId:z.string(),keyframes:z.array(z.object({timeMs:z.number().finite().nonnegative(),name:z.string().nullable()}))})).optional(),
  inherit:z.record(z.string(),z.enum(["normal","noScale"])).optional(),
  ik:z.array(z.object({bones:z.tuple([z.string(),z.string(),z.string()]),bend:z.union([z.literal(1),z.literal(-1)]),stretch:z.boolean().optional(),profileRootX:z.number().finite().optional(),
    fixedLength:z.boolean().optional(),pole:z.object({x:z.number().finite(),y:z.number().finite()}).optional(),
    gripSocket:z.object({x:z.number().finite(),y:z.number().finite(),rotation:z.number().finite().optional()}).optional(),
    target:z.object({objectId:z.string(),socketId:z.string()}).optional(),
    keyframes:z.array(z.object({timeMs:z.number().finite().nonnegative(),x:z.number().finite(),y:z.number().finite(),rotation:z.number().finite().optional(),mix:z.number().finite().min(0).max(1),bend:z.union([z.literal(1),z.literal(-1)]).optional(),easing:z.enum(["linear","smooth"]).optional()}))})).optional(),
  gripObjects:z.array(z.object({id:z.string(),sockets:z.record(z.string(),z.object({x:z.number().finite(),y:z.number().finite(),rotation:z.number().finite().optional()})),keyframes:z.array(z.object({timeMs:z.number().finite().nonnegative(),x:z.number().finite(),y:z.number().finite(),rotation:z.number().finite(),easing:z.enum(["linear","smooth","ease_in","ease_out"]).optional()}))})).optional(),
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
    studioArtwork:z.boolean().optional(),studioEntityId:z.string().optional(),sampling:z.enum(["smooth","pixel"]).optional(),
    id: z.string(),
    name: z.string(),
    width: z.number(),
    height: z.number(),
    pivot: PivotSchema,
    dualGrip: z.object({
      enabled: z.boolean(),
      mainGrip: z.object({ x: z.number(), y: z.number() }),
      offHandGrip: z.object({ x: z.number(), y: z.number() }).optional(),
    }).optional(),
    referenceAsset: z.object({
      format: z.enum(["svg", "png", "webp", "jpeg"]),
      name: z.string(),
      originalFileName: z.string(),
      mimeType: z.string(),
      dataUri: z.string().optional(),
    }).nullable().optional(),
    tracingAsset: z.object({
      format: z.enum(["svg", "png", "webp", "jpeg"]),
      name: z.string(),
      originalFileName: z.string(),
      mimeType: z.string(),
      dataUri: z.string().optional(),
    }).nullable().optional(),
    tracingOpacity: z.number().min(0).max(1).optional(),
    tracingVisible: z.boolean().optional(),
    tracingTransform: z.object({
      x: z.number(), y: z.number(), scale: z.number().min(0.1).max(20), rotation: z.number().optional(),
    }).optional(),
    layers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      visible: z.boolean(),
      locked: z.boolean().optional(),
      opacity: z.number().min(0).max(1).optional(),
      zIndex: z.number(),
      anatomicalOwner:z.string().optional(),depthBinding:z.object({boneId:z.string(),nearSlot:DepthSlotSchema,farSlot:DepthSlotSchema}).optional(),
      kind:z.enum(["vector","raster","group"]).optional(),parentId:z.string().nullable().optional(),
      assetId:z.string().optional(),transform:LocalTransformSchema.optional(),binding:RigBindingSchema.optional(),
      sourceSvg:z.string().optional(),savedMesh:VisualMeshSchema.optional(),sampling:z.enum(["smooth","pixel"]).optional(),
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
          preserveFrame: z.boolean().optional(),
          faceFeatureKey: z.enum(["eyes", "mouth", "brows", "beard", "hair", "generic"]).optional(),
          faceOverlayRole: FaceOverlayRoleSchema.optional(),
          symmetryMode: SpriteEditorSymmetryModeSchema.optional(),
          paintTarget: SpriteEditorPaintTargetSchema.optional(),
          paintToolPreset: z.enum(["vector_brush", "shape_stamp"]).optional(),
          bodyMorphPresetId: z.string().nullable().optional(),
          mannequinOverlay: z.enum(["none", "hand_1h", "hand_2h", "head", "body", "legs", "full_rig", "scale_human"]).optional(),
          groundPivot: z.object({ x: z.number(), y: z.number() }).optional(),
          gridMode: z.enum(["none", "pixel", "ortho", "iso"]).optional(),
        }).optional(),
    target: z.object({
      kind: z.enum(["item-part", "face-overlay", "entity-visual", "static-prop", "world-object"]),
      entityId: z.string().optional(),
      itemId: z.string().optional(),
      partId: z.string().optional(),
      overlayId: z.string().optional(),
      visualId: z.string().optional(),
      propId: z.string().optional(),
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
  assets:z.record(z.string(),z.object({id:z.string(),name:z.string(),mimeType:z.enum(["image/png","image/webp","image/jpeg"]),width:z.number().positive(),height:z.number().positive(),dataUri:z.string().startsWith("data:image/")})).default({}),
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
