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
  if (version === "2.0") return raw;
  return migrateV1ToV2(raw);
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
      boneParts: t.boneParts ?? [],
    }));
  }

  // items: add parts + coordinateMode (existing svgLayers-only items become legacy_full_frame)
  if (Array.isArray(r.items)) {
    r.items = (r.items as Record<string, unknown>[]).map(i => ({
      ...i,
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
    }));
  }

  return r;
}
