/**
 * projectMigration.ts
 *
 * Version detection and migration for Project JSON files.
 *
 * Pipeline:
 *   JSON.parse(text)
 *     → detectProjectVersion(raw)
 *     → migrateProject(raw)          ← adds missing fields, bumps version
 *     → ProjectV2Schema.safeParse()  ← strict validation
 *     → loadProject(result.data)
 *
 * Old files are never broken: all new fields are optional with safe defaults.
 * Migration is idempotent: calling it twice on a v2.0 project is a no-op.
 */

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

// ── v1.x → v2.0 ──────────────────────────────────────────────────────────────

function migrateV1ToV2(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const r = { ...(raw as Record<string, unknown>) };

  r.version = "2.0";

  // templates: add boneParts (preserves existing non-empty boneParts)
  if (Array.isArray(r.templates)) {
    r.templates = (r.templates as Record<string, unknown>[]).map(t => ({
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
  }

  // items: add parts + coordinateMode (existing svgLayers-only items become legacy_full_frame)
  if (Array.isArray(r.items)) {
    r.items = (r.items as Record<string, unknown>[]).map(i => ({
      ...i,
      anchorRules:    i.anchorRules    ?? {},
      parts:          i.parts          ?? [],
      coordinateMode: i.coordinateMode ?? "legacy_full_frame",
    }));
  }

  // entities: add visuals + rootTransform
  if (Array.isArray(r.entities)) {
    r.entities = (r.entities as Record<string, unknown>[]).map(e => ({
      ...e,
      visuals:       e.visuals       ?? [],
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

  if (Array.isArray(r.templates)) {
    r.templates = (r.templates as Record<string, unknown>[]).map(t => ({
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
  }

  if (Array.isArray(r.items)) {
    r.items = (r.items as Record<string, unknown>[]).map(i => ({
      ...i,
      anchorRules: i.anchorRules ?? {},
      parts: i.parts ?? [],
      coordinateMode: i.coordinateMode ?? "legacy_full_frame",
    }));
  }

  if (Array.isArray(r.entities)) {
    r.entities = (r.entities as Record<string, unknown>[]).map(e => ({
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
    }));
  }

  return r;
}
import { ProjectSchema } from "@/domain/schema";
