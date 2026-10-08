import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initializeSessionDatabase,
  saveDatabaseSession,
  databaseLast,
  databaseEntries,
  clearSessionDatabase,
} from "../src/lib/sessionDatabase";
import { useStore } from "../src/store";
import type { Project } from "../src/domain/types";
beforeAll(initializeSessionDatabase);
beforeEach(async () => {
  await clearSessionDatabase();
  useStore.getState().newProject();
});
describe("IndexedDB project transactions", () => {
  it("restores a large raster resource once across layers and revisions", async () => {
    const project = structuredClone(useStore.getState().project);
    project.assets = {
      shared: {
        id: "shared",
        name: "large",
        mimeType: "image/png",
        width: 2048,
        height: 2048,
        dataUri: "data:image/png;base64," + "A".repeat(6_000_000),
      },
    };
    await saveDatabaseSession(project, "C:/art/tree");
    await initializeSessionDatabase();
    expect(
      (databaseLast() as Project).assets?.shared.dataUri.length,
    ).toBeGreaterThan(6_000_000);
    expect(databaseEntries()[0].folderPath).toBe("C:/art/tree");
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("asset-composer-projects", 1);
      r.onsuccess = () => resolve(r.result);
    });
    const count = await new Promise<number>((resolve) => {
      const r = db.transaction("assets").objectStore("assets").count();
      r.onsuccess = () => resolve(r.result);
    });
    expect(count).toBe(1);
    db.close();
  });
  it("retains the last successful snapshot after a failed write and accepts a later save", async () => {
    const project = structuredClone(useStore.getState().project);
    await saveDatabaseSession(project);
    const broken = { ...project, name: "Not committed" };
    const spy = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementationOnce(() => {
        throw new DOMException("Disk full", "QuotaExceededError");
      });
    await expect(saveDatabaseSession(broken)).rejects.toThrow("Disk full");
    spy.mockRestore();
    expect((databaseLast() as Project).name).toBe(project.name);
    await initializeSessionDatabase();
    expect((databaseLast() as Project).name).toBe(project.name);
    await saveDatabaseSession({ ...project, name: "Recovered" });
    expect((databaseLast() as Project).name).toBe("Recovered");
  });
});
