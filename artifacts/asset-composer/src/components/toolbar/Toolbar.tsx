import { useRef, useState } from "react";
import { useStore } from "@/store";
import { useWorkbench } from "@/store/workbench";
import { useSaveStatus, saveProjectFile, saveLocalCopy } from "@/lib/projectPersistence";
import { parseProjectSnapshot } from "@/lib/projectValidation";
import { beginCreation, resumeProject } from "@/lib/assetNavigation";
import { exportEntityFor, buildAssetCatalog, assetKey } from "@/lib/assetCatalog";
import { Plus, Save, FolderOpen, Undo2, Redo2, Download, Upload, CircleHelp } from "lucide-react";

export function Toolbar() {
  const project = useStore(s => s.project), history = useStore(s => s.history);
  const ref = useWorkbench(s => s.activeAsset), workspace = useWorkbench(s => s.workspace);
  const screen = useWorkbench(s => s.screen);
  const save = useSaveStatus();
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const entry = ref && buildAssetCatalog(project).find(e => assetKey(e.ref) === assetKey(ref));
  const exportEntity = screen === "editor" ? exportEntityFor(project, ref) : undefined;
  const saving = save.status === "saving";
  const status = save.projectId !== project.id ? "Локальная копия ещё не сохранена" : saving ? "Сохраняется…" : save.status === "error" ? "Ошибка сохранения" : save.localRevision !== project.updatedAt || save.status === "dirty" ? "Есть изменения" : "Локальная копия сохранена";
  return <>
    <header data-testid="toolbar" className="workbench-toolbar">
      <label className="project-title"><span>Проект</span><input data-testid="toolbar-project-name" aria-label="Название проекта" value={project.name} onChange={e => useStore.getState().setProjectName(e.target.value)} /></label>
      <div className="toolbar-actions">
        <button className="action-primary" data-testid="toolbar-new-entity" onClick={() => beginCreation()}><Plus size={16} /> Создать</button>
        <button className="action-secondary" data-testid="toolbar-import-svg" onClick={() => useStore.getState().openImportWizard()}><Upload size={16} /> Импортировать</button>
        <button className="action-icon" data-testid="toolbar-undo" aria-label="Отменить изменение" title="Отменить (Ctrl+Z)" onClick={() => useStore.getState().undo()} disabled={!history.past.length}><Undo2 size={18} /></button>
        <button className="action-icon" data-testid="toolbar-redo" aria-label="Повторить изменение" title="Повторить (Ctrl+Y / Ctrl+Shift+Z)" onClick={() => useStore.getState().redo()} disabled={!history.future.length}><Redo2 size={18} /></button>
        <button className="action-secondary" data-testid="toolbar-save" onClick={() => { void saveProjectFile(); }} disabled={saving}><Save size={16} /> Сохранить</button>
        <button className="action-icon" data-testid="toolbar-load" title="Открыть проект JSON" aria-label="Открыть проект" onClick={() => fileRef.current?.click()}><FolderOpen size={18} /></button>
        <button className="action-secondary" data-testid="toolbar-export" onClick={() => useStore.getState().openExport()}><Download size={16} /> Экспортировать</button>
        <button className="action-icon" aria-label="Помощь для текущего раздела" title="Инструкция и FAQ (F1)" onClick={() => useWorkbench.setState({ helpTopic: screen === "library" ? "start" : workspace })}><CircleHelp size={19} /></button>
      </div>
      <input hidden ref={fileRef} type="file" accept=".json" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
        try { const parsed = parseProjectSnapshot(JSON.parse(await file.text())); await saveLocalCopy(); useStore.getState().loadProject(parsed); await saveLocalCopy(useStore.getState().project); resumeProject(); setError(""); }
        catch (err) { setError(err instanceof Error ? err.message : "Не удалось прочитать проект JSON."); }
      }} />
    </header>
    <div className="workbench-status" role="status" aria-live="polite">
      <span className={save.status === "error" ? "text-red-400" : ""}><span className="status-dot" />{status}</span>
      {save.projectId === project.id && save.fileDestination && <span>{save.fileDestination}{save.fileRevision !== project.updatedAt ? " · файл содержит предыдущие изменения" : ""}</span>}
      <span className="ml-auto">{entry ? `${entry.name}${exportEntity && entry.category === "equipment" && ref?.kind === "item" ? ` · экспорт с ${exportEntity.name}` : ""}` : "Выберите задачу или объект в библиотеке"}</span>
    </div>
    {(error || save.error) && <div className="workbench-error" role="alert"><span>{error || save.error}</span><button onClick={() => { setError(""); useSaveStatus.setState({ error: null }); }}>Закрыть</button><button onClick={() => { void saveProjectFile(undefined, true); }}>Скачать JSON проекта</button></div>}
  </>;
}
