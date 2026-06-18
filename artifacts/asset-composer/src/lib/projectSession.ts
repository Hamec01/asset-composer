import { ProjectSchema } from "@/domain/schema";
import { migrateProject } from "@/lib/projectMigration";

const LAST_PROJECT_KEY = "asset-composer:last-project:v2";
const LAST_PROJECT_KEY_LEGACY = "asset-composer:last-project:v1";
const RECENT_PROJECTS_KEY = "asset-composer:recent-projects:v1";
const MAX_RECENT_PROJECTS = 6;

export interface ProjectSessionEntry {
  id: string;
  name: string;
  updatedAt: number;
  snapshot: unknown;
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
  const entries: ProjectSessionEntry[] = [];
  for (const entry of loadRecentProjectEntries()) {
    try {
      const migrated = migrateProject(entry.snapshot);
      const result = ProjectSchema.safeParse(migrated);
      if (!result.success) continue;
      entries.push({
        id: result.data.id,
        name: result.data.name,
        updatedAt: result.data.updatedAt,
        snapshot: result.data,
      });
    } catch {
      continue;
    }
  }
  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProjectSession(projectId: string): unknown | null {
  const entries = getRecentProjectSessions();
  const entry = entries.find(candidate => candidate.id === projectId);
  return entry?.snapshot ?? null;
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

export function saveLastProjectSnapshot(project: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    const result = ProjectSchema.safeParse(project);
    if (!result.success) return false;
    window.localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify(result.data));

    const nextEntry: ProjectSessionEntry = {
      id: result.data.id,
      name: result.data.name,
      updatedAt: result.data.updatedAt,
      snapshot: result.data,
    };
    const nextEntries = [
      nextEntry,
      ...loadRecentProjectEntries().filter(entry => entry.id !== nextEntry.id),
    ];
    saveRecentProjectEntries(nextEntries);
    return true;
  } catch {
    return false;
  }
}

export function restoreLastProjectSnapshot(): unknown | null {
  const snapshot = loadLastProjectSnapshot();
  if (!snapshot) return null;
  try {
    const migrated = migrateProject(snapshot);
    const result = ProjectSchema.safeParse(migrated);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}
