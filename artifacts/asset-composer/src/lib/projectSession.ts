import { ProjectSchema } from "@/domain/schema";
import { migrateProject } from "@/lib/projectMigration";

const LAST_PROJECT_KEY = "asset-composer:last-project:v1";

export function loadLastProjectSnapshot(): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_PROJECT_KEY);
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
