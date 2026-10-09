import { create } from "zustand";
import { useStore } from "@/store";
import { compactProjectAssets } from "./projectAssets";
import { parseProjectSnapshot } from "./projectValidation";
import { getRecentProjectFolderPath, saveLastProjectSnapshot } from "./projectSession";
import { triggerDownload } from "./download";

export const useSaveStatus = create<{
  status: "dirty" | "saving" | "saved" | "error";
  error: string | null;
  projectId: string | null;
  localRevision: number | null;
  fileRevision: number | null;
  fileDestination: string | null;
}>(() => ({ status: "dirty", error: null, projectId: null, localRevision: null, fileRevision: null, fileDestination: null }));
let sequence = 0;
let fileSequence = 0;
let fileWriting = false;
export async function saveLocalCopy(project = useStore.getState().project, folderPath?: string) {
  const ticket = ++sequence;
  if (!fileWriting) useSaveStatus.setState({ status: "saving", error: null, projectId: project.id });
  try {
    const saved = await (folderPath ? saveLastProjectSnapshot(project, folderPath) : saveLastProjectSnapshot(project));
    if (!saved) throw new Error("Не удалось записать локальную копию. Сохраните переносимый файл проекта.");
    if (!fileWriting && ticket === sequence && useStore.getState().project.id === project.id) useSaveStatus.setState({ status: useStore.getState().project.id === project.id && useStore.getState().project.updatedAt === project.updatedAt ? "saved" : "dirty", localRevision: project.updatedAt });
    return true;
  } catch (e) {
    if (!fileWriting && ticket === sequence && useStore.getState().project.id === project.id) useSaveStatus.setState({ status: "error", error: e instanceof Error ? e.message : "Ошибка сохранения." });
    return false;
  }
}
export async function saveProjectFile(folderOverride?: string, portable = false) {
  const project = useStore.getState().project;
  const ticket = ++fileSequence;
  fileWriting = true;
  useSaveStatus.setState({ status: "saving", error: null, projectId: project.id });
  try {
    const parsed = parseProjectSnapshot(compactProjectAssets(project));
    const folder = portable ? null : folderOverride ?? getRecentProjectFolderPath(project.id);
    let destination: string;
    if (folder && window.assetComposerProjects) {
      if (!await window.assetComposerProjects.saveProjectToFolder(folder, parsed)) throw new Error("Не удалось записать project.json. Проверьте доступ к папке или скачайте переносимый JSON.");
      destination = folder;
    } else {
      const filename = `${project.name.trim().replace(/[<>:"/\\|?*\s]+/g, "_") || "project"}.json`;
      triggerDownload(new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" }), filename);
      destination = `Передан в загрузки: ${filename}`;
    }
    const localSaved = await saveLastProjectSnapshot(parsed, folder ?? undefined);
    if (ticket === fileSequence && useStore.getState().project.id === project.id) useSaveStatus.setState({ status: localSaved ? (useStore.getState().project.updatedAt === project.updatedAt ? "saved" : "dirty") : "error", projectId: project.id,
      error: localSaved ? null : "Файл подготовлен, но локальная копия не сохранена.",
      localRevision: localSaved ? project.updatedAt : null, fileRevision: project.updatedAt, fileDestination: destination });
    return localSaved;
  } catch (e) {
    if (ticket === fileSequence && useStore.getState().project.id === project.id) useSaveStatus.setState({ status: "error", error: e instanceof Error ? e.message : "Не удалось сохранить проект." });
    return false;
  } finally {
    if (ticket === fileSequence) fileWriting = false;
  }
}
