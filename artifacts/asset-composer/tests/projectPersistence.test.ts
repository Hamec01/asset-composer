// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), download: vi.fn(), folder: vi.fn() }));
vi.mock("../src/lib/projectSession", () => ({ saveLastProjectSnapshot: mocks.save, getRecentProjectFolderPath: mocks.folder }));
vi.mock("../src/lib/download", () => ({ triggerDownload: mocks.download }));
import { useStore } from "../src/store";
import { saveLocalCopy, saveProjectFile, useSaveStatus } from "../src/lib/projectPersistence";
beforeEach(() => {
  useStore.getState().newProject(); mocks.save.mockReset().mockResolvedValue(true); mocks.download.mockReset(); mocks.folder.mockReset().mockReturnValue(null);
  useSaveStatus.setState({ status: "dirty", error: null, projectId: null, localRevision: null, fileRevision: null, fileDestination: null });
  delete window.assetComposerProjects;
});
describe("save feedback follows completed writes", () => {
  it("shows saving until the asynchronous local write finishes", async () => {
    let complete!: (success: boolean) => void;
    mocks.save.mockImplementationOnce(() => new Promise<boolean>(resolve => { complete = resolve; }));
    const pending = saveLocalCopy();
    expect(useSaveStatus.getState().status).toBe("saving");
    expect(useSaveStatus.getState().localRevision).toBeNull();
    complete(true); await pending;
    expect(useSaveStatus.getState().status).toBe("saved");
  });
  it("reports storage failure and supports retry", async () => {
    mocks.save.mockResolvedValueOnce(false);
    expect(await saveLocalCopy()).toBe(false);
    expect(useSaveStatus.getState().status).toBe("error");
    expect(useSaveStatus.getState().localRevision).toBeNull();
    expect(await saveLocalCopy()).toBe(true);
    expect(useSaveStatus.getState().status).toBe("saved");
  });
  it("never reports a changed project as fully saved after an older write", async () => {
    let complete!: (success: boolean) => void;
    mocks.save.mockImplementationOnce(() => new Promise<boolean>(resolve => { complete = resolve; }));
    const pending = saveLocalCopy();
    useStore.setState(s => { s.project.updatedAt += 1; });
    complete(true); await pending;
    expect(useSaveStatus.getState().status).toBe("dirty");
  });
  it("waits for desktop disk writing and keeps disk destination separate", async () => {
    let complete!: (success: boolean) => void;
    window.assetComposerProjects = { saveProjectToFolder: vi.fn(() => new Promise<boolean>(resolve => { complete = resolve; })) } as unknown as NonNullable<typeof window.assetComposerProjects>;
    const pending = saveProjectFile("C:/project");
    expect(useSaveStatus.getState().status).toBe("saving"); expect(mocks.save).not.toHaveBeenCalled();
    complete(true); expect(await pending).toBe(true);
    expect(useSaveStatus.getState().fileDestination).toBe("C:/project");
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledWith(expect.any(Object), "C:/project");
  });
  it("does not report success when disk writing fails", async () => {
    window.assetComposerProjects = { saveProjectToFolder: vi.fn().mockResolvedValue(false) } as unknown as NonNullable<typeof window.assetComposerProjects>;
    expect(await saveProjectFile("C:/project")).toBe(false);
    expect(useSaveStatus.getState().status).toBe("error");
    expect(useSaveStatus.getState().fileRevision).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(await saveProjectFile(undefined, true)).toBe(true);
    expect(mocks.download).toHaveBeenCalledOnce();
  });
  it("keeps disk saving visible while a concurrent local write completes", async () => {
    let complete!: (success: boolean) => void;
    window.assetComposerProjects = { saveProjectToFolder: vi.fn(() => new Promise<boolean>(resolve => { complete = resolve; })) } as unknown as NonNullable<typeof window.assetComposerProjects>;
    const pending = saveProjectFile("C:/project");
    await saveLocalCopy();
    expect(useSaveStatus.getState().status).toBe("saving");
    expect(useSaveStatus.getState().fileRevision).toBeNull();
    complete(true); await pending;
    expect(useSaveStatus.getState().fileDestination).toBe("C:/project");
    expect(useSaveStatus.getState().status).toBe("saved");
  });
});
