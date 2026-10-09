import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { IDE } from "@/pages/IDE";
import { Dashboard } from "@/pages/Dashboard";
import { useSaveStatus, saveLocalCopy } from "@/lib/projectPersistence";

function App() {
  const appState = useStore(s => s.editor.appState);
  const saveTimerRef = useRef<number | null>(null);
  const lastQueuedProjectRef = useRef<{ id: string; updatedAt: number } | null>(null);

  useEffect(()=>{const handler=(event:Event)=>toast.error("Проект не сохранён: "+(event as CustomEvent).detail);window.addEventListener("project-save-error",handler);return ()=>window.removeEventListener("project-save-error",handler);},[]);
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state) => {
      if (state.editor.appState !== "ide") {
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        lastQueuedProjectRef.current = null; return;
      }
      const currentStamp = { id: state.project.id, updatedAt: state.project.updatedAt };
      if (
        lastQueuedProjectRef.current &&
        lastQueuedProjectRef.current.id === currentStamp.id &&
        lastQueuedProjectRef.current.updatedAt === currentStamp.updatedAt
      ) {
        return;
      }
      lastQueuedProjectRef.current = currentStamp;
      const switchedProject = useSaveStatus.getState().projectId !== state.project.id;
      useSaveStatus.setState({ status: "dirty", projectId: state.project.id, ...(switchedProject ? { error: null, localRevision: null, fileRevision: null, fileDestination: null } : {}) });
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      const snapshot = state.project;
      saveTimerRef.current = window.setTimeout(() => {
        void saveLocalCopy(snapshot);
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
