import { useRef, useState } from "react";
import { useStore } from "@/store";
import { getLastProjectSnapshotName, getRecentProjectFolderPath, getRecentProjectSessions, loadProjectSession, restoreLastProjectSnapshot } from "@/lib/projectSession";
import { parseProjectSnapshot } from "@/lib/projectValidation";
import { beginCreation, resumeProject } from "@/lib/assetNavigation";
import { saveLocalCopy } from "@/lib/projectPersistence";
import { useWorkbench } from "@/store/workbench";
import { WorkbenchShell } from "@/components/workbench/WorkbenchShell";
import { CREATION_CATEGORIES } from "@/components/wizard/CreateAssetWizard";
import { FolderOpen, ArrowRight, BookOpen, Clock3, Plus } from "lucide-react";

export function Dashboard() {
  const recent = getRecentProjectSessions();
  const lastName = getLastProjectSnapshotName();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function openProject(raw: unknown, folderPath?: string) {
    const parsed = parseProjectSnapshot(raw);
    useStore.getState().loadProject(parsed);
    await saveLocalCopy(useStore.getState().project, folderPath);
    resumeProject();
  }
  async function openRecent(id: string) {
    setBusy(true); setError("");
    try {
      const folder = getRecentProjectFolderPath(id);
      if (folder && window.assetComposerProjects) {
        const result = await window.assetComposerProjects.readProjectFromFolder(folder);
        if (!result) throw new Error("Не удалось прочитать project.json в папке проекта. Откройте переносимый JSON или выберите другую папку.");
        await openProject(result.project, folder);
      } else { const restored = loadProjectSession(id); if (!restored) throw new Error("Локальная копия проекта недоступна. Откройте сохранённый JSON."); await openProject(restored); }
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось открыть проект."); }
    finally { setBusy(false); }
  }
  return <WorkbenchShell dashboard><div className="dashboard-page">
    <div className="page-eyebrow">ВАША МАСТЕРСКАЯ 2D-АССЕТОВ</div>
    <div className="dashboard-heading"><div><h1>Что будем создавать?</h1><p>Начните с задачи. Рисуйте, собирайте и анимируйте в одном проекте.</p></div><button className="action-secondary" onClick={() => useWorkbench.setState({ helpTopic: "start" })}><BookOpen size={17} /> Быстрый старт</button></div>
    <div className="dashboard-categories">{CREATION_CATEGORIES.map(({ id, title, description, icon: Icon }) => <button key={id} data-testid={`dashboard-create-${id}`} className="dashboard-category" onClick={() => beginCreation(id, true)}><span className={`category-icon category-${id}`}><Icon size={28} /></span><strong>{title}</strong><p>{description}</p><span className="category-action">Начать новый проект <ArrowRight size={15} /></span></button>)}</div>
    <section className="dashboard-resume">
      <div><span className="page-eyebrow">ПРОДОЛЖИТЬ РАБОТУ</span><h2>{lastName ?? "Откройте свой проект"}</h2><p>{lastName ? "Вернитесь к сохранённым объектам и рисункам." : "Переносимый JSON содержит рисунки, предметы, скелеты и анимацию."}</p></div>
      <div className="flex flex-wrap gap-2">{lastName && <button className="action-primary" data-testid="dashboard-continue-last" disabled={busy} onClick={async () => { try { const restored = restoreLastProjectSnapshot(); if (!restored) throw new Error("Сохранённая сессия недоступна."); await openProject(restored); } catch (e) { setError(e instanceof Error ? e.message : "Не удалось открыть сессию."); } }}>Продолжить <ArrowRight size={16} /></button>}<button data-testid="dashboard-load" className="action-secondary" onClick={() => fileRef.current?.click()}><FolderOpen size={17} /> Открыть JSON</button></div>
    </section>
    {window.assetComposerProjects && <button className="action-secondary mb-6" data-testid="dashboard-open-folder" onClick={async () => { try { const folder = await window.assetComposerProjects?.pickProjectFolder(); if (!folder) return; const result = await window.assetComposerProjects?.readProjectFromFolder(folder.folderPath); if (!result) throw new Error("В папке не найден корректный project.json."); await openProject(result.project, folder.folderPath); } catch (e) { setError(e instanceof Error ? e.message : "Не удалось открыть папку."); } }}><FolderOpen size={17} /> Открыть папку проекта</button>}
    <div className="dashboard-lower"><section><div className="section-heading"><h2><Clock3 size={18} /> Последние проекты</h2><button data-testid="dashboard-new" onClick={() => beginCreation("character", true)}><Plus size={15} /> Новый проект</button></div>{recent.length ? <div className="recent-projects">{recent.map(p => <button key={p.id} data-testid={`dashboard-recent-${p.id}`} disabled={busy} onClick={() => { void openRecent(p.id); }}><span className="recent-icon"><FolderOpen size={20} /></span><span><strong>{p.name}</strong><small>{p.folderPath ? "Папка на диске" : "Локальная копия"} · {new Date(p.updatedAt).toLocaleDateString("ru-RU")}</small></span><ArrowRight size={16} /></button>)}</div> : <div className="empty-state"><p>Пока нет сохранённых проектов.</p><span>Выберите задачу выше или откройте свой JSON.</span></div>}</section>
      <section className="learning-card"><BookOpen size={25} /><h2>Понятно с первого объекта</h2><p>Инструкции по каждой задаче, ответы на частые вопросы и объяснения сложных инструментов.</p><button className="action-secondary" onClick={() => useWorkbench.setState({ helpTopic: "start" })}>Открыть инструкцию</button><button className="text-primary" onClick={() => useWorkbench.setState({ helpTopic: "faq" })}>Частые вопросы →</button></section></div>
    {error && <div className="workbench-error" role="alert">{error}<button onClick={() => setError("")}>Закрыть</button></div>}
    <input ref={fileRef} hidden type="file" accept=".json" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; try { await openProject(JSON.parse(await file.text())); setError(""); } catch (err) { setError(err instanceof Error ? err.message : "Некорректный JSON проекта."); } }} />
  </div></WorkbenchShell>;
}
