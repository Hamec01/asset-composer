import { useStore } from "@/store";
import { ProjectSchema } from "@/domain/schema";
import { Button } from "@/components/ui/button";
import { STYLE_SETS } from "@/data/styleSets";
import { migrateProject } from "@/lib/projectMigration";
import { triggerDownload } from "@/lib/download";
import { getRecentProjectFolderPath, saveLastProjectSnapshot } from "@/lib/projectSession";
import {
  Plus, Save, FolderOpen, Undo2, Redo2, Download, Layers, Upload, Home,
} from "lucide-react";
import { ImportWizard } from "@/components/wizard/ImportWizard";

export function Toolbar() {
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
        .map(i => `вЂў ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      alert(`Cannot save вЂ” project has validation errors:\n${msgs}`);
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

  function handleSave() {
    const result = ProjectSchema.safeParse(project);
    if (!result.success) {
      const msgs = result.error.issues
        .slice(0, 5)
        .map(i => `• ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      alert(`Cannot save — project has validation errors:\n${msgs}`);
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
        className="flex items-center gap-2 px-3 h-10 bg-sidebar border-b border-sidebar-border flex-shrink-0 select-none"
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
          title="Back to Main Menu"
        ><Home className="w-3.5 h-3.5" /></Button>

        {/* New Entity */}
        <Button
          data-testid="toolbar-new-entity"
          size="icon" variant="ghost"
          className="h-7 w-7 text-primary hover:bg-primary/10"
          onClick={openWizard}
          title="New Entity (Ctrl+N)"
        ><Plus className="w-4 h-4" /></Button>

        {/* Import SVG */}
        <Button
          data-testid="toolbar-import-svg"
          size="icon" variant="ghost"
          className="h-7 w-7 text-emerald-400 hover:bg-emerald-400/10"
          onClick={openImportWizard}
          disabled={!activeEntity}
          title="Import SVG Asset"
        ><Upload className="w-3.5 h-3.5" /></Button>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Undo / Redo */}
        <Button
          data-testid="toolbar-undo"
          size="icon" variant="ghost"
          className="h-7 w-7 disabled:opacity-30"
          onClick={undo} disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        ><Undo2 className="w-3.5 h-3.5" /></Button>

        <Button
          data-testid="toolbar-redo"
          size="icon" variant="ghost"
          className="h-7 w-7 disabled:opacity-30"
          onClick={redo} disabled={!canRedo}
          title="Redo (Ctrl+X / Ctrl+Shift+Z / Ctrl+Y)"
        ><Redo2 className="w-3.5 h-3.5" /></Button>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Save / Load */}
        <Button
          data-testid="toolbar-save"
          size="icon" variant="ghost"
          className="h-7 w-7"
          onClick={handleSaveProject}
          title="Save Project"
        ><Save className="w-3.5 h-3.5" /></Button>

        <Button
          data-testid="toolbar-load"
          size="icon" variant="ghost"
          className="h-7 w-7"
          onClick={handleLoad}
          title="Load Project"
        ><FolderOpen className="w-3.5 h-3.5" /></Button>

        <div className="flex-1" />

        {/* Style set switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground hidden md:block">Style</span>
          <select
            data-testid="toolbar-styleset"
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
          Export
        </Button>
      </header>

      {/* Import SVG Wizard */}
      <ImportWizard
        open={editor.isImportWizardOpen}
        onClose={closeImportWizard}
        activeEntityId={project.activeEntityId}
      />
    </>
  );
}
