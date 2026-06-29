import { ProjectSchema } from "@/domain/schema";
import { refreshCanonicalBuiltInItems } from "@/lib/canonicalItems";
import { refreshCanonicalBuiltInTemplates } from "@/data/templates";
import { ITEM_FIT_PROFILES } from "@/data/itemFitProfiles";
import type { Entity, Item, Template } from "@/domain/types";
import {
  normalizeLegacySharedLimbAssignments,
  pruneLegacyBodyCloneVisualsFromEntity,
} from "@/lib/projectNormalization";

const DEFAULT_BODY_MORPHS = {
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
};

const DEFAULT_BODY_AUTHORING = {
  focusRegion: "global",
  activeBoneId: null,
  activeSlotId: null,
  intent: "morph",
  viewportMode: "focus_region",
  regionPresetIds: {},
};

const DEFAULT_FACE_TRANSFORM = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};

const DEFAULT_FACE_CUSTOMIZATION = {
  eyes: { presetId: "round_kawaii", color: "#2B1D18", visible: true, transform: DEFAULT_FACE_TRANSFORM },
  mouth: { presetId: "soft_smile", color: "#1A1A1A", visible: true, transform: DEFAULT_FACE_TRANSFORM },
  brows: { presetId: "soft_arc", color: "#3B2314", visible: false, transform: DEFAULT_FACE_TRANSFORM },
  beard: { presetId: "none", color: "#3B2314", visible: false, transform: DEFAULT_FACE_TRANSFORM },
  hair: { presetId: "none", color: "#3B2314", visible: false, transform: DEFAULT_FACE_TRANSFORM },
  overlays: [],
};

const DEFAULT_FACE_AUTHORING = {
  activeFeatureKey: null,
  overlayFilter: "all",
  selectedOverlayId: null,
  activeBoneId: null,
  activeSlotId: null,
  workflowMode: "feature",
  draftOverlayRole: "detail",
  draftPaintTarget: "both",
  draftSymmetryMode: "none",
  overlayRoleFilter: "all",
  paintTargetFilter: "all",
  overlayGrouping: "feature",
  drawMode: null,
  focusMode: "document",
};

const DEFAULT_EDITOR_META = {
  slotEditorByTemplateId: {},
  spriteEditorDocuments: [],
  activeSpriteDocumentId: null,
  activeAuthoringMode: null,
  activeFaceCanvasOverlayId: null,
  activeFaceCanvasTool: null,
  activeFaceCanvasFocusMode: null,
};

/**
 * projectMigration.ts
 *
 * Version detection and migration for Project JSON files.
 *
 * Pipeline:
 *   JSON.parse(text)
 *     -> detectProjectVersion(raw)
 *     -> migrateProject(raw)          <- adds missing fields, bumps version
 *     -> ProjectV2Schema.safeParse()  <- strict validation
 *     -> loadProject(result.data)
 *
 * Old files are never broken: all new fields are optional with safe defaults.
 * Migration is idempotent: calling it twice on a v2.0 project is a no-op.
 */

function normalizeMigratedItems(items: Record<string, unknown>[]) {
  return refreshCanonicalBuiltInItems(items).map(item => ({
    ...item,
    anchorRules: item.anchorRules ?? {},
    parts: item.parts ?? [],
    coordinateMode: item.coordinateMode ?? "legacy_full_frame",
    svgLayers: item.svgLayers ?? [],
  }));
}

function normalizeMigratedTemplates(templates: Record<string, unknown>[]) {
  const normalized = templates.map(t => ({
    ...t,
    anchors: t.anchors ?? {},
    boneParts: t.boneParts ?? [],
    slots: Array.isArray(t.slots)
      ? (t.slots as Record<string, unknown>[]).map(slot => ({
          ...slot,
          defaultAnchorId: slot.defaultAnchorId ?? undefined,
          defaultTransform: slot.defaultTransform ?? undefined,
        }))
      : [],
  }));
  return refreshCanonicalBuiltInTemplates(normalized as Template[]);
}

export function detectProjectVersion(raw: unknown): string {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const v = (raw as Record<string, unknown>).version;
    if (typeof v === "string") return v;
  }
  return "1.0";
}

/** Migrate any project version to v2.0. Safe to call on already-v2.0 data. */
export function migrateProject(raw: unknown): unknown {
  const version = detectProjectVersion(raw);
  const migrated = version === "2.0" ? normalizeV2Project(raw) : migrateV1ToV2(raw);
  const parsed = ProjectSchema.safeParse(migrated);
  return parsed.success ? parsed.data : migrated;
}

function migrateV1ToV2(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const r = { ...(raw as Record<string, unknown>) };

  r.version = "2.0";

  if (Array.isArray(r.templates)) {
    r.templates = normalizeMigratedTemplates(r.templates as Record<string, unknown>[]);
  }

  if (Array.isArray(r.items)) {
    r.items = normalizeMigratedItems(r.items as Record<string, unknown>[]);
  }

  r.itemFitProfiles = Array.isArray(r.itemFitProfiles) ? r.itemFitProfiles : ITEM_FIT_PROFILES;

  if (Array.isArray(r.entities)) {
    r.entities = (r.entities as Record<string, unknown>[]).map(e => ({
      ...e,
      visuals: e.visuals ?? [],
      rootTransform: e.rootTransform ?? null,
      slots: Array.isArray(e.slots)
        ? (e.slots as Record<string, unknown>[]).map(slot => ({
            ...slot,
            attachmentOverride: slot.attachmentOverride ?? {},
          }))
        : [],
    }));
  }

  return normalizeV2Project(r);
}

function normalizeV2Project(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const r = { ...(raw as Record<string, unknown>) };
  r.version = "2.0";
  const editorMeta = r.editorMeta;
  r.editorMeta = (
    editorMeta &&
    typeof editorMeta === "object" &&
    !Array.isArray(editorMeta)
  )
    ? {
        ...editorMeta,
        slotEditorByTemplateId: Object.fromEntries(
          Object.entries((editorMeta as Record<string, unknown>).slotEditorByTemplateId ?? {})
            .map(([templateId, value]) => {
              const record = value && typeof value === "object" && !Array.isArray(value)
                ? value as Record<string, unknown>
                : {};
              return [templateId, {
                hiddenSlotIds: Array.isArray(record.hiddenSlotIds) ? record.hiddenSlotIds : [],
                lockedSlotIds: Array.isArray(record.lockedSlotIds) ? record.lockedSlotIds : [],
              }];
            }),
        ),
      }
    : { ...DEFAULT_EDITOR_META };
  r.editorMeta = {
    ...DEFAULT_EDITOR_META,
    ...(r.editorMeta as Record<string, unknown>),
    spriteEditorDocuments: Array.isArray((r.editorMeta as Record<string, unknown>).spriteEditorDocuments)
      ? (r.editorMeta as Record<string, unknown>).spriteEditorDocuments
      : [],
    activeSpriteDocumentId: (r.editorMeta as Record<string, unknown>).activeSpriteDocumentId ?? null,
    activeAuthoringMode: (r.editorMeta as Record<string, unknown>).activeAuthoringMode ?? null,
    activeFaceCanvasOverlayId: (r.editorMeta as Record<string, unknown>).activeFaceCanvasOverlayId ?? null,
    activeFaceCanvasTool: (r.editorMeta as Record<string, unknown>).activeFaceCanvasTool ?? null,
    activeFaceCanvasFocusMode: (r.editorMeta as Record<string, unknown>).activeFaceCanvasFocusMode ?? null,
  };

  if (Array.isArray(r.templates)) {
    r.templates = normalizeMigratedTemplates(r.templates as Record<string, unknown>[]);
  }

  if (Array.isArray(r.items)) {
    r.items = normalizeMigratedItems(r.items as Record<string, unknown>[]);
  }

  r.itemFitProfiles = Array.isArray(r.itemFitProfiles) ? r.itemFitProfiles : ITEM_FIT_PROFILES;

  if (Array.isArray(r.entities)) {
    const templates = Array.isArray(r.templates) ? (r.templates as Template[]) : [];
    const items = Array.isArray(r.items) ? (r.items as Item[]) : [];
    r.entities = (r.entities as Record<string, unknown>[]).map(e => {
      const normalizedEntity = {
        ...e,
        visuals: e.visuals ?? [],
        rootTransform: e.rootTransform ?? null,
        species: e.species ?? "",
        bodyMorphPresetId: e.bodyMorphPresetId ?? null,
        bodyAuthoring: {
          ...DEFAULT_BODY_AUTHORING,
          ...(e.bodyAuthoring as Record<string, unknown> ?? {}),
          regionPresetIds: {
            ...DEFAULT_BODY_AUTHORING.regionPresetIds,
            ...(((e.bodyAuthoring as Record<string, unknown> | undefined)?.regionPresetIds as Record<string, unknown>) ?? {}),
          },
        },
        bodyMorphs: { ...DEFAULT_BODY_MORPHS, ...(e.bodyMorphs as Record<string, unknown> ?? {}) },
        faceCustomization: {
          ...DEFAULT_FACE_CUSTOMIZATION,
          ...(e.faceCustomization as Record<string, unknown> ?? {}),
          eyes: {
            ...DEFAULT_FACE_CUSTOMIZATION.eyes,
            ...((e.faceCustomization as Record<string, unknown> | undefined)?.eyes as Record<string, unknown> ?? {}),
            transform: {
              ...DEFAULT_FACE_TRANSFORM,
              ...(((e.faceCustomization as Record<string, unknown> | undefined)?.eyes as Record<string, unknown> | undefined)?.transform as Record<string, unknown> ?? {}),
            },
          },
          mouth: {
            ...DEFAULT_FACE_CUSTOMIZATION.mouth,
            ...((e.faceCustomization as Record<string, unknown> | undefined)?.mouth as Record<string, unknown> ?? {}),
            transform: {
              ...DEFAULT_FACE_TRANSFORM,
              ...(((e.faceCustomization as Record<string, unknown> | undefined)?.mouth as Record<string, unknown> | undefined)?.transform as Record<string, unknown> ?? {}),
            },
          },
          brows: {
            ...DEFAULT_FACE_CUSTOMIZATION.brows,
            ...((e.faceCustomization as Record<string, unknown> | undefined)?.brows as Record<string, unknown> ?? {}),
            transform: {
              ...DEFAULT_FACE_TRANSFORM,
              ...(((e.faceCustomization as Record<string, unknown> | undefined)?.brows as Record<string, unknown> | undefined)?.transform as Record<string, unknown> ?? {}),
            },
          },
          beard: {
            ...DEFAULT_FACE_CUSTOMIZATION.beard,
            ...((e.faceCustomization as Record<string, unknown> | undefined)?.beard as Record<string, unknown> ?? {}),
            transform: {
              ...DEFAULT_FACE_TRANSFORM,
              ...(((e.faceCustomization as Record<string, unknown> | undefined)?.beard as Record<string, unknown> | undefined)?.transform as Record<string, unknown> ?? {}),
            },
          },
            hair: {
              ...DEFAULT_FACE_CUSTOMIZATION.hair,
              ...((e.faceCustomization as Record<string, unknown> | undefined)?.hair as Record<string, unknown> ?? {}),
              transform: {
                ...DEFAULT_FACE_TRANSFORM,
                ...(((e.faceCustomization as Record<string, unknown> | undefined)?.hair as Record<string, unknown> | undefined)?.transform as Record<string, unknown> ?? {}),
              },
            },
            overlays: Array.isArray((e.faceCustomization as Record<string, unknown> | undefined)?.overlays)
              ? ((e.faceCustomization as Record<string, unknown>).overlays as Record<string, unknown>[]).map(overlay => ({
                ...overlay,
                overlayRole: overlay.overlayRole ?? "detail",
                symmetryMode: overlay.symmetryMode ?? "none",
                paintTarget: overlay.paintTarget ?? "both",
              }))
              : [],
          },
          faceAuthoring: {
            ...DEFAULT_FACE_AUTHORING,
            ...(e.faceAuthoring as Record<string, unknown> ?? {}),
        },
        slots: Array.isArray(e.slots)
          ? (e.slots as Record<string, unknown>[]).map(slot => ({
              ...slot,
              paletteOverride: slot.paletteOverride ?? {},
              attachmentOverride: slot.attachmentOverride ?? {},
            }))
          : [],
      } as Entity;
      const template = templates.find(candidate => candidate.id === normalizedEntity.templateId);
      const normalizedSlotsEntity = normalizeLegacySharedLimbAssignments(normalizedEntity, template, items);
      return pruneLegacyBodyCloneVisualsFromEntity(normalizedSlotsEntity, template);
    });
  }

  return r;
}
