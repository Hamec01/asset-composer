import { useStore } from "@/store";
import { useWorkbench } from "@/store/workbench";
import { assetDocument, assetKey, assetWorkspaces, buildAssetCatalog, type AssetCategory, type AssetRef, type WorkspaceId } from "./assetCatalog";
import { animController } from "@/core-v2/AnimationController";
import { saveLocalCopy } from "./projectPersistence";
import { createDocumentFromEntityVisual } from "./spriteEditor";
import { newStudioDocument, newStudioLayer, studioCommit, newId } from "./studioActions";

export function openAsset(ref: AssetRef, requestedWorkspace?: WorkspaceId) {
  const store = useStore.getState(), ui = useWorkbench.getState();
  const entry = buildAssetCatalog(store.project).find(e => assetKey(e.ref) === assetKey(ref));
  if (!entry) return;
  const contexts = { ...ui.contexts };
  if (ui.activeAsset) contexts[assetKey(ui.activeAsset)] = { workspace: ui.workspace,
    timeMs: store.animPlayback.timeMs, clipId: store.animPlayback.activeClipId,
    documentId: store.project.editorMeta.activeSpriteDocumentId, entityId: store.project.activeEntityId };
  const previous = contexts[assetKey(ref)];
  const allowed = assetWorkspaces(entry);
  const desired = requestedWorkspace ?? previous?.workspace;
  const workspace = desired && allowed.includes(desired) ? desired : allowed[0];
  if (ref.kind === "item" && !assetDocument(store.project, ref)) store.openItemForEditing(ref.id);
  if (ref.kind === "entity" && entry.category === "environment" && !assetDocument(store.project, ref) && ["draw", "rig"].includes(workspace)) {
    studioCommit("Подготовить рисунок объекта", p => {
      const owner = p.entities.find(e => e.id === ref.id)!;
      const visual = owner.visuals?.[0];
      if (visual) {
        const document = createDocumentFromEntityVisual(owner.id, visual);
        document.studioArtwork = true;
        p.editorMeta.spriteEditorDocuments.push(document);
        visual.content = { kind: "document", documentId: document.id }; visual.editorDocumentId = document.id;
      } else {
        const document = newStudioDocument();
        document.name = owner.name; document.layers.push(newStudioLayer("vector"));
        const id = newId(); document.target = { kind: "entity-visual", entityId: owner.id, visualId: id };
        owner.visuals ??= [];
        owner.visuals.push({ id, boneId: p.templates.find(t => t.id === owner.templateId)?.bones[0]?.id ?? "root",
          content: { kind: "document", documentId: document.id }, editorDocumentId: document.id,
          metrics: { viewBoxX: 0, viewBoxY: 0, viewBoxWidth: document.width, viewBoxHeight: document.height, visualMinX: 0, visualMinY: 0, visualWidth: document.width, visualHeight: document.height },
          pivot: { x: 0, y: 0, preset: "custom" }, localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, zIndex: 0 });
        p.editorMeta.spriteEditorDocuments.push(document);
      }
    });
  }
  const ownedDoc = assetDocument(useStore.getState().project, ref);
  const restoredDoc = previous?.documentId && useStore.getState().project.editorMeta.spriteEditorDocuments.find(d => d.id === previous.documentId && d.target.entityId === ref.id);
  const doc = ref.kind === "entity" && restoredDoc ? restoredDoc : ownedDoc;
  let entityId = ref.kind === "entity" ? ref.id : doc?.studioEntityId ?? doc?.target.entityId ?? null;
  if (ref.kind === "item" && !doc?.studioEntityId) {
    const current = entry.category === "equipment" && store.project.entities.find(e => e.id === (previous?.entityId ?? store.project.activeEntityId) && e.entityType === "character");
    entityId = current ? current.id : entry.category === "equipment" ? store.project.entities.find(e => e.slots.some(s => s.itemId === ref.id))?.id ?? null : null;
  }
  const entity = useStore.getState().project.entities.find(e => e.id === entityId);
  animController.pause();
  useStore.setState(s => {
    s.editor.appState = "ide";
    s.project.activeEntityId = entityId;
    s.project.editorMeta.activeSpriteDocumentId = doc?.id ?? (workspace === "parts" ? previous?.documentId : null);
    s.project.editorMeta.activeAuthoringMode = ["draw", "rig"].includes(workspace) ? "sprite-editor" : null;
    s.editor.selection = { kind: "none" };
    s.editor.selectedSlotId = null;
    s.editor.fitAuthoring = null;
    s.editor.canvasMode = "select";
    s.animPlayback.playing = false;
    const previousClip = s.project.animationClips.find(c => c.id === previous?.clipId && c.templateId === entity?.templateId);
    s.animPlayback.activeClipId = previousClip?.id ?? entity?.activeAnimationClipId ?? null;
    s.animPlayback.timeMs = previous?.timeMs ?? 0;
    s.animPlayback.activeTab = "timeline";
  });
  useWorkbench.setState({ screen: "editor", activeAsset: ref, workspace, contexts });
  const clip = useStore.getState().project.animationClips.find(c => c.id === useStore.getState().animPlayback.activeClipId);
  animController.setDuration(clip?.durationMs ?? 1000);
  animController.setLoop(clip?.loops ?? true);
  store.setPlaybackTime(previous?.timeMs ?? 0);
}
export function switchWorkspace(workspace: WorkspaceId) {
  const ref = useWorkbench.getState().activeAsset;
  if (ref) openAsset(ref, workspace);
}
export function showLibrary(category: AssetCategory | "all" = "all") {
  animController.pause();
  useStore.getState().setPlaybackPlaying(false);
  useStore.getState().setAppState("ide");
  useWorkbench.setState({ screen: "library", libraryCategory: category });
}
export function beginCreation(category: AssetCategory | null = null, newProject = false) {
  if (newProject) { void saveLocalCopy(); useStore.getState().newProject(); useWorkbench.setState({ activeAsset: null, contexts: {}, screen: "library" }); }
  useWorkbench.setState({ createCategory: category });
  useStore.getState().setAppState("ide");
  useStore.getState().openWizard();
}
export function resumeProject() {
  const project = useStore.getState().project;
  const catalog = buildAssetCatalog(project);
  const active = catalog.find(e => e.documentId === project.editorMeta.activeSpriteDocumentId)
    ?? catalog.find(e => e.ref.kind === "entity" && e.ref.id === project.activeEntityId)
    ?? catalog.find(e => !e.builtIn);
  useWorkbench.setState({ activeAsset: null, contexts: {} });
  if (active) openAsset(active.ref); else showLibrary();
}
