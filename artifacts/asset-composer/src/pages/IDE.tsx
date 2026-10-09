import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store";
import { useWorkbench } from "@/store/workbench";
import { assetDocument, assetKey, assetWorkspaces, buildAssetCatalog, CATEGORY_LABELS, WORKSPACE_LABELS, type AssetRef } from "@/lib/assetCatalog";
import { openAsset, resumeProject, showLibrary, switchWorkspace } from "@/lib/assetNavigation";
import { WorkbenchShell } from "@/components/workbench/WorkbenchShell";
import { AssetLibrary } from "@/components/workbench/AssetLibrary";
import { EquipmentFit } from "@/components/workbench/EquipmentFit";
import { AppearancePanel } from "@/components/panels/AppearancePanel";
import { CharacterPartsPanel } from "@/components/panels/CharacterPartsPanel";
import { LibraryPanel } from "@/components/panels/LibraryPanel";
import { InspectorPanel } from "@/components/panels/InspectorPanel";
import { CanvasPanel } from "@/components/panels/CanvasPanel";
import { PixiPreviewPanel } from "@/components/panels/PixiPreviewPanel";
import { TimelinePanel } from "@/components/panels/TimelinePanel";
import { StateMachinePanel } from "@/components/panels/StateMachinePanel";
import { AuthoringPanel } from "@/components/panels/AuthoringPanel";
import { ArtStudioPanel } from "@/components/studio/ArtStudioPanel";
import { VisualThumbnail } from "@/components/VisualThumbnail";
import { useEditorShortcuts } from "@/features/shortcuts/useEditorShortcuts";
import { ArrowLeft, CircleHelp, PanelLeft, SlidersHorizontal, ChevronDown } from "lucide-react";
import { studioCommit } from "@/lib/studioActions";

const HINTS = {
  appearance: "Настройте тело, лицо и волосы. Изменения сразу видны на персонаже.",
  parts: "Выберите часть тела и нажмите карандаш, чтобы нарисовать её. Рисунок остаётся связан со своей костью.",
  equipment: "Выберите место крепления и совместимый предмет. Подгонка и свойства выбранного предмета находятся справа.",
  draw: "Выберите слой: растровый для кисти, векторный для фигур. Импорт рисунка и подложка — разные действия.",
  fit: "Выберите персонажа и крепление, наденьте предмет. Положение и масштаб настраиваются в свойствах.",
  rig: "Настройте исходный скелет и привязки. Для изгиба рисунка нужны сетка, веса и несколько влияющих костей.",
  animate: "Выберите клип и время. Исходное положение кости и анимационная поза редактируются раздельно.",
  preview: "Проверьте результат перед экспортом. Предпросмотр использует ту же сцену, что и экспорт.",
};

function ContextProperties({ refValue }: { refValue: AssetRef }) {
  const project = useStore(s => s.project), selection = useStore(s => s.editor.selection);
  const entry = buildAssetCatalog(project).find(e => assetKey(e.ref) === assetKey(refValue));
  if (!entry) return null;
  return <><div className="panel-heading">Свойства объекта</div>{selection.kind !== "none" ? <InspectorPanel contextual /> : <div className="p-4 space-y-4">
    <label className="field-label">Название<input key={assetKey(refValue)} defaultValue={entry.name} onBlur={e => {
      const name = e.target.value.trim(); if (!name || name === entry.name) return;
      if (refValue.kind === "entity") useStore.getState().renameEntity(refValue.id, name);
      else studioCommit("Переименовать объект", p => { if (refValue.kind === "item") { const item = p.items.find(i => i.id === refValue.id); if (item) item.name = name; } else { const doc = p.editorMeta.spriteEditorDocuments.find(d => d.id === refValue.id); if (doc) { doc.name = name; const entity = p.entities.find(e => e.id === doc.studioEntityId); if (entity) entity.name = name; } } });
    }} /></label><p className="context-note">{CATEGORY_LABELS[entry.category]}. Выберите элемент на холсте, чтобы изменить его свойства.</p>
    <details className="advanced-properties"><summary>Дополнительно: параметры и диагностика</summary><InspectorPanel /></details>
  </div>}</>;
}
export function IDE() {
  useEditorShortcuts();
  const project = useStore(s => s.project);
  const authoringMode = useStore(s => s.project.editorMeta.activeAuthoringMode);
  const activeDocumentId = useStore(s => s.project.editorMeta.activeSpriteDocumentId);
  const ui = useWorkbench();
  const [leftOpen, setLeftOpen] = useState(false), [rightOpen, setRightOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [vectorTools, setVectorTools] = useState(false);
  const [bottom, setBottom] = useState<"timeline" | "states" | "none">("timeline");
  const catalog = useMemo(() => buildAssetCatalog(project), [project]);
  const entry = ui.activeAsset && catalog.find(e => assetKey(e.ref) === assetKey(ui.activeAsset!));
  const doc = project.editorMeta.spriteEditorDocuments.find(d => d.id === activeDocumentId);
  // Existing tools can open an item or a character part directly. Reflect their target in the shared navigation.
  useEffect(() => {
    const state = useWorkbench.getState();
    if (state.screen !== "editor") return;
    if (!state.activeAsset) { resumeProject(); return; }
    if (authoringMode === "sprite-editor" && doc) {
      const item = project.items.find(i => i.id === doc.target.itemId || i.parts?.some(p => p.editorDocumentId === doc.id));
      const target: AssetRef = item ? { kind: "item", id: item.id } : doc.studioEntityId || !doc.target.entityId ? { kind: "artwork", id: doc.id } : { kind: "entity", id: doc.target.entityId };
      if (assetKey(target) !== assetKey(state.activeAsset)) openAsset(target, target.kind === "entity" ? "parts" : "draw");
    }
  }, [activeDocumentId, authoringMode]);
  useEffect(() => { setVectorTools(false); setLeftOpen(false); setRightOpen(false); }, [ui.activeAsset?.id, ui.workspace]);
  useEffect(() => {
    if (ui.screen === "editor" && !entry && !useStore.getState().editor.isWizardOpen) resumeProject();
  }, [ui.screen, !!entry, project.id]);
  const currentDoc = entry ? assetDocument(project, entry.ref) : undefined;
  const partsDoc = doc?.target.entityId === entry?.ref.id ? doc : undefined;
  const studio = !!entry && ((entry.ref.kind !== "entity" || entry.category === "environment") && ["draw", "rig", "animate"].includes(ui.workspace) || ui.workspace === "parts" && !!partsDoc);
  const selectedDoc = entry?.ref.kind === "entity" && entry.category === "character" ? partsDoc : currentDoc;
  const hasEntity = project.entities.some(e => e.id === project.activeEntityId);
  const legacyTarget = !!selectedDoc;
  return <WorkbenchShell>{ui.screen === "library" || !entry ? <AssetLibrary /> : <div className="editor-page" data-testid="ide-shell">
    <header className="editor-heading"><button className="action-icon" aria-label="Вернуться в библиотеку" onClick={() => showLibrary(entry.category)}><ArrowLeft size={18} /></button><div><h1>{entry.name}</h1><small>{CATEGORY_LABELS[entry.category]}{entry.builtIn ? " · готовый каталог" : " · в проекте"}</small></div><button className="action-secondary ml-auto" onClick={() => useWorkbench.setState({ helpTopic: ui.workspace })}><CircleHelp size={16} /> Как работать</button></header>
    <nav className="workspace-tabs" aria-label="Рабочие разделы">{assetWorkspaces(entry).map(workspace => <button key={workspace} data-testid={`workspace-${workspace === "appearance" ? "character" : workspace}`} aria-pressed={ui.workspace === workspace} onClick={() => switchWorkspace(workspace)}>{WORKSPACE_LABELS[workspace]}</button>)}</nav>
    <div className="workspace-hint">{HINTS[ui.workspace]}<button onClick={() => useWorkbench.setState({ helpTopic: ui.workspace })}>Инструкция →</button></div>
    {studio ? <div className="editor-center">
      {entry.ref.kind === "entity" && <div className="parts-picker"><button className="action-secondary" onClick={() => setPartsOpen(!partsOpen)}>{partsOpen ? "Закрыть список частей" : "Выбрать другую часть"}</button>{partsOpen && <div className="parts-picker-panel"><CharacterPartsPanel /></div>}</div>}
      {vectorTools && legacyTarget ? <><div className="vector-tools-header"><button className="action-secondary" onClick={() => setVectorTools(false)}>← К рисунку и слоям</button><span className="context-note">Векторные контуры выбранного рисунка · изменения обновляются при автопредпросмотре</span></div><div className="flex-1 min-h-0 overflow-auto vector-contour-tools"><AuthoringPanel standalone /></div></> : <ArtStudioPanel mode={entry.ref.kind === "entity" && entry.category === "character" ? undefined : ui.workspace === "rig" ? "RIG" : ui.workspace === "animate" ? "ANIMATE" : "DRAW"} onModeChange={mode => { if (entry.ref.kind !== "entity" || entry.category === "environment") switchWorkspace(mode === "RIG" ? "rig" : mode === "ANIMATE" ? "animate" : "draw"); }} onLegacyEditor={() => { if (legacyTarget) setVectorTools(true); else useWorkbench.setState({ helpTopic: "draw" }); }} />}
    </div> : <>
      <div className="drawer-controls"><button className="action-secondary" aria-pressed={leftOpen} onClick={() => setLeftOpen(!leftOpen)}><PanelLeft size={16} /> Инструменты</button><button className="action-secondary" aria-pressed={rightOpen} onClick={() => setRightOpen(!rightOpen)}><SlidersHorizontal size={16} /> Свойства</button></div>
      <div className="editor-body">
        {ui.workspace !== "preview" && <aside className={`editor-sidebar ${leftOpen ? "drawer-open" : ""}`} data-testid="library-panel-wrapper"><div className="panel-heading">{WORKSPACE_LABELS[ui.workspace]}<button className="lg:hidden" onClick={() => setLeftOpen(false)} aria-label="Закрыть инструменты">×</button></div>
          {ui.workspace === "appearance" ? <AppearancePanel /> : ui.workspace === "parts" ? <CharacterPartsPanel /> : ui.workspace === "fit" && entry.ref.kind === "item" ? <EquipmentFit itemId={entry.ref.id} /> : ui.workspace === "equipment" ? <LibraryPanel activeTab="items" onTabChange={() => {}} tabs={["items", "slots"]} /> : <div className="p-4 space-y-3"><p className="context-note">Клипы и воспроизведение находятся на временной шкале. Для изменения ключей откройте рисунок части тела.</p><button className="action-secondary" onClick={() => switchWorkspace("parts")}>Открыть части и рисунки</button><button className="action-secondary" onClick={() => setBottom(bottom === "states" ? "timeline" : "states")}>Просмотр состояний</button></div>}
        </aside>}
        <div className="editor-center">
          <div className="flex-1 min-h-0">{ui.workspace === "preview" ? hasEntity ? <PixiPreviewPanel /> : selectedDoc ? <div className="h-full p-10 flex items-center justify-center"><VisualThumbnail visual={{ content: { kind: "document", documentId: selectedDoc.id } }} /></div> : <div className="empty-state"><p>Откройте рисунок для предпросмотра.</p></div> : <CanvasPanel />}</div>
          {(ui.workspace === "animate" || ui.workspace === "preview") && hasEntity && <div className={`editor-bottom ${bottom === "none" ? "collapsed" : ""}`}><nav className="editor-bottom-tabs" aria-label="Инструменты анимации"><button aria-pressed={bottom === "timeline"} onClick={() => setBottom("timeline")}>Клипы и время</button><button aria-pressed={bottom === "states"} onClick={() => setBottom("states")}>Просмотр состояний</button><button aria-label="Свернуть временную шкалу" onClick={() => setBottom(bottom === "none" ? "timeline" : "none")} className="ml-auto"><ChevronDown size={16} /></button></nav>{bottom !== "none" && <div className="flex-1 min-h-0">{bottom === "states" ? <StateMachinePanel /> : <TimelinePanel />}</div>}</div>}
        </div>
        {ui.workspace !== "preview" && <aside className={`editor-properties ${rightOpen ? "drawer-open" : ""}`}><ContextProperties refValue={entry.ref} /></aside>}
      </div>
    </>}
  </div>}</WorkbenchShell>;
}
