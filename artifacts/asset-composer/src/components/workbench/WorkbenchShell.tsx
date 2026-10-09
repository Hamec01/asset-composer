import { useEffect, useState, type ReactNode } from "react";
import { Layers, Home, LibraryBig, BookOpen, Settings, UserRound, Sword, Trees, Paintbrush } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useStore } from "@/store";
import { useWorkbench } from "@/store/workbench";
import { Toolbar } from "@/components/toolbar/Toolbar";
import { CreateAssetWizard } from "@/components/wizard/CreateAssetWizard";
import { ImportDialog } from "./ImportDialog";
import { ExportDialog } from "@/components/export/ExportDialog";
import { HelpDialog } from "./HelpDialog";
import { beginCreation, showLibrary, switchWorkspace } from "@/lib/assetNavigation";
import { exportEntityFor, type AssetCategory } from "@/lib/assetCatalog";
import { clearProjectSessions, getRecentProjectFolderPath } from "@/lib/projectSession";
import { saveLocalCopy, saveProjectFile } from "@/lib/projectPersistence";
import { isTypingTarget } from "@/hooks/useEditorShortcuts";
import { ChibiPackDialog } from "./ChibiPackDialog";
import { addTreePack } from "@/data/treePack";
import { studioCommit } from "@/lib/studioActions";

export function WorkbenchShell({ children, dashboard = false }: { children: ReactNode; dashboard?: boolean }) {
  const ui = useWorkbench();
  const project = useStore(s => s.project), editor = useStore(s => s.editor);
  const [settingsError, setSettingsError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [treesBusy, setTreesBusy] = useState(false);
  const target = exportEntityFor(project, ui.activeAsset);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); useWorkbench.setState({ helpTopic: ui.chibiPackOpen ? "chibi-pack" : editor.isExportOpen ? "export" : editor.isImportWizardOpen ? "draw" : editor.isWizardOpen ? ui.createCategory === "equipment" ? "equipment" : ui.createCategory === "environment" ? "environment" : ui.createCategory === "artwork" ? "draw" : "appearance" : dashboard ? "start" : ui.workspace }); return; }
      if (isTypingTarget(e.target) || e.repeat || editor.isWizardOpen || editor.isImportWizardOpen || editor.isExportOpen || ui.chibiPackOpen || ui.helpTopic) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.code === "KeyN" || e.key.toLowerCase() === "n") { e.preventDefault(); beginCreation(); }
        if (e.code === "KeyS" || e.key.toLowerCase() === "s") { e.preventDefault(); void saveProjectFile(); }
      }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [dashboard, ui.workspace, ui.helpTopic, ui.createCategory, ui.chibiPackOpen, editor.isWizardOpen, editor.isImportWizardOpen, editor.isExportOpen]);
  const categories: { id: AssetCategory; name: string; icon: typeof UserRound }[] = [
    { id: "character", name: "Персонажи", icon: UserRound }, { id: "equipment", name: "Экипировка", icon: Sword },
    { id: "environment", name: "Окружение", icon: Trees }, { id: "artwork", name: "Рисунки", icon: Paintbrush },
  ];
  return <TooltipProvider delayDuration={300}><div className="workbench-shell">
    <aside className="global-nav" aria-label="Основная навигация">
      <div className="brand"><Layers size={24} /><span>Asset<span>Composer</span></span></div>
      <nav>
        <button title="Чиби-пак" onClick={() => useWorkbench.setState({ chibiPackOpen: true })}><UserRound size={18} /><span>Чиби-пак</span></button>
        <button disabled={treesBusy} title="Добавить дуб, сосну и берёзу с анимациями рубки" onClick={async()=>{setTreesBusy(true);setSettingsError('');try{const edit=await addTreePack();studioCommit('Добавить три дерева с анимациями',edit);showLibrary('environment');}catch(e){setSettingsError(e instanceof Error?e.message:'Не удалось загрузить деревья');}finally{setTreesBusy(false);}}}><Trees size={18}/><span>{treesBusy?'Загрузка деревьев…':'Три дерева'}</span></button>
        {settingsError && <p role="alert">{settingsError}</p>}
        <button title="Главная" aria-label="Главная" className={dashboard ? "active" : ""} aria-current={dashboard ? "page" : undefined} data-testid="toolbar-back-dashboard" onClick={() => { void saveLocalCopy(); useStore.getState().setPlaybackPlaying(false); useStore.getState().setAppState("dashboard"); }}><Home size={18} /><span>Главная</span></button>
        <button title="Библиотека" aria-label="Библиотека" className={!dashboard && ui.screen === "library" && ui.libraryCategory === "all" ? "active" : ""} onClick={() => showLibrary()}><LibraryBig size={18} /><span>Библиотека</span></button>
        <p className="nav-caption">ОБЪЕКТЫ ПРОЕКТА</p>
        {categories.map(({ id, name, icon: Icon }) => <button key={id} title={name} aria-label={name} className={!dashboard && ui.screen === "library" && ui.libraryCategory === id ? "active" : ""} onClick={() => showLibrary(id)}><Icon size={18} /><span>{name}</span></button>)}
      </nav>
      <div className="nav-bottom"><button title="Инструкция и FAQ" aria-label="Инструкция и FAQ" onClick={() => useWorkbench.setState({ helpTopic: "start" })}><BookOpen size={18} /><span>Инструкция и FAQ</span></button><button title="Настройки" aria-label="Настройки" onClick={() => useWorkbench.setState({ settingsOpen: true })}><Settings size={18} /><span>Настройки</span></button><p>Локальный редактор 2D-ассетов</p></div>
    </aside>
    <div className="workbench-main"><Toolbar /><main className="workbench-content">{children}</main></div>
    <CreateAssetWizard /><HelpDialog />
    <ChibiPackDialog open={ui.chibiPackOpen} onClose={() => useWorkbench.setState({ chibiPackOpen: false })} />
    <ImportDialog />
    {target ? <ExportDialog entityId={target.id} objectName={ui.activeAsset?.kind === "item" && !project.editorMeta.spriteEditorDocuments.some(d => d.studioEntityId === target.id) ? project.items.find(i => i.id === ui.activeAsset?.id)?.name : undefined} /> : <Dialog open={editor.isExportOpen} onOpenChange={v => { if (!v) useStore.getState().closeExport(); }}><DialogContent><DialogTitle>Что можно экспортировать?</DialogTitle><DialogDescription>Экспорт создаёт изображения и данные выбранного объекта. Сохранение проекта доступно для всех рисунков.</DialogDescription><p>{ui.activeAsset?.kind === "item" ? "Наденьте предмет на персонажа в разделе «Подгонка к персонажу». Экспорт будет содержать персонажа с этим предметом. Для объекта окружения можно создать собственный скелет." : "Откройте персонажа либо создайте скелет рисунка в разделе «Скелет». Достаточно одной корневой кости для экспорта неподвижного рисунка."}</p><div className="dialog-actions"><button className="action-primary" onClick={() => { useStore.getState().closeExport(); if (ui.activeAsset) switchWorkspace(ui.activeAsset.kind === "item" && !project.items.find(i => i.id === ui.activeAsset?.id)?.tags.some(t => t.startsWith("world_")) ? "fit" : "rig"); else showLibrary(); }}>Перейти к объекту</button><button className="action-secondary" onClick={() => { void saveProjectFile(); }}>Сохранить проект</button><button onClick={() => useWorkbench.setState({ helpTopic: "export" })}>Инструкция по экспорту</button></div></DialogContent></Dialog>}
    <Dialog open={ui.settingsOpen} onOpenChange={v => { useWorkbench.setState({ settingsOpen: v }); setConfirmClear(false); }}><DialogContent><DialogTitle>Настройки проекта</DialogTitle><DialogDescription>Хранилище, переносимые файлы и общие настройки.</DialogDescription>
      <p className="context-note">Локальная копия сохраняется автоматически. Файл на диске обновляется кнопкой «Сохранить».</p>
      <p>Папка проекта: {getRecentProjectFolderPath(project.id) ?? "не выбрана"}</p>
      {window.assetComposerProjects && <button className="action-secondary" onClick={async () => { const picked = await window.assetComposerProjects?.pickProjectFolder(); if (picked) await saveProjectFile(picked.folderPath); }}>Выбрать папку проекта</button>}
      <button className="action-secondary" onClick={() => { void saveProjectFile(undefined, true); }}>Скачать переносимый JSON</button>
      <label className="field-label">Стиль всех персонажей<select value={project.entities[0]?.styleSetId ?? project.styleSets[0]?.id ?? ""} onChange={e => useStore.getState().setProjectStyleSet(e.target.value)}>{project.styleSets.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <details className="danger-zone"><summary>Очистка локальных проектов</summary><p>Удаляет локальные проекты и рисунки. Файлы на диске остаются. Сначала скачайте переносимый JSON.</p>{!confirmClear ? <button className="action-secondary" onClick={() => setConfirmClear(true)}>Очистить рабочую область…</button> : <div className="space-y-2"><p>Подтвердите удаление всех локальных проектов.</p><button className="action-danger" disabled={clearBusy} data-testid="confirm-reset-workspace" onClick={async () => { setClearBusy(true); try { await clearProjectSessions(); useStore.getState().setAppState("dashboard"); useStore.getState().newProject(); useWorkbench.setState({ activeAsset: null, contexts: {}, screen: "library", settingsOpen: false }); useStore.getState().setAppState("dashboard"); } catch (e) { setSettingsError(e instanceof Error ? e.message : "Не удалось очистить проекты."); } finally { setClearBusy(false); } }}>Удалить локальные проекты</button><button className="action-secondary" onClick={() => setConfirmClear(false)}>Отмена</button></div>}</details>
      {settingsError && <p role="alert">{settingsError}</p>}
    </DialogContent></Dialog>
  </div></TooltipProvider>;
}
