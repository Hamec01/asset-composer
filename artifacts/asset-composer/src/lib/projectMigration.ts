import { ProjectSchema } from "@/domain/schema";
import { refreshCanonicalBuiltInItems } from "@/lib/canonicalItems";
import { refreshCanonicalBuiltInTemplates } from "@/data/templates";
import { ITEM_FIT_PROFILES } from "@/data/itemFitProfiles";
import type { Entity, Item, Template } from "@/domain/types";
import {
  normalizeLegacySharedLimbAssignments,
  pruneLegacyBodyCloneVisualsFromEntity,
} from "@/lib/projectNormalization";

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
    : { slotEditorByTemplateId: {} };

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
