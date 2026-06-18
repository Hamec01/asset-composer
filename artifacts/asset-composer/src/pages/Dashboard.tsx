import { useRef } from "react";
import { useStore } from "@/store";
import { ProjectSchema } from "@/domain/schema";
import { migrateProject } from "@/lib/projectMigration";
import { getLastProjectSnapshotName, restoreLastProjectSnapshot } from "@/lib/projectSession";
import { Layers, FolderOpen, Plus, Sparkles, Swords, TreePine, Box } from "lucide-react";

export function Dashboard() {
  const newProject = useStore(s => s.newProject);
  const openWizard = useStore(s => s.openWizard);
  const loadProject = useStore(s => s.loadProject);
  const fileRef = useRef<HTMLInputElement>(null);
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground select-none">
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hero */}
      <div className="flex flex-col items-center gap-3 mb-12">
        <div className="flex items-center gap-2.5">
          <Layers className="w-10 h-10 text-primary" />
          <span className="text-4xl font-bold tracking-tight text-foreground">
            Asset Composer
          </span>
        </div>
        <p className="text-muted-foreground text-sm max-w-xs text-center">
          Build characters, creatures, and items for your indie game — then export sprite sheets ready for any engine.
        </p>
      </div>

      {/* Main actions */}
      <div className="flex gap-4 mb-16">
        {lastProjectName && (
          <button
            data-testid="dashboard-continue-last"
            onClick={handleContinueLastSession}
            className="flex flex-col items-center gap-3 px-10 py-8 rounded-xl border-2 border-emerald-500/35 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-400 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-lg bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
              <Layers className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-center max-w-[160px]">
              <div className="text-sm font-semibold text-foreground">Continue Last Session</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{lastProjectName}</div>
            </div>
          </button>
        )}

        <button
          data-testid="dashboard-new"
          onClick={handleNew}
          className="flex flex-col items-center gap-3 px-10 py-8 rounded-xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-foreground">New Project</div>
            <div className="text-xs text-muted-foreground mt-0.5">Start from a template</div>
          </div>
        </button>

        <button
          data-testid="dashboard-load"
          onClick={handleLoad}
          className="flex flex-col items-center gap-3 px-10 py-8 rounded-xl border-2 border-border bg-card hover:bg-card/80 hover:border-foreground/30 transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center group-hover:bg-muted/70 transition-colors">
            <FolderOpen className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-foreground">Load Project</div>
            <div className="text-xs text-muted-foreground mt-0.5">Open a .json file</div>
          </div>
        </button>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-3 gap-4 max-w-lg w-full px-4">
        {[
          { icon: Sparkles, label: "Palette Theming", desc: "Swap colors across your entire entity in one click" },
          { icon: Swords, label: "Slot Equipment", desc: "Mix and match weapons, armor, and accessories" },
          { icon: TreePine, label: "Bone Rigging", desc: "Skeleton-based animations with keyframe timeline" },
          { icon: Box, label: "Sprite Export", desc: "PNG sheets, WebP, and SVG parts for any engine" },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex flex-col gap-1.5 p-3 rounded-lg bg-card border border-border">
            <Icon className="w-4 h-4 text-primary" />
            <div className="text-xs font-semibold text-foreground">{label}</div>
            <div className="text-xs text-muted-foreground leading-tight">{desc}</div>
          </div>
        ))}
      </div>

      <p className="mt-12 text-xs text-muted-foreground/50">
        100% client-side · no data leaves your browser
      </p>
    </div>
  );
}
