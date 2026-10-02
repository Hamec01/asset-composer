import { useStore } from "@/store";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ProjectSchema } from "@/domain/schema";
import { Button } from "@/components/ui/button";
import { STYLE_SETS } from "@/data/styleSets";
import { migrateProject } from "@/lib/projectMigration";
import { triggerDownload } from "@/lib/download";
import { clearProjectSessions, getRecentProjectFolderPath, saveLastProjectSnapshot } from "@/lib/projectSession";
import {
  Plus, Save, FolderOpen, Undo2, Redo2, Download, Layers, Upload, Home, Trash2,
} from "lucide-react";
import { ImportWizard } from "@/components/wizard/ImportWizard";

export function Toolbar() {
  const [resetOpen, setResetOpen] = useState(false);
  const project           = useStore(s => s.project);
  const history           = useStore(s => s.history);
  const editor            = useStore(s => s.editor);
  const openWizard        = useStore(s => s.openWizard);
  const openExport        = useStore(s => s.openExport);
  const openImportWizard  = useStore(s => s.openImportWizard);
  const closeImportWizard = useStore(s => s.closeImportWizard);
  const undo              = useStore(s => s.undo);
  const redo              = useStore(s => s.redo);
  const setProjectName    = useStore(s => s.setProjectName);
  const setProjectStyleSet = useStore(s => s.setProjectStyleSet);
  const setAppState       = useStore(s => s.setAppState);
  const getActiveEntity   = useStore(s => s.getActiveEntity);
  const loadProject       = useStore(s => s.loadProject);

  const activeEntity = getActiveEntity();
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  async function handleSaveProject() {
    const result = ProjectSchema.safeParse(project);
    if (!result.success) {
      const msgs = result.error.issues
        .slice(0, 5)
        .map(i => `• ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      alert(`Cannot save — project has validation errors:\n${msgs}`);
      return;
    }

    const folderPath = getRecentProjectFolderPath(project.id);
    if (folderPath && window.assetComposerProjects) {
      const saved = await window.assetComposerProjects.saveProjectToFolder(folderPath, result.data);
      if (!saved) {
        alert("Could not save the project folder.");
        return;
      }
      saveLastProjectSnapshot(result.data, folderPath);
      return;
    }

    const data = JSON.stringify(result.data, null, 2);
    saveLastProjectSnapshot(result.data);
    const blob = new Blob([data], { type: "application/json" });
    triggerDownload(blob, `${project.name.replace(/\s+/g, "_")}.json`);
  }


  function handleLoad() {
    const input    = document.createElement("input");
    input.type     = "file";
    input.accept   = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text   = await file.text();
        const parsed = JSON.parse(text);
        // Migrate first, then validate
        const migrated = migrateProject(parsed);
        const result   = ProjectSchema.safeParse(migrated);
        if (!result.success) {
          const msgs = result.error.issues
            .slice(0, 5)
            .map(i => `• ${i.path.join(".")}: ${i.message}`)
            .join("\n");
          alert(`Invalid project file:\n${msgs}`);
          return;
        }
        loadProject(migrated);
      } catch {
        alert("Failed to load project: invalid JSON.");
      }
    };
    input.click();
  }

  const currentStyleSetId = activeEntity?.styleSetId ?? project.styleSets[0]?.id ?? "dark_fantasy";

  function applyStyleSetCssVars(styleSetId: string) {
    const ss = STYLE_SETS.find(s => s.id === styleSetId);
    if (!ss) return;
    const root = document.documentElement;
    root.style.setProperty("--ss-stroke-weight",  String(ss.strokeWeight));
    root.style.setProperty("--ss-shading-mode",   ss.shadingMode);
    root.style.setProperty("--ss-eye-style",       ss.eyeStyle);
    root.style.setProperty("--ss-silhouette-bias", ss.silhouetteBias);
  }

  function handleStyleSetChange(styleSetId: string) {
    setProjectStyleSet(styleSetId);
    applyStyleSetCssVars(styleSetId);
  }

  function handleBackToDashboard() {
    saveLastProjectSnapshot(project, getRecentProjectFolderPath(project.id) ?? undefined);
    setAppState("dashboard");
  }

  const styleOptions = STYLE_SETS.map(styleSet => ({
    value: styleSet.id,
    label: styleSet.label,
  }));

  return (
    <>
      <header
        data-testid="toolbar"
        className="flex items-center gap-1 px-3 min-h-11 flex-wrap py-1 bg-sidebar border-b border-sidebar-border flex-shrink-0 select-none"
      >
        {/* Logo */}
        <div className="flex items-center gap-1.5 mr-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary tracking-tight hidden sm:block">Asset Composer</span>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Project name */}
        <input
          data-testid="toolbar-project-name"
          value={project.name}
          onChange={e => setProjectName(e.target.value)}
          className="bg-transparent text-xs text-foreground font-medium w-36 outline-none border-b border-transparent hover:border-border focus:border-primary transition-colors"
        />

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          data-testid="toolbar-back-dashboard"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={handleBackToDashboard}
          title="Главное меню"
          aria-label="Главное меню"
        ><Home className="w-3.5 h-3.5" /></Button>

        {/* New Entity */}
        <Button
          data-testid="toolbar-new-entity"
          size="icon" variant="ghost"
          className="h-7 w-7 text-primary hover:bg-primary/10"
          onClick={openWizard}
          title="Создать персонажа (Ctrl+N)"
          aria-label="Создать персонажа"
        ><Plus className="w-4 h-4" /></Button>

        {/* Import SVG */}
        <Button
          data-testid="toolbar-import-svg"
          size="icon" variant="ghost"
          className="h-7 w-7 text-emerald-400 hover:bg-emerald-400/10"
          onClick={openImportWizard}
          disabled={!activeEntity}
          title="Импортировать SVG"
          aria-label="Импортировать SVG"
        ><Upload className="w-3.5 h-3.5" /></Button>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Undo / Redo */}
        <Button
          data-testid="toolbar-undo"
          size="icon" variant="ghost"
          className="h-7 w-7 disabled:opacity-30"
          onClick={undo} disabled={!canUndo}
          title="Отменить (Ctrl+Z)"
          aria-label="Отменить изменение"
        ><Undo2 className="w-3.5 h-3.5" /></Button>

        <Button
          data-testid="toolbar-redo"
          size="icon" variant="ghost"
          className="h-7 w-7 disabled:opacity-30"
          onClick={redo} disabled={!canRedo}
          title="Повторить (Ctrl+X / Ctrl+Shift+Z / Ctrl+Y)"
          aria-label="Повторить изменение"
        ><Redo2 className="w-3.5 h-3.5" /></Button>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Save / Load */}
        <Button
          data-testid="toolbar-save"
          size="icon" variant="ghost"
          className="h-7 w-7"
          onClick={handleSaveProject}
          title="Сохранить проект"
          aria-label="Сохранить проект"
        ><Save className="w-3.5 h-3.5" /></Button>

        <Button
          data-testid="toolbar-load"
          size="icon" variant="ghost"
          className="h-7 w-7"
          onClick={handleLoad}
          title="Открыть проект"
          aria-label="Открыть проект"
        ><FolderOpen className="w-3.5 h-3.5" /></Button>

        <Button data-testid="toolbar-reset-workspace" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Очистить проекты и рисунки редактора" aria-label="Очистить рабочую область" onClick={() => setResetOpen(true)}><Trash2 className="w-3.5 h-3.5" /></Button>

        <div className="flex-1" />

        {/* Style set switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground hidden md:block">Стиль</span>
          <select
            data-testid="toolbar-styleset"
            aria-label="Стиль проекта"
            value={currentStyleSetId}
            onChange={event => handleStyleSetChange(event.target.value)}
            className="h-7 w-36 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            {styleOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          data-testid="toolbar-export"
          size="sm"
          className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3"
          onClick={openExport}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Экспорт
        </Button>
      </header>
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Очистить рабочую область?</AlertDialogTitle><AlertDialogDescription>Проекты, персонажи и импортированные рисунки в памяти редактора будут удалены. Файлы на диске останутся.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction data-testid="confirm-reset-workspace" onClick={() => {
            clearProjectSessions();
            useStore.getState().newProject();
            useStore.getState().createEntity("character", "biped_profile_base_v1", "Персонаж");
          }}>Очистить</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import SVG Wizard */}
      <ImportWizard
        open={editor.isImportWizardOpen}
        onClose={closeImportWizard}
        activeEntityId={project.activeEntityId}
      />
    </>
  );
}
