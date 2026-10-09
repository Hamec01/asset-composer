import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/store";
import { useWorkbench } from "@/store/workbench";
import { NewEntityWizard } from "./NewEntityWizard";
import { CANVAS_PRESETS, type AssetTemplateType } from "@/lib/itemAuthoring";
import { openAsset } from "@/lib/assetNavigation";
import { newStudioDocument, newStudioLayer, studioCommit } from "@/lib/studioActions";
import { UserRound, Sword, Trees, Paintbrush } from "lucide-react";

export const CREATION_CATEGORIES = [
  { id: "character", title: "Персонаж", description: "Внешность, части тела, экипировка и анимация", icon: UserRound },
  { id: "equipment", title: "Экипировка", description: "Оружие, щиты и одежда — с нуля или по основе", icon: Sword },
  { id: "environment", title: "Окружение", description: "Деревья, постройки и предметы окружения", icon: Trees },
  { id: "artwork", title: "Свободный рисунок", description: "Векторные и растровые слои, собственный скелет", icon: Paintbrush },
] as const;
const SUBTYPES: { id: AssetTemplateType; label: string }[] = [
  { id: "weapon_1h", label: "Одноручное оружие" }, { id: "weapon_2h", label: "Двуручное оружие" },
  { id: "shield", label: "Щит" }, { id: "head_cover", label: "Головной убор" }, { id: "torso", label: "Одежда / броня" },
  { id: "legs", label: "Брюки" }, { id: "feet", label: "Обувь" },
  { id: "world_flora", label: "Природа" }, { id: "world_building", label: "Постройка" }, { id: "world_prop", label: "Предмет окружения" },
];
export function CreateAssetWizard() {
  const open = useStore(s => s.editor.isWizardOpen);
  const category = useWorkbench(s => s.createCategory);
  const [subtype, setSubtype] = useState<AssetTemplateType>("weapon_1h");
  const [name, setName] = useState("");
  const [size, setSize] = useState(128);
  const [blank, setBlank] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setName(""); setSubtype(category === "environment" ? "world_flora" : "weapon_1h"); setSize(category === "artwork" || category === "environment" ? 512 : 128); setBlank(false); setError(""); }, [open, category]);
  if (category === "character") return <NewEntityWizard />;
  function create() {
    if (!name.trim() || !category) return;
    try {
      const store = useStore.getState();
      if (category === "artwork") {
        const doc = newStudioDocument(size, size); doc.name = name.trim(); doc.layers.push(newStudioLayer("vector", "Основной слой"));
        studioCommit("Создать рисунок", p => { p.editorMeta.spriteEditorDocuments.push(doc); p.editorMeta.activeSpriteDocumentId = doc.id; });
        openAsset({ kind: "artwork", id: doc.id });
      } else {
        const item = (category === "environment" ? store.createWorldObject : store.createEquipmentItem)({ name: name.trim(), type: subtype, width: size, height: size });
        if (blank) studioCommit("Пустой холст", p => { const doc = p.editorMeta.spriteEditorDocuments.find(d => d.target.itemId === item.id); if (doc) doc.layers.forEach(l => { l.shapes = []; }); });
        openAsset({ kind: "item", id: item.id });
      }
      store.closeWizard();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось создать объект."); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!value) useStore.getState().closeWizard(); }}>
    <DialogContent className="max-w-2xl max-h-[90dvh] overflow-auto">
      <DialogTitle>{category ? "Создать объект" : "Что будем создавать?"}</DialogTitle>
      <DialogDescription>{category ? "Выберите основу и имя. Рисунок и настройки можно изменить позже." : "Выберите задачу. Все объекты сохраняются в одном проекте."}</DialogDescription>
      {!category ? <div className="creation-grid">{CREATION_CATEGORIES.map(({ id, title, description, icon: Icon }) => <button key={id} className="creation-card" data-testid={`wizard-type-${id}`} onClick={() => useWorkbench.setState({ createCategory: id })}><Icon size={24} /><strong>{title}</strong><span>{description}</span></button>)}</div>
        : <form onSubmit={e => { e.preventDefault(); create(); }} className="space-y-4">
          {category !== "artwork" && <label className="field-label">Тип объекта<select value={subtype} onChange={e => setSubtype(e.target.value as AssetTemplateType)}>{SUBTYPES.filter(t => category === "environment" ? t.id.startsWith("world_") : !t.id.startsWith("world_")).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>}
          <label className="field-label">Размер холста<select value={size} onChange={e => setSize(Number(e.target.value))}>{CANVAS_PRESETS.map(p => <option key={p.key} value={p.width}>{p.label} — {p.description}</option>)}</select></label>
          {category !== "artwork" && <label className="field-label">Начальная точка<select value={blank ? "blank" : "template"} onChange={e => setBlank(e.target.value === "blank")}><option value="template">Готовая основа</option><option value="blank">Пустой холст</option></select></label>}
          <label className="field-label">Название<input autoFocus data-testid="wizard-name-input" value={name} onChange={e => setName(e.target.value)} placeholder="Например, Железный меч" maxLength={160} /></label>
          <p className="context-note">Можно рисовать или импортировать SVG, PNG, WebP и JPEG после создания. Персонаж для этого не нужен.</p>
          <button type="submit" className="action-primary" data-testid="wizard-create-btn" disabled={!name.trim()}>Создать</button>
        </form>}
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="dialog-actions"><button className="action-secondary" onClick={() => useWorkbench.setState({ createCategory: null })} disabled={!category}>Назад</button><button className="action-secondary" onClick={() => useStore.getState().closeWizard()}>Отмена</button><button className="text-primary ml-auto" onClick={() => useWorkbench.setState({ helpTopic: category === "equipment" ? "equipment" : category === "environment" ? "environment" : "draw" })}>Как это работает?</button></div>
    </DialogContent>
  </Dialog>;
}
