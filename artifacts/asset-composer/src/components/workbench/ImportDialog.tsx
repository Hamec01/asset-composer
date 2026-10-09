import { useState } from "react";
import { useStore } from "@/store";
import { useWorkbench } from "@/store/workbench";
import { assetDocument } from "@/lib/assetCatalog";
import { importArtwork } from "@/lib/artworkImport";
import { ImportWizard } from "@/components/wizard/ImportWizard";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ImportDialog() {
  const open = useStore(s => s.editor.isImportWizardOpen), project = useStore(s => s.project);
  const ref = useWorkbench(s => s.activeAsset), screen = useWorkbench(s => s.screen);
  const selectedDoc = project.editorMeta.spriteEditorDocuments.find(d => d.id === project.editorMeta.activeSpriteDocumentId);
  const ownsSelectedDoc = ref && selectedDoc && (ref.kind === "artwork" ? selectedDoc.id === ref.id : ref.kind === "entity" ? selectedDoc.target.entityId === ref.id : selectedDoc.target.itemId === ref.id || project.items.find(i => i.id === ref.id)?.parts?.some(p => p.editorDocumentId === selectedDoc.id));
  const doc = ref && screen === "editor" ? ownsSelectedDoc ? selectedDoc : assetDocument(project, ref) : undefined;
  const [destination, setDestination] = useState("new"), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const close = () => { useStore.getState().closeImportWizard(); setAdvanced(false); setError(""); };
  if (advanced) return <ImportWizard open={open} onClose={close} activeEntityId={project.activeEntityId} />;
  return <Dialog open={open} onOpenChange={v => { if (!v && !busy) close(); }}><DialogContent><DialogTitle>Импортировать изображение</DialogTitle><DialogDescription>SVG, PNG, WebP и JPEG. Подложка помогает обводить изображение и не входит в экспорт.</DialogDescription>
    <label className="field-label">Куда добавить<select value={destination} onChange={e => setDestination(e.target.value)}><option value="new">Новый самостоятельный рисунок</option>{doc && <><option value="layer">Новый слой: {doc.name}</option><option value="guide">Подложка: {doc.name}</option></>}</select></label>
    <label className="field-label">Файл изображения<input aria-label="Файл изображения" type="file" accept=".svg,.png,.webp,.jpg,.jpeg" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setBusy(true); setError(""); try { await importArtwork(file, destination === "new" ? undefined : doc?.id, destination === "guide"); close(); } catch (e) { setError(e instanceof Error ? e.message : "Не удалось импортировать изображение."); } finally { setBusy(false); } }} /></label>
    {busy && <p role="status">Открываем изображение…</p>}{error && <p role="alert" className="workbench-error">{error} Выберите файл ещё раз.</p>}
    {project.activeEntityId && <details><summary>Дополнительно: привязать к персонажу</summary><p className="context-note">Импорт готовой части тела или предмета с выбором кости, точки опоры и крепления.</p><button className="action-secondary" onClick={() => setAdvanced(true)}>Часть персонажа или экипировка</button></details>}
    <button className="text-primary text-left" onClick={() => useWorkbench.setState({ helpTopic: "draw" })}>Инструкция по импорту и подложкам →</button>
  </DialogContent></Dialog>;
}
