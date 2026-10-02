import { useRef } from "react";
import { useStore } from "@/store";
import { ProjectSchema } from "@/domain/schema";
import { migrateProject } from "@/lib/projectMigration";
import {
  getLastProjectSnapshotName,
  getRecentProjectFolderPath,
  getRecentProjectSessions,
  loadProjectSession,
  restoreLastProjectSnapshot,
  saveLastProjectSnapshot,
} from "@/lib/projectSession";
import { Layers, FolderOpen, Plus, FolderPlus } from "lucide-react";

export function Dashboard() {
  const newProject = useStore(s => s.newProject);
  const openWizard = useStore(s => s.openWizard);
  const loadProject = useStore(s => s.loadProject);
  const setProjectName = useStore(s => s.setProjectName);
  const fileRef = useRef<HTMLInputElement>(null);
  const recentProjects = getRecentProjectSessions();
  const lastProjectName = getLastProjectSnapshotName();

  function handleNew() {
    newProject();
    openWizard();
  }

  function handleLoad() {
    fileRef.current?.click();
  }

  function handleContinueLastSession() {
    const restored = restoreLastProjectSnapshot();
    if (!restored) {
      alert("No saved session was found.");
      return;
    }
    loadProject(restored);
    saveLastProjectSnapshot(restored);
  }


  function handleOpenRecentProject(projectId: string) {
    const folderPath = getRecentProjectFolderPath(projectId);
    if (folderPath && window.assetComposerProjects) {
      window.assetComposerProjects.readProjectFromFolder(folderPath).then(result => {
        if (!result) {
          alert("That project folder could not be read.");
          return;
        }
        const migrated = migrateProject(result.project);
        const parsed = ProjectSchema.safeParse(migrated);
        if (!parsed.success) {
          alert("That project folder contains invalid data.");
          return;
        }
        loadProject(parsed.data);
        saveLastProjectSnapshot(parsed.data, folderPath);
      });
      return;
    }

    const restored = loadProjectSession(projectId);
    if (!restored) {
      alert("That project is no longer available.");
      return;
    }
    loadProject(restored);
    saveLastProjectSnapshot(restored);
  }

  async function handleCreateProjectFolder() {
    const projectName = window.prompt("Project name", "New Project")?.trim();
    if (!projectName) return;
    const folderResult = await window.assetComposerProjects?.pickProjectFolder();
    if (!folderResult) return;

    newProject();
    setProjectName(projectName);

    const project = useStore.getState().project;
    const saved = await window.assetComposerProjects?.saveProjectToFolder(folderResult.folderPath, project);
    if (!saved) {
      alert("Could not create the project folder.");
      return;
    }

    saveLastProjectSnapshot(project, folderResult.folderPath);
    loadProject(project);
  }

  async function handleOpenProjectFolder() {
    const folderResult = await window.assetComposerProjects?.pickProjectFolder();
    if (!folderResult) return;
    const loaded = await window.assetComposerProjects?.readProjectFromFolder(folderResult.folderPath);
    if (!loaded) {
      alert("Could not open a project.json in that folder.");
      return;
    }
    const migrated = migrateProject(loaded.project);
    const parsed = ProjectSchema.safeParse(migrated);
    if (!parsed.success) {
      alert("Project data in that folder is invalid.");
      return;
    }
    loadProject(parsed.data);
    saveLastProjectSnapshot(parsed.data, folderResult.folderPath);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const migrated = migrateProject(parsed);
      const result = ProjectSchema.safeParse(migrated);
      if (!result.success) {
        const msgs = result.error.issues
          .slice(0, 5)
          .map(i => `• ${i.path.join(".")}: ${i.message}`)
          .join("\n");
        alert(`Invalid project file:\n${msgs}`);
        return;
      }
      loadProject(result.data as Parameters<typeof loadProject>[0]);
    } catch {
      alert("Failed to load project: invalid JSON.");
    }
    e.target.value = "";
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-6 sm:p-12">
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-3 pb-6 border-b border-border">
          <Layers className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold">Character Studio</h1>
        </header>
        <div className="flex flex-wrap items-center gap-3 py-6">
          <button data-testid="dashboard-new" onClick={handleNew} className="flex items-center gap-2 px-4 h-10 rounded bg-primary text-primary-foreground text-sm"><Plus size={16} /> Новый проект</button>
          <button data-testid="dashboard-load" onClick={handleLoad} className="flex items-center gap-2 px-4 h-10 rounded border border-border text-sm hover:bg-accent"><FolderOpen size={16} /> Открыть JSON</button>
          {lastProjectName && <button data-testid="dashboard-continue-last" onClick={handleContinueLastSession} className="text-sm text-primary px-2 h-10">Продолжить: {lastProjectName}</button>}
        </div>
        {window.assetComposerProjects && <div className="flex flex-wrap gap-4 pb-6">
          <button data-testid="dashboard-create-folder" onClick={handleCreateProjectFolder} className="flex items-center gap-2 text-sm text-muted-foreground"><FolderPlus size={16} /> Создать папку проекта</button>
          <button data-testid="dashboard-open-folder" onClick={handleOpenProjectFolder} className="flex items-center gap-2 text-sm text-muted-foreground"><FolderOpen size={16} /> Открыть папку</button>
        </div>}
        <section className="border-t border-border">
          <h2 className="text-sm font-medium py-4">Последние проекты</h2>
          {recentProjects.length === 0 && <p className="text-sm text-muted-foreground py-4">Нет сохранённых проектов</p>}
          {recentProjects.map(project => <button key={project.id} data-testid={`dashboard-recent-${project.id}`} onClick={() => handleOpenRecentProject(project.id)} className="w-full flex items-center justify-between gap-4 px-2 py-4 border-b border-border hover:bg-accent/30 text-left">
            <span className="text-sm min-w-0 break-words">{project.name}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(project.updatedAt).toLocaleDateString()}</span>
          </button>)}
        </section>
      </div>
    </main>
  );
}
