import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { cleanupLegacyPwaArtifacts } from "./lib/legacyPwaCleanup";
import { RuntimeErrorBoundary } from "./components/debug/RuntimeErrorBoundary";
import { useStore } from "./store";
import { restoreLastProjectSnapshot, saveLastProjectSnapshot } from "./lib/projectSession";

void cleanupLegacyPwaArtifacts();
const lastProject = restoreLastProjectSnapshot();
if (lastProject) {
  useStore.getState().loadProject(lastProject);
} else {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "biped_profile_base_v1", "Персонаж");
  saveLastProjectSnapshot(useStore.getState().project);
}
useStore.getState().setPlaybackPlaying(false);
createRoot(document.getElementById("root")!).render(
  <RuntimeErrorBoundary>
    <App />
  </RuntimeErrorBoundary>,
);
