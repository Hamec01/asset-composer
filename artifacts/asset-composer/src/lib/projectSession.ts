import { parseProjectSnapshot } from "@/lib/projectValidation";
import type { AttachmentOverride, Item, Project, Template } from "@/domain/types";
import {
  normalizeLegacySharedLimbAssignments,
  pruneLegacyBodyCloneVisualsFromEntity,
} from "@/lib/projectNormalization";

const LAST_PROJECT_KEY = "asset-composer:last-project:v2";
const LAST_PROJECT_KEY_LEGACY = "asset-composer:last-project:v1";
const RECENT_PROJECTS_KEY = "asset-composer:recent-projects:v1";
const SESSION_DEBUG_KEY = "asset-composer:session-debug:v1";
const MAX_RECENT_PROJECTS = 6;
const MAX_DEBUG_EVENTS = 120;

interface SessionDebugEvent {
  time: number;
  event: string;
  details: Record<string, unknown>;
}

export interface ProjectSessionEntry {
  id: string;
  name: string;
  updatedAt: number;
  folderPath?: string;
  snapshot: unknown;
}

function pushSessionDebug(event: string, details: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const payload: SessionDebugEvent = {
    time: Date.now(),
    event,
    details,
  };

  try {
    const raw = window.localStorage.getItem(SESSION_DEBUG_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(existing) ? [...existing, payload].slice(-MAX_DEBUG_EVENTS) : [payload];
    window.localStorage.setItem(SESSION_DEBUG_KEY, JSON.stringify(next));
  } catch {
    // ignore debug logging failures
  }

  if (import.meta.env.DEV) {
    console.info("[asset-composer][session]", event, details);
    (
      window as typeof window & {
        __assetComposerSessionDebug?: SessionDebugEvent[];
      }
    ).__assetComposerSessionDebug = getSessionDebugLog();
  }
}

export function getSessionDebugLog(): SessionDebugEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSION_DEBUG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as SessionDebugEvent[] : [];
  } catch {
    return [];
  }
}

function sanitizeProjectForSession(project: Project): Project {
  const templateById = new Map(project.templates.map(template => [template.id, template]));
  const itemById = new Map(project.items.map(item => [item.id, item]));
  let removedVisuals = 0;
  let normalizedOverrides = 0;
  let normalizedSlots = 0;

  const entities = project.entities.map(entity => {
    const template = templateById.get(entity.templateId);
    let nextEntity = entity;

    if (template) {
      const normalizedSlotsEntity = normalizeLegacySharedLimbAssignments(nextEntity, template, project.items);
      if (normalizedSlotsEntity !== nextEntity) {
        normalizedSlots += 1;
        pushSessionDebug("sanitize:split-shared-limb-slots", {
          entityId: entity.id,
          templateId: template.id,
        });
        nextEntity = normalizedSlotsEntity;
      }

      const prunedVisualEntity = pruneLegacyBodyCloneVisualsFromEntity(nextEntity, template);
      if (prunedVisualEntity !== nextEntity) {
        const beforeVisualCount = nextEntity.visuals?.length ?? 0;
        const afterVisualCount = prunedVisualEntity.visuals?.length ?? 0;
        removedVisuals += beforeVisualCount - afterVisualCount;
        pushSessionDebug("sanitize:remove-body-clone-visuals", {
          entityId: entity.id,
          templateId: template.id,
          removedCount: beforeVisualCount - afterVisualCount,
        });
        nextEntity = prunedVisualEntity;
      }
    }

    if (template) {
      const nextSlots = nextEntity.slots.map(slot => {
        const item = slot.itemId ? itemById.get(slot.itemId) ?? null : null;
        const sanitizedOverride = sanitizeSuspiciousAttachmentOverride(
          slot.attachmentOverride,
          item,
          template,
        );
        if (sanitizedOverride === slot.attachmentOverride) {
          return slot;
        }

        normalizedOverrides += 1;
        pushSessionDebug("sanitize:reset-attachment-override", {
          entityId: entity.id,
          slotId: slot.slotId,
          itemId: slot.itemId ?? null,
          before: slot.attachmentOverride,
          after: sanitizedOverride,
        });

        return {
          ...slot,
          attachmentOverride: sanitizedOverride,
        };
      });

      if (nextSlots !== nextEntity.slots) {
        nextEntity = {
          ...nextEntity,
          slots: nextSlots,
        };
      }
    }

    return nextEntity;
  });

  if (removedVisuals === 0 && normalizedOverrides === 0 && normalizedSlots === 0) {
    return project;
  }

  return {
    ...project,
    entities,
  };
}

function sanitizeSuspiciousAttachmentOverride(
  override: Partial<AttachmentOverride> | undefined,
  item: Item | null,
  template: Template,
): Partial<AttachmentOverride> {
  if (!override || !item) return override ?? {};

  const hasBoneLocalParts = item.parts?.some(part => part.coordinateMode === "bone_local") ?? false;
  if (!hasBoneLocalParts) return override;

  const scaleX = override.scaleX ?? 1;
  const scaleY = override.scaleY ?? 1;
  const offsetX = override.offsetX ?? 0;
  const offsetY = override.offsetY ?? 0;

  const scaleTooSmall = Math.abs(scaleX) < 0.2 || Math.abs(scaleY) < 0.2;
  const scaleTooLarge = Math.abs(scaleX) > 5 || Math.abs(scaleY) > 5;
  const offsetTooLarge =
    Math.abs(offsetX) > template.previewWidth ||
    Math.abs(offsetY) > template.previewHeight;

  if (!scaleTooSmall && !scaleTooLarge && !offsetTooLarge) {
    return override;
  }

  return {
    ...override,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

function normalizeSessionSnapshot(snapshot: unknown, source: string): Project | null {
  try {
    const parsed = parseProjectSnapshot(snapshot);
    const sanitized = sanitizeProjectForSession(parsed);
    pushSessionDebug("snapshot:normalized", {
      source,
      projectId: sanitized.id,
      projectName: sanitized.name,
      entityCount: sanitized.entities.length,
    });
    return sanitized;
  } catch (error) {
    pushSessionDebug("snapshot:normalize-failed", {
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function persistNormalizedLastSnapshot(project: Project) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify(project));
  } catch {
    // ignore persistence failures during restore
  }
}

function loadRecentProjectEntries(): ProjectSessionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const entries: ProjectSessionEntry[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const candidate = entry as Partial<ProjectSessionEntry>;
      if (typeof candidate.id !== "string") continue;
      if (typeof candidate.name !== "string") continue;
      if (typeof candidate.updatedAt !== "number") continue;
      entries.push({
        id: candidate.id,
        name: candidate.name,
        updatedAt: candidate.updatedAt,
        folderPath: typeof candidate.folderPath === "string" ? candidate.folderPath : undefined,
        snapshot: candidate.snapshot,
      });
    }
    return entries;
  } catch {
    return [];
  }
}

function saveRecentProjectEntries(entries: ProjectSessionEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(entries.slice(0, MAX_RECENT_PROJECTS)));
}

export function getRecentProjectSessions(): ProjectSessionEntry[] {
  let changed = false;
  const entries: ProjectSessionEntry[] = [];
  for (const entry of loadRecentProjectEntries()) {
    const result = normalizeSessionSnapshot(entry.snapshot, "recent-project");
    if (!result) continue;
    if (result !== entry.snapshot) {
      changed = true;
    }
    entries.push({
      id: result.id,
      name: result.name,
      updatedAt: result.updatedAt,
      folderPath: entry.folderPath,
      snapshot: result,
    });
  }
  if (changed) {
    saveRecentProjectEntries(entries);
  }
  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProjectSession(projectId: string): unknown | null {
  const entries = getRecentProjectSessions();
  const entry = entries.find(candidate => candidate.id === projectId);
  return entry?.snapshot ?? null;
}

export function getRecentProjectFolderPath(projectId: string): string | null {
  const entries = getRecentProjectSessions();
  const entry = entries.find(candidate => candidate.id === projectId);
  return entry?.folderPath ?? null;
}

export function loadLastProjectSnapshot(): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_PROJECT_KEY) ?? window.localStorage.getItem(LAST_PROJECT_KEY_LEGACY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getLastProjectSnapshotName(): string | null {
  const snapshot = loadLastProjectSnapshot();
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const name = (snapshot as { name?: unknown }).name;
  return typeof name === "string" && name.trim().length > 0 ? name : null;
}

export function saveLastProjectSnapshot(project: unknown, folderPath?: string): boolean {
  if (typeof window === "undefined") return false;
  const result = normalizeSessionSnapshot(project, "save-last-project");
  if (!result) {
    return false;
  }

  try {
    window.localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify(result));

    const existing = loadRecentProjectEntries().find(entry => entry.id === result.id);
    const nextEntry: ProjectSessionEntry = {
      id: result.id,
      name: result.name,
      updatedAt: result.updatedAt,
      folderPath: folderPath ?? existing?.folderPath,
      snapshot: result,
    };
    const nextEntries = [
      nextEntry,
      ...loadRecentProjectEntries()
        .filter(entry => entry.id !== nextEntry.id)
        .map(entry => ({
          ...entry,
          folderPath: entry.folderPath ?? existing?.folderPath,
        })),
    ];
    saveRecentProjectEntries(nextEntries);
    pushSessionDebug("snapshot:saved", {
      projectId: result.id,
      projectName: result.name,
      folderPath: folderPath ?? existing?.folderPath ?? null,
    });
    return true;
  } catch (error) {
    pushSessionDebug("snapshot:save-failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function restoreLastProjectSnapshot(): unknown | null {
  const snapshot = loadLastProjectSnapshot();
  if (!snapshot) {
    pushSessionDebug("snapshot:restore-miss", {});
    return null;
  }
  const normalized = normalizeSessionSnapshot(snapshot, "restore-last-project");
  if (normalized) {
    persistNormalizedLastSnapshot(normalized);
  }
  return normalized;
}
