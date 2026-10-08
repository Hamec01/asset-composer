import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { IDE } from "@/pages/IDE";
import { Dashboard } from "@/pages/Dashboard";
import { saveLastProjectSnapshot } from "@/lib/projectSession";

function App() {
  const appState = useStore(s => s.editor.appState);
  const saveTimerRef = useRef<number | null>(null);
  const lastQueuedProjectRef = useRef<{ id: string; updatedAt: number } | null>(null);

  useEffect(()=>{const handler=(event:Event)=>toast.error("Project was not saved: "+(event as CustomEvent).detail);window.addEventListener("project-save-error",handler);return ()=>window.removeEventListener("project-save-error",handler);},[]);
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state) => {
      if (state.editor.appState !== "ide") return;
      const currentStamp = { id: state.project.id, updatedAt: state.project.updatedAt };
      if (
        lastQueuedProjectRef.current &&
        lastQueuedProjectRef.current.id === currentStamp.id &&
        lastQueuedProjectRef.current.updatedAt === currentStamp.updatedAt
      ) {
        return;
      }
      lastQueuedProjectRef.current = currentStamp;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      const snapshot = state.project;
      saveTimerRef.current = window.setTimeout(() => {
        saveLastProjectSnapshot(snapshot);
      }, 400);
    });

    return () => {
      unsubscribe();
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return appState === "ide" ? <IDE /> : <Dashboard />;
}

export default App;
