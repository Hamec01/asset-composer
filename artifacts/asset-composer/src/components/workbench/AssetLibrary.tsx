import { duplicateAsset, deleteAsset } from "@/lib/assetOperations";
import { useMemo, useState } from "react";
import { useStore } from "@/store";
import { useWorkbench } from "@/store/workbench";
import { assetKey, buildAssetCatalog, CATEGORY_LABELS, type AssetCategory, type AssetEntry } from "@/lib/assetCatalog";
import { beginCreation, openAsset } from "@/lib/assetNavigation";
import { VisualThumbnail } from "@/components/VisualThumbnail";
import { sanitizeSvg } from "@/lib/sanitize";
import { evaluateExportScene, composeFrameSvg, exportCamera } from "@/lib/exportFrames";
import { UserRound, Sword, Trees, Paintbrush, Search, Grid2X2, List, Plus, Copy, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function AssetThumbnail({ entry }: { entry: AssetEntry }) {
  const project = useStore(s => s.project);
  const item = entry.ref.kind === "item" ? project.items.find(i => i.id === entry.ref.id) : undefined;
  const entity = entry.ref.kind === "entity" ? project.entities.find(e => e.id === entry.ref.id) : undefined;
  const template = project.templates.find(t => t.id === entity?.templateId);
  const tokenSvg = useMemo(() => {
    if (!entity || template?.skeletonFamily !== "chibi_token_v1") return "";
    const scene = evaluateExportScene(entity, template, project.animationClips, project.items, [],
      { key: "library", clip: null, frame: 0, timeMs: 0 }, undefined,
      { assets: project.assets ?? {}, documents: project.editorMeta.spriteEditorDocuments });
    return composeFrameSvg(scene, exportCamera([scene], .08), 128);
  }, [entity, template, project.animationClips, project.items, project.assets, project.editorMeta.spriteEditorDocuments]);
  if (tokenSvg) return <span className="asset-svg" role="img" aria-label={`Предпросмотр ${entry.name}`} dangerouslySetInnerHTML={{ __html: tokenSvg }} />;
  if (entry.documentId) return <VisualThumbnail visual={{ content: { kind: "document", documentId: entry.documentId } }} />;
  if (item?.svgLayers[0]) return <VisualThumbnail visual={item.svgLayers[0]} />;
  if (item?.parts?.[0]) return <VisualThumbnail visual={item.parts[0]} />;
  if (template?.thumbnailSvg) return <span className="asset-svg" dangerouslySetInnerHTML={{ __html: sanitizeSvg(template.thumbnailSvg) }} />;
  const Icon = entry.category === "character" ? UserRound : entry.category === "equipment" ? Sword : entry.category === "environment" ? Trees : Paintbrush;
  return <Icon size={36} />;
}
export function AssetLibrary() {
  const project = useStore(s => s.project);
  const category = useWorkbench(s => s.libraryCategory);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [source, setSource] = useState("mine");
  const [remove, setRemove] = useState<AssetEntry | null>(null);
  const catalog = useMemo(() => buildAssetCatalog(project), [project]);
  const entries = catalog.filter(e => (category === "all" || e.category === category) &&
    (source === "all" || (source === "mine" ? !e.builtIn : e.builtIn)) && `${e.name} ${e.tags.join(" ")}`.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")));
  return <div className="library-page">
    <div className="page-heading"><div><div className="page-eyebrow">{project.name}</div><h1>{category === "all" ? "Библиотека проекта" : CATEGORY_LABELS[category]}</h1><p>Откройте объект для редактирования. Рисунки частей находятся внутри своих персонажей и предметов.</p></div><button className="action-primary" onClick={() => beginCreation(category === "all" ? null : category)}><Plus size={16} /> Создать</button></div>
    <div className="library-filters"><label className="workbench-search"><Search size={17} /><input data-testid="library-search" aria-label="Поиск объектов" placeholder="Поиск по имени и тегам…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Категория объектов" value={category} onChange={e => useWorkbench.setState({ libraryCategory: e.target.value as AssetCategory | "all" })}><option value="all">Все категории</option>{Object.entries(CATEGORY_LABELS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select aria-label="Источник объектов" value={source} onChange={e => setSource(e.target.value)}><option value="all">Все объекты</option><option value="mine">Мои объекты</option><option value="built-in">Готовый каталог</option></select><div className="view-toggle"><button aria-label="Сетка" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 size={18} /></button><button aria-label="Список" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={18} /></button></div></div>
    <p className="library-count">{entries.length} объектов{query && ` · поиск «${query}»`}</p>
    {!entries.length ? <div className="empty-state"><Paintbrush size={36} /><h2>{query || source === "built-in" ? "Ничего не найдено" : "Создайте первый объект"}</h2><p>{query || source === "built-in" ? "Измените запрос или сбросьте фильтры." : "Выберите тип объекта, начните рисовать или импортируйте изображение."}</p><button className="action-secondary" onClick={() => { if (query || source === "built-in") { setQuery(""); setSource("all"); } else beginCreation(category === "all" ? null : category); }}>{query || source === "built-in" ? "Сбросить поиск" : "Создать объект"}</button></div> : <div className={`asset-collection ${view}`}>
      {entries.map(entry => <article key={assetKey(entry.ref)} className="asset-card" data-testid={`asset-${assetKey(entry.ref)}`}><button className="asset-open" onClick={() => openAsset(entry.ref)}><div className="asset-thumbnail"><AssetThumbnail entry={entry} /></div><div className="asset-description"><strong>{entry.name}</strong><span>{CATEGORY_LABELS[entry.category]} · {entry.builtIn ? "Готовый каталог" : "В проекте"}</span>{view === "list" && <small>{entry.tags.filter(t => !["user_drawn", "art_studio"].includes(t)).slice(0, 4).join(" · ")}</small>}</div></button>
        {!entry.builtIn && <div className="asset-actions">{entry.ref.kind !== "entity" && <button aria-label={`Дублировать ${entry.name}`} onClick={() => { const copy = duplicateAsset(entry.ref); if (copy) openAsset(copy); }}><Copy size={15} /> Копия</button>}<button aria-label={`Удалить ${entry.name}`} onClick={() => setRemove(entry)}><Trash2 size={15} /> Удалить</button></div>}
      </article>)}
    </div>}
    <Dialog open={!!remove} onOpenChange={v => { if (!v) setRemove(null); }}><DialogContent><DialogTitle>Удалить «{remove?.name}»?</DialogTitle><DialogDescription>Объект и его рисунки будут удалены из проекта. Предмет будет снят со всех персонажей. Сохранённые файлы остаются. Это действие не входит в Undo.</DialogDescription><div className="dialog-actions"><button className="action-secondary" onClick={() => setRemove(null)}>Отмена</button><button className="action-danger" onClick={() => { if (remove) deleteAsset(remove.ref); setRemove(null); }}>Удалить объект</button></div></DialogContent></Dialog>
  </div>;
}
