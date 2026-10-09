import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./workbench.css";
import { cleanupLegacyPwaArtifacts } from "./lib/legacyPwaCleanup";
import { RuntimeErrorBoundary } from "./components/debug/RuntimeErrorBoundary";
import { useStore } from "./store";
import { useSaveStatus } from "./lib/projectPersistence";
import {
  restoreLastProjectSnapshot,
  initializeProjectSessions,
} from "./lib/projectSession";

void cleanupLegacyPwaArtifacts();
async function boot() {
  await initializeProjectSessions();
  const lastProject = restoreLastProjectSnapshot();
  const store = useStore.getState();
  if (lastProject) {
    store.loadProject(lastProject);
    const restored = useStore.getState().project;
    useSaveStatus.setState({ status: "saved", projectId: restored.id, localRevision: restored.updatedAt });
  }
  // Opening the app never creates or replaces user content.
  useStore.getState().setAppState("dashboard");
  useStore.getState().setPlaybackPlaying(false);
  (window as any).__STORE__ = useStore;
  createRoot(document.getElementById("root")!).render(
    <RuntimeErrorBoundary>
      <App />
    </RuntimeErrorBoundary>,
  );
}

void boot();
