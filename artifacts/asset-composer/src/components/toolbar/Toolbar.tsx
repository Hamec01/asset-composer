import { useStore } from "@/store";
import { ProjectSchema } from "@/domain/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STYLE_SETS } from "@/data/styleSets";
import { migrateProject } from "@/lib/projectMigration";
import {
  Plus, Save, FolderOpen, Undo2, Redo2, Download, Layers, Upload,
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
  const getActiveEntity   = useStore(s => s.getActiveEntity);
  const loadProject       = useStore(s => s.loadProject);

  const activeEntity = getActiveEntity();
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

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
    const blob = new Blob([data], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${project.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

        {/* New Entity */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="toolbar-new-entity"
              size="icon" variant="ghost"
              className="h-7 w-7 text-primary hover:bg-primary/10"
              onClick={openWizard}
            ><Plus className="w-4 h-4" /></Button>
          </TooltipTrigger>
          <TooltipContent>New Entity (Ctrl+N)</TooltipContent>
        </Tooltip>

        {/* Import SVG */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="toolbar-import-svg"
              size="icon" variant="ghost"
              className="h-7 w-7 text-emerald-400 hover:bg-emerald-400/10"
              onClick={openImportWizard}
              disabled={!activeEntity}
            ><Upload className="w-3.5 h-3.5" /></Button>
          </TooltipTrigger>
          <TooltipContent>Import SVG Asset</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Undo / Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="toolbar-undo"
              size="icon" variant="ghost"
              className="h-7 w-7 disabled:opacity-30"
              onClick={undo} disabled={!canUndo}
            ><Undo2 className="w-3.5 h-3.5" /></Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="toolbar-redo"
              size="icon" variant="ghost"
              className="h-7 w-7 disabled:opacity-30"
              onClick={redo} disabled={!canRedo}
            ><Redo2 className="w-3.5 h-3.5" /></Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Save / Load */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="toolbar-save"
              size="icon" variant="ghost"
              className="h-7 w-7"
              onClick={handleSave}
            ><Save className="w-3.5 h-3.5" /></Button>
          </TooltipTrigger>
          <TooltipContent>Save Project</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-testid="toolbar-load"
              size="icon" variant="ghost"
              className="h-7 w-7"
              onClick={handleLoad}
            ><FolderOpen className="w-3.5 h-3.5" /></Button>
          </TooltipTrigger>
          <TooltipContent>Load Project</TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        {/* Style set switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground hidden md:block">Style</span>
          <Select value={currentStyleSetId} onValueChange={handleStyleSetChange}>
            <SelectTrigger
              data-testid="toolbar-styleset"
              className="h-7 text-xs bg-background border-border w-36"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground text-xs">
              {STYLE_SETS.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
