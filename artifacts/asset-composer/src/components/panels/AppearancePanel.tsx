import { useState } from "react";
import { UserRound, Smile, Scissors, RotateCcw, Check } from "lucide-react";
import { useStore } from "@/store";
import { APPEARANCE_PRESETS, NOSE_PRESETS, FRECKLE_PRESETS, SCAR_PRESETS, chibiFeatureSvg, DEFAULT_APPEARANCE } from "@/data/characterAppearance";
import { sanitizeSvg } from "@/lib/sanitize";
import type { FaceFeatureKey, CharacterAppearance } from "@/domain/types";

const SKIN_COLORS = ["#FFD0A8", "#F1B88D", "#D99A70", "#AF7451", "#80553F", "#553B30"];
const HAIR_COLORS = ["#362820", "#75482E", "#AE7748", "#D5B26A", "#B8593D", "#D4D0C7", "#845677"];

function PresetCards({ presets, selectedId, onSelect, svgFor, prefix }: {
  presets: { id: string; label: string }[]; selectedId: string;
  onSelect: (id: string) => void; svgFor: (id: string) => string | null; prefix: string;
}) {
  return <div className="grid grid-cols-2 gap-2">
    {presets.map(preset => {
      const svg = svgFor(preset.id);
      const selected = selectedId === preset.id;
      return <button key={preset.id} data-testid={`appearance-${prefix}-${preset.id}`} aria-pressed={selected}
        className={`relative min-w-0 rounded border p-2 ${selected ? "border-primary bg-primary/15 ring-1 ring-primary/50" : "border-border hover:bg-accent/40"}`}
        onClick={() => onSelect(preset.id)}>
        {selected && preset.id !== "none" && <Check size={14} className="absolute top-1 right-1 text-primary bg-background rounded-sm" aria-hidden="true" />}
        <div className="w-full h-12 flex items-center justify-center overflow-hidden bg-[#b7b7ad] rounded-sm">
          {svg ? <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }} /> : <span className="text-lg text-[#53564f]">×</span>}
        </div>
        <span className="block mt-2 text-xs leading-snug break-words">{preset.label}</span>
      </button>;
    })}
  </div>;
}

function RangeControl({ label, value, min = 0, max = 100, onChange }: {
  label: string; value: number; min?: number; max?: number; onChange: (value: number) => void;
}) {
  return <label className="block space-y-1 text-xs">
    <span className="flex justify-between gap-2"><span>{label}</span><output className="text-muted-foreground tabular-nums">{Math.round(value)}</output></span>
    <input aria-label={label} type="range" className="w-full accent-[var(--primary)]" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} />
  </label>;
}

export function AppearancePanel() {
  const entity = useStore(s => s.project.entities.find(candidate => candidate.id === s.project.activeEntityId));
  const [section, setSection] = useState<"body" | "face" | "hair">("face");
  const [feature, setFeature] = useState<FaceFeatureKey | "nose" | "marks">("eyes");
  if (!entity) return <div className="p-3 text-sm text-muted-foreground">Нет персонажа</div>;
  if (!entity.templateId.startsWith("biped_profile_")) return <div className="p-3 text-sm text-muted-foreground">Выберите базу чиби</div>;
  const store = useStore.getState();
  const appearance = { ...DEFAULT_APPEARANCE, ...entity.appearance };
  const currentFeature = section === "hair" ? "hair" : feature;
  const config = currentFeature !== "nose" && currentFeature !== "marks" ? entity.faceCustomization?.[currentFeature] : undefined;
  const presetId = currentFeature === "nose" ? appearance.nose : config?.visible ? config.presetId : "none";
  const color = config?.color ?? (currentFeature === "hair" ? entity.palette.hair : "#382A24");
  const patchBody = (patch: Partial<CharacterAppearance>) => store.setEntityAppearance(entity.id, patch);
  const choosePreset = (id: string) => {
    if (currentFeature === "nose") patchBody({ nose: id as CharacterAppearance["nose"] });
    else if (currentFeature !== "marks") store.setEntityFaceFeature(entity.id, currentFeature, { presetId: id, visible: id !== "none" });
  };
  const presets = currentFeature === "nose"
    ? NOSE_PRESETS
    : currentFeature === "marks" ? [] : APPEARANCE_PRESETS[currentFeature];
  return <div className="flex-1 min-h-0 overflow-y-auto ide-scroll" data-testid="appearance-panel">
    <div className="sticky top-0 z-10 bg-sidebar border-b border-border px-3 py-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium truncate">{entity.name}</span>
        <button className="h-7 w-7 flex items-center justify-center hover:bg-accent rounded" aria-label="Сбросить выбранный раздел" title="Сбросить выбранный раздел"
          onClick={() => {
            if (section === "body") patchBody({ sex: "male", slimness: 0, muscle: 0, fat: 0 });
            else if (currentFeature === "marks") patchBody({ freckles: false, freckleIntensity: .65, mole: false, scar: "none" });
            else choosePreset("none");
          }}><RotateCcw size={14} /></button>
      </div>
      <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Внешность">
        {([["body", UserRound, "Тело"], ["face", Smile, "Лицо"], ["hair", Scissors, "Волосы"]] as const).map(([id, Icon, label]) =>
          <button key={id} role="tab" aria-selected={section === id} onClick={() => setSection(id)}
            className={`h-8 flex items-center justify-center gap-1 text-xs border-b-2 ${section === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
            <Icon size={13} />{label}
          </button>)}
      </div>
    </div>
    <div className="p-3 space-y-4">
      <fieldset>
        <legend className="text-xs text-muted-foreground mb-2">Ракурс</legend>
        <div className="grid grid-cols-3 border border-border rounded overflow-hidden">
          {([["left", "Влево"], ["right", "Вправо"]] as const).map(([view, label]) =>
            <button key={view} data-testid={`view-${view}`} aria-pressed={(appearance.view ?? "front") === view}
              className={`h-8 text-xs ${(appearance.view ?? "front") === view ? "bg-primary/15 text-primary" : "hover:bg-accent"}`}
              onClick={() => patchBody({ view })}>{label}</button>)}
        </div>
      </fieldset>
      {section === "body" ? <>
        <fieldset className="space-y-2">
          <legend className="text-xs mb-2 text-muted-foreground">База</legend>
          <div className="grid grid-cols-2 border border-border rounded overflow-hidden">
            {(["male", "female"] as const).map(sex => <button key={sex} aria-pressed={appearance.sex === sex}
              className={`h-9 text-xs ${appearance.sex === sex ? "bg-primary/15 text-primary" : "hover:bg-accent"}`}
              onClick={() => patchBody({ sex })}>{sex === "male" ? "Мужская" : "Женская"}</button>)}
          </div>
        </fieldset>
        <RangeControl label="Худоба" value={appearance.slimness * 100} onChange={value => patchBody({ slimness: value / 100 })} />
        <RangeControl label="Мускулатура" value={appearance.muscle * 100} onChange={value => patchBody({ muscle: value / 100 })} />
        <RangeControl label="Полнота" value={appearance.fat * 100} onChange={value => patchBody({ fat: value / 100 })} />
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Кожа</p>
          <div className="flex flex-wrap gap-2">{SKIN_COLORS.map(skin => <button key={skin} title={skin} aria-label={`Кожа ${skin}`} aria-pressed={entity.palette.skin === skin}
            className={`h-7 w-7 rounded border-2 ${entity.palette.skin === skin ? "border-primary" : "border-transparent"}`} style={{ background: skin }}
            onClick={() => store.setEntityPaletteToken(entity.id, "skin", skin)} />)}</div>
          <input type="color" aria-label="Цвет кожи" value={entity.palette.skin} onChange={event => store.setEntityPaletteToken(entity.id, "skin", event.target.value)} className="h-7 w-10 bg-transparent" />
        </div>
      </> : <>
        {section === "face" && <select aria-label="Часть лица" value={feature} onChange={event => setFeature(event.target.value as typeof feature)}
          className="h-9 w-full min-w-0 rounded border border-border bg-background px-2 text-xs">
          <option value="eyes">Глаза</option><option value="brows">Брови</option><option value="mouth">Рот и губы</option>
          <option value="nose">Нос</option><option value="beard">Борода</option><option value="marks">Детали кожи</option>
        </select>}
        {currentFeature === "marks" ? <>
          <fieldset className="space-y-2"><legend className="text-xs mb-2">Веснушки</legend>
            <PresetCards presets={FRECKLE_PRESETS} prefix="freckles" selectedId={appearance.freckles ? appearance.freckleStyle ?? "light" : "none"}
              onSelect={id => patchBody({ freckles: id !== "none" && !(appearance.freckles && id === (appearance.freckleStyle ?? "light")),
                ...(id !== "none" ? { freckleStyle: id as CharacterAppearance["freckleStyle"] } : {}) })}
              svgFor={id => id === "none" ? null : chibiFeatureSvg("marks", "marks", color, { ...appearance, freckles: true, freckleStyle: id as CharacterAppearance["freckleStyle"], freckleIntensity: 1, mole: false, scar: "none" }, true)} />
            {appearance.freckles && <RangeControl label="Яркость веснушек" value={(appearance.freckleIntensity ?? .65) * 100}
              onChange={value => patchBody({ freckleIntensity: value / 100 })} />}
          </fieldset>
          <label className="flex items-center justify-between text-xs">Родинка
            <input type="checkbox" aria-label="Родинка" checked={appearance.mole} onChange={event => patchBody({ mole: event.target.checked })} />
          </label>
          <fieldset className="space-y-2"><legend className="text-xs mb-2">Шрамы</legend>
            <PresetCards presets={SCAR_PRESETS} prefix="scar" selectedId={appearance.scar}
              onSelect={id => patchBody({ scar: (id === appearance.scar ? "none" : id) as CharacterAppearance["scar"] })}
              svgFor={id => id === "none" ? null : chibiFeatureSvg("marks", "marks", color, { ...appearance, freckles: false, mole: false, scar: id as CharacterAppearance["scar"] }, true)} />
          </fieldset>
        </> : <>
          <div className="grid grid-cols-2 gap-2">
            {presets.map(preset => {
              const svg = chibiFeatureSvg(currentFeature, preset.id, color, appearance, true);
              return <button key={preset.id} data-testid={`appearance-${currentFeature}-${preset.id}`} aria-pressed={presetId === preset.id}
                className={`relative min-w-0 rounded border p-2 ${presetId === preset.id ? "border-primary bg-primary/15 ring-1 ring-primary/50" : "border-border hover:bg-accent/40"}`}
                onClick={() => choosePreset(presetId === preset.id ? "none" : preset.id)}>
                {presetId === preset.id && preset.id !== "none" && <Check size={14} className="absolute top-1 right-1 text-primary bg-background rounded-sm" aria-hidden="true" />}
                <div className={`w-full ${currentFeature === "hair" ? "h-20" : "h-12"} flex items-center justify-center overflow-hidden bg-[#b7b7ad] rounded-sm`}>
                  {svg ? <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }} /> : <span className="text-lg text-[#53564f]">×</span>}
                </div>
                <span className="block mt-2 text-xs leading-snug break-words">{preset.label}</span>
              </button>;
            })}
          </div>
          {config && config.visible && <>
            <label className="flex items-center justify-between text-xs">Цвет
              <input type="color" aria-label="Цвет выбранной детали" value={color} className="h-7 w-10 bg-transparent"
                onChange={event => store.setEntityFaceFeature(entity.id, currentFeature as FaceFeatureKey, { color: event.target.value })} />
            </label>
            {currentFeature === "hair" && <div className="flex flex-wrap gap-2">{HAIR_COLORS.map(hair => <button key={hair} title={hair} aria-label={`Волосы ${hair}`}
              className="h-6 w-6 rounded border border-border" style={{ background: hair }} onClick={() => store.setEntityFaceFeature(entity.id, "hair", { color: hair })} />)}</div>}
            <RangeControl label="Размер" min={70} max={130} value={config.transform.scaleX * 100}
              onChange={value => store.setEntityFaceFeatureTransform(entity.id, currentFeature as FaceFeatureKey, { scaleX: value / 100, scaleY: value / 100 })} />
            {currentFeature !== "hair" && <RangeControl label="Высота" min={-5} max={5} value={config.transform.y}
              onChange={value => store.setEntityFaceFeatureTransform(entity.id, currentFeature as FaceFeatureKey, { y: value })} />}
          </>}
        </>}
      </>}
    </div>
  </div>;
}
