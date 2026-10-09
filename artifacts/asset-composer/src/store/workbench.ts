import { create } from "zustand";
import type { AssetCategory, AssetRef, WorkspaceId } from "@/lib/assetCatalog";

interface WorkbenchState {
  screen: "library" | "editor";
  activeAsset: AssetRef | null;
  workspace: WorkspaceId;
  contexts: Record<string, { workspace: WorkspaceId; timeMs: number; clipId: string | null; documentId?: string | null; entityId?: string | null }>;
  createCategory: AssetCategory | null;
  helpTopic: string | null;
  settingsOpen: boolean;
  chibiPackOpen: boolean;
  libraryCategory: AssetCategory | "all";
}
export const useWorkbench = create<WorkbenchState>(() => ({
  screen: "library", activeAsset: null, workspace: "appearance", contexts: {},
  createCategory: null, helpTopic: null, settingsOpen: false, chibiPackOpen: false, libraryCategory: "all",
}));
