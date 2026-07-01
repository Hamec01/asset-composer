import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { cleanupLegacyPwaArtifacts } from "./lib/legacyPwaCleanup";
import { RuntimeErrorBoundary } from "./components/debug/RuntimeErrorBoundary";

void cleanupLegacyPwaArtifacts();
createRoot(document.getElementById("root")!).render(
  <RuntimeErrorBoundary>
    <App />
  </RuntimeErrorBoundary>,
);
