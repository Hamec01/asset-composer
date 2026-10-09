import type { Project } from "@/domain/types";
import type { ProjectSessionEntry } from "./projectSession";
let db: IDBDatabase | null = null;
let entries: ProjectSessionEntry[] = [];
let last: unknown = null;
let queue = Promise.resolve();
const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
export const databaseReady = () => !!db;
export const databaseEntries = () => entries;
export const databaseLast = () => last;
export async function initializeSessionDatabase(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  db?.close();
  const open = indexedDB.open("asset-composer-projects", 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore("projects", { keyPath: "id" });
    open.result.createObjectStore("assets", { keyPath: "id" });
    open.result.createObjectStore("meta");
  };
  db = await request(open);
  const tx = db.transaction(["projects", "assets", "meta"], "readonly");
  const [stored, assets, lastId] = await Promise.all([
    request(tx.objectStore("projects").getAll()),
    request(tx.objectStore("assets").getAll()),
    request(tx.objectStore("meta").get("last")),
  ]);
  const registry = Object.fromEntries(assets.map((a) => [a.id, a]));
  entries = stored
    .map((e) => ({
      ...e,
      snapshot: {
        ...e.snapshot,
        assets: Object.fromEntries(
          Object.keys(e.snapshot.assets ?? {}).map((id) => [id, registry[id]]),
        ),
      },
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);
  last = entries.find((e) => e.id === lastId)?.snapshot ?? null;
}
export function saveDatabaseSession(
  project: Project,
  folderPath?: string,
): Promise<void> {
  const task = async () => {
    if (!db) throw new Error("Project database is unavailable");
    const newer = entries.find(e => e.id === project.id && e.updatedAt > project.updatedAt);
    if (newer) project = newer.snapshot as Project;
    const assets = project.assets ?? {},
      snapshot = {
        ...project,
        assets: Object.fromEntries(
          Object.entries(assets).map(([id, a]) => [
            id,
            { ...a, dataUri: undefined },
          ]),
        ),
      };
    const existing = entries.find((e) => e.id === project.id);
    const entry = {
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      folderPath: folderPath ?? existing?.folderPath,
      snapshot,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(["projects", "assets", "meta"], "readwrite");
      Object.values(assets).forEach((asset) =>
        tx.objectStore("assets").put(asset),
      );
      tx.objectStore("projects").put(entry);
      tx.objectStore("meta").put(project.id, "last");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Save aborted"));
    });
    last = project;
    entries = [
      { ...entry, snapshot: project },
      ...entries.filter((e) => e.id !== project.id),
    ].slice(0, 6);
  };
  const next = queue.then(task);
  queue = next.catch(() => {});
  return next;
}
export async function clearSessionDatabase() {
  await queue;
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db!.transaction(["projects", "assets", "meta"], "readwrite");
    for (const name of ["projects", "assets", "meta"])
      tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  entries = [];
  last = null;
}
