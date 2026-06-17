import { useStore } from "@/store";
import { IDE } from "@/pages/IDE";
import { Dashboard } from "@/pages/Dashboard";

function App() {
  const appState = useStore(s => s.editor.appState);
  return appState === "ide" ? <IDE /> : <Dashboard />;
}

export default App;
