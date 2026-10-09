import { useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TOKEN_ANIMATIONS } from "@/data/chibiTokenAnimations";
import { TOKEN_TASKS, tokenAction, tokenTaskMatches } from "@/data/chibiWorkAnimations";
import { TOKEN_AGES, tokenAgeAllowsBeard, type TokenAge } from "@/lib/chibiAge";
import { DEFAULT_TOKEN_FIT, TOKEN_MODULES, TOKEN_PACK_PATH, TOKEN_SKINS, addTokenToProject, loadTokenAssets, tokenClips, tokenEntity, tokenItems, tokenPreviewAssets, tokenTemplate, tokenFitFromOverride, type TokenFit } from "@/data/chibiTokenPack";
import { isTokenTwoHanded } from "@/lib/chibiEquipment";
import { randomTokenAppearance } from "@/lib/chibiAppearance";
import { tokenModuleAllowed, tokenSelectionForSex, type TokenSex } from "@/lib/chibiGender";
import { DEFAULT_TOKEN_FACE, TOKEN_EMOTIONS } from "@/lib/chibiFace";
import { evaluateExportScene, composeFrameSvg } from "@/lib/exportFrames";
import { studioCommit } from "@/lib/studioActions";
import { openAsset } from "@/lib/assetNavigation";
import { useStore } from "@/store";
import type { Entity } from "@/domain/types";

function VariantPicker({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  const id = useId();
  function step(direction: number) {
    const index = Math.max(0, options.findIndex(option => option.value === value));
    onChange(options[(index + direction + options.length) % options.length].value);
  }
  return <div className="field-label token-variant-field"><label htmlFor={id}>{label}</label><div className="token-variant-picker">
    <button type="button" className="action-secondary" aria-label={`Предыдущий вариант: ${label}`} title="Предыдущий вариант" onClick={() => step(-1)}><ChevronLeft size={18} /></button>
    <select id={id} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); step(e.key === "ArrowLeft" ? -1 : 1); }
    }}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    <button type="button" className="action-secondary" aria-label={`Следующий вариант: ${label}`} title="Следующий вариант" onClick={() => step(1)}><ChevronRight size={18} /></button>
  </div></div>;
}

export function ChibiPackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [skin, setSkin] = useState(0), [selected, setSelected] = useState<Record<string, string>>({});
  const [name, setName] = useState("Чиби"), [clipName, setClipName] = useState("idle");
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(true), [left, setLeft] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [editing, setEditing] = useState<Entity | null>(null);
  const [fits, setFits] = useState<Record<string, TokenFit>>({});
  const [fitSlot, setFitSlot] = useState("token_beard");
  const [notice, setNotice] = useState("");
  const [zoom, setZoom] = useState(1.15);
  const [face, setFace] = useState({ ...DEFAULT_TOKEN_FACE });
  const [sex, setSex] = useState<TokenSex>("male");
  const [age, setAge] = useState<TokenAge>("adult"), [task, setTask] = useState("all");
  useEffect(() => {
    if (!open) return;
    const p = useStore.getState().project, current = p.entities.find(e => e.id === p.activeEntityId && e.templateId.startsWith("chibi_token_skin_"));
    setEditing(current ?? null); setError(""); setNotice(""); setTime(0); setPlaying(true);
    if (current) {
      const currentSex = current.appearance?.sex ?? "male";
      setFitSlot(currentSex === "female" ? "token_hair" : "token_beard");
      setSex(currentSex); setAge(current.appearance?.tokenAge ?? "adult"); setTask("all"); setName(current.name); setSkin(Number(current.templateId.split("_").at(-1))); setFace({ ...(current.appearance?.tokenFace ?? DEFAULT_TOKEN_FACE) });
      setSelected(tokenSelectionForSex(Object.fromEntries(current.slots.map(s => [s.slotId, s.itemId?.replace("token_item_", "") ?? ""])), currentSex));
      setFits(Object.fromEntries(current.slots.flatMap(s => {
        const m = TOKEN_MODULES.find(m => `token_item_${m.id}` === s.itemId);
        return m ? [[s.slotId, tokenFitFromOverride(m, s.attachmentOverride)]] : [];
      })));
      const currentName = p.animationClips.find(c => c.id === current.activeAnimationClipId)?.name;
      setClipName(TOKEN_ANIMATIONS.some(c => c.name === currentName) ? currentName! : "idle");
    }
  }, [open]);
  const items = useMemo(() => tokenItems(), []), assets = useMemo(() => tokenPreviewAssets(), []);
  const template = useMemo(() => tokenTemplate(skin), [skin]), clips = useMemo(() => tokenClips(template.id), [template.id]);
  const entity = useMemo(() => {
    const next = tokenEntity(name, skin, selected, clipName, fits, sex, age);
    next.appearance!.tokenFace = face;
    return next;
  }, [name, skin, selected, clipName, fits, face, sex, age]);
  const clip = clips.find(c => c.name === clipName)!;
  useEffect(() => {
    if (!open || !playing) return;
    const start = performance.now();
    const timer = window.setInterval(() => { const t = performance.now() - start; setTime(clip.loops ? t % clip.durationMs : Math.min(t, clip.durationMs)); if (!clip.loops && t >= clip.durationMs) setPlaying(false); }, 1000 / 24);
    return () => window.clearInterval(timer);
  }, [open, playing, clip]);
  useEffect(() => { setTime(0); }, [clipName]);
  const svg = useMemo(() => {
    if (!open) return "";
      const subject = { ...entity, appearance: { ...entity.appearance!, view: left ? "left" as const : "right" as const } };
      const scene = evaluateExportScene(subject, template, clips, items, [], { key: "token-preview", clip, frame: time * clip.fps / 1000, timeMs: time }, undefined, { assets, documents: [] });
      const size = 330 / zoom;
      return composeFrameSvg(scene, { x: -size / 2, y: -105 - size / 2, size }, 360);
  }, [open, entity, template, clips, items, assets, clip, time, left, zoom]);
  function chooseClip(value: string) {
    setClipName(value); setPlaying(true);
  }
  function chooseSkin(value: number) {
    setSkin(value);
    setSelected(old => ({ ...old, token_headshape: old.token_headshape ? `heads_${value * 4 + Number(old.token_headshape.split("_").at(-1)) % 4}` : "" }));
  }
  function chooseModule(slot: string, value: string) {
    setSelected(old => {
      const next = { ...old, [slot]: value };
      if (slot === "token_main" && isTokenTwoHanded(`token_item_${value}`)) next.token_off = "";
      if (slot === "token_off" && value && isTokenTwoHanded(`token_item_${old.token_main}`)) next.token_main = "";
      return next;
    });
    if (slot === "token_main" && isTokenTwoHanded(`token_item_${value}`) && selected.token_off) setNotice("Щит снят: выбран двуручный предмет.");
    else if (slot === "token_off" && value && isTokenTwoHanded(`token_item_${selected.token_main}`)) setNotice("Двуручный предмет снят: выбран щит.");
    else setNotice("");
    setFits(old => ({ ...old, [slot]: { ...DEFAULT_TOKEN_FIT } })); setFitSlot(slot);
  }
  function randomizeAppearance() {
    const next = randomTokenAppearance(Math.random, sex, age);
    setSkin(next.skin); setSelected(next.selected); setFits({}); setFitSlot("token_hair");
    setNotice("Собрана случайная внешность. Одежда, головные уборы, украшения и предметы сняты. Детали можно переключать стрелками и подгонять.");
  }
  const fitting = fits[fitSlot] ?? DEFAULT_TOKEN_FIT;
  const showBeard = sex === "male" && tokenAgeAllowsBeard(age);
  const availableSlots = template.slots.filter(s => showBeard || s.id !== "token_beard");
  const action = tokenAction(clipName);
  const suggestions = [...(action?.props ?? []), ...(action?.station ? [action.station] : [])].map(id => TOKEN_MODULES.find(m => m.id === id)?.name).filter(Boolean);
  function chooseAge(value: TokenAge) {
    setAge(value);
    if (!tokenAgeAllowsBeard(value)) { setSelected(old => ({ ...old, token_beard: "" })); setFitSlot("token_hair"); }
    setNotice("Возраст меняет пропорции персонажа и сохраняется в проекте. Одежда и предметы выбираются отдельно.");
  }
  function undress() {
    const faceSlots = new Set(["token_headshape", "token_eyes", "token_nose", "token_mouth", "token_brows", "token_hair", "token_beard", "token_scar", "token_freckles", "token_mole"]);
    setSelected(old => Object.fromEntries(Object.entries(old).filter(([slot]) => faceSlots.has(slot))));
    setNotice("Одежда, головные уборы, украшения и все предметы сняты. Внешность и анимация сохранены.");
  }
  function chooseSex(value: TokenSex) {
    setSex(value); setSelected(old => tokenSelectionForSex(old, value));
    setFits(old => Object.fromEntries(Object.entries(old).filter(([slot]) => tokenModuleAllowed(slot, selected[slot] ?? "", value))));
    setFitSlot("token_hair");
    setNotice(value === "female" ? "Женский персонаж: борода и усы сняты. Доступны женские и общие причёски." : "Мужской персонаж: доступны мужские и общие причёски, бороды и усы.");
  }
  function fit(key: keyof TokenFit, value: number) {
    if (Number.isFinite(value)) setFits(old => ({ ...old, [fitSlot]: { ...(old[fitSlot] ?? DEFAULT_TOKEN_FIT), [key]: value } }));
  }
  async function create() {
    setBusy(true); setError("");
    try {
      const resources = await loadTokenAssets();
      const saved = editing ? { ...editing, ...entity, id: editing.id, visuals: editing.visuals, createdAt: editing.createdAt } : entity;
      studioCommit(editing ? "Изменить чиби" : "Добавить персонажа из чиби-пака", p => addTokenToProject(p, saved, resources));
      openAsset({ kind: "entity", id: saved.id }, "animate"); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось добавить персонажа."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className="chibi-pack-dialog">
    <DialogTitle>Чиби-пак · конструктор персонажей</DialogTitle>
    <DialogDescription>4 возраста, 4 основы кожи, {TOKEN_MODULES.length} сменных модулей и {TOKEN_ANIMATIONS.length} клипа. Одежда и реквизит выбираются отдельно.</DialogDescription>
    <div className="chibi-pack-layout"><section className="chibi-pack-preview">
      <div className="chibi-pack-stage" role="img" aria-label="Предпросмотр выбранного чиби" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="chibi-pack-controls">
      <label className="token-preview-zoom">Масштаб просмотра · {Math.round(zoom * 100)} %<input aria-label="Масштаб просмотра" type="range" min={.5} max={2} step={.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
      <label className="field-label">Группа действий<select value={task} onChange={e => { const value = e.target.value; setTask(value); if (!tokenTaskMatches(clipName, value)) chooseClip(TOKEN_ANIMATIONS.find(c => tokenTaskMatches(c.name, value))!.name); }}>{TOKEN_TASKS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
      <VariantPicker label="Анимация" value={clipName} onChange={chooseClip} options={TOKEN_ANIMATIONS.filter(c => tokenTaskMatches(c.name, task)).map(c => ({ value: c.name, label: c.label ?? c.name }))} />
      <p className="context-note">{suggestions.length ? `Подходящие предметы: ${suggestions.join(", ")}. Выберите их справа вручную.` : "Действие работает без предметов."} Выбор анимации ничего не надевает и не добавляет.</p>
      <button type="button" className="action-secondary" onClick={undress}>Снять одежду и предметы</button>
      <label className="field-label">Эмоция<select value={face.emotion} onChange={e => setFace(old => ({ ...old, emotion: e.target.value as typeof face.emotion }))}>{TOKEN_EMOTIONS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}</select></label>
      <div className="dialog-actions"><label><input type="checkbox" checked={face.blink} onChange={e => setFace(old => ({ ...old, blink: e.target.checked }))} /> Моргание</label><label><input type="checkbox" checked={face.mouthMotion} onChange={e => setFace(old => ({ ...old, mouthMotion: e.target.checked }))} /> Движение рта</label></div>
      <p className="context-note">«По анимации»: танец — радость, возмущение — злость, падение — удивление, торговля — разговор. Двигаются только выбранные глаза, брови и рот. Настройки сохраняются вместе с персонажем и работают при экспорте.</p>
      <div className="dialog-actions"><button className="action-secondary" onClick={() => setPlaying(p => !p)}>{playing ? "Пауза" : "Сначала / воспроизвести"}</button><button className="action-secondary" onClick={() => setLeft(v => !v)}>{left ? "← Влево" : "Вправо →"}</button><button className="action-secondary" onClick={() => { setTime(0); setPlaying(false); }}>Исходная поза</button></div>
      <input aria-label="Время анимации" type="range" min={0} max={clip.durationMs} value={time} onChange={e => { setPlaying(false); setTime(Number(e.target.value)); }} />
      <p className="context-note">Анимация двигает только выбранные детали. Оружие, стрелу, переносимый предмет и укрытие выбирайте справа. Движение — на месте; перекат содержит смещение.</p>
      <div className="token-fit-panel"><h3>Подгонка детали</h3><label className="field-label">Что подгоняем<select value={fitSlot} onChange={e => setFitSlot(e.target.value)}>{availableSlots.map(s => <option key={s.id} value={s.id}>{s.name}{selected[s.id] ? "" : " · не выбрано"}</option>)}</select></label>
      {!selected[fitSlot] ? <p className="context-note">Сначала выберите деталь справа, затем настройте её размер и положение.</p> : <>
        {([{ key: "scaleX", label: "Ширина", min: .3, max: 2, step: .01, factor: 100 }, { key: "scaleY", label: "Высота", min: .3, max: 2, step: .01, factor: 100 }, { key: "x", label: "Сдвиг по горизонтали", min: -100, max: 100, step: 1, factor: 1 }, { key: "y", label: "Сдвиг по вертикали", min: -140, max: 140, step: 1, factor: 1 }, { key: "rotation", label: "Поворот", min: -180, max: 180, step: 1, factor: 1 }] as const).map(c => <label className="token-fit-field" key={c.key}><span>{c.label}{c.factor === 100 ? ", %" : c.key === "rotation" ? ", °" : ""}</span><input aria-label={c.label} type="range" min={c.min} max={c.max} step={c.step} value={fitting[c.key]} onChange={e => fit(c.key, Number(e.target.value))} /><input aria-label={`${c.label} точно`} type="number" min={c.min * c.factor} max={c.max * c.factor} step={c.step * c.factor} value={Math.round(fitting[c.key] * c.factor)} onChange={e => fit(c.key, Math.max(c.min, Math.min(c.max, Number(e.target.value) / c.factor)))} /></label>)}
        <button className="action-secondary" onClick={() => setFits(old => ({ ...old, [fitSlot]: { ...DEFAULT_TOKEN_FIT } }))}>Сбросить подгонку детали</button><p className="context-note">Размер меняется вокруг центра детали. Подгонка сохраняется кнопкой «{editing ? "Применить изменения" : "Добавить персонажа"}».</p>
      </>}</div>
      </div>
    </section><section className="chibi-pack-options">
      <label className="field-label token-options-wide">Имя персонажа<input value={name} onChange={e => setName(e.target.value)} maxLength={100} /></label>
      <label className="field-label token-options-wide">Пол<select value={sex} onChange={e => chooseSex(e.target.value as TokenSex)}><option value="male">Мужской</option><option value="female">Женский</option></select></label>
      <VariantPicker label="Возраст" value={age} onChange={v => chooseAge(v as TokenAge)} options={TOKEN_AGES.map(a => ({ value: a.value, label: a.label }))} />
      <p className="context-note">Ребёнок — меньше корпус и крупнее голова; подросток — промежуточные пропорции. Все клипы доступны каждому возрасту. Детям и подросткам бороды не предлагаются.</p>
      <div className="token-options-wide token-random"><button type="button" className="action-primary" onClick={randomizeAppearance}><Shuffle size={18} />Случайная внешность</button><p className="context-note">Кожа, форма головы, глаза, брови, волосы и черты лица. Без одежды, головных уборов и предметов. Результат сохраняется после применения.</p></div>
      <VariantPicker label="Основа" value={String(skin)} onChange={value => chooseSkin(Number(value))} options={TOKEN_SKINS.map((label, i) => ({ value: String(i), label }))} />
      {availableSlots.map(s => <VariantPicker key={s.id} label={s.name} value={selected[s.id] ?? ""} onChange={value => chooseModule(s.id, value)} options={[{ value: "", label: "Без элемента" }, ...TOKEN_MODULES.filter(m => m.slot === s.id && tokenModuleAllowed(m.slot, m.id, sex) && (!m.id.startsWith("heads_") || Math.floor(m.index / 4) === skin)).map(m => ({ value: m.id, label: m.name }))]} />)}
      {sex === "female" && <p className="context-note token-options-wide">Бороды и усы доступны только мужским персонажам. Случайная внешность учитывает выбранный пол.</p>}
      {selected.token_headgear && selected.token_hair && <p className="context-note">Волосы скрыты под головным убором. Снимите его — причёска вернётся.</p>}
      <button className="action-secondary" onClick={() => { setSelected({}); setFits({}); setClipName("idle"); }}>Чистая основа</button>
    </section></div>
    {error && <p role="alert" className="error-message">{error}</p>}
    {notice && <p role="status" className="context-note">{notice}</p>}
    <details><summary>Инструкция и FAQ</summary><p>«Возраст» меняет пропорции рига: ребёнок, подросток, взрослый и пожилой. Детям и подросткам бороды не предлагаются. «Группа действий» фильтрует клипы по задачам. Под анимацией перечислен подходящий реквизит; выберите его вручную в «Оружие / предмет рядом», «Второй рабочий предмет» и «Рабочее место / декорация». «Снять одежду и предметы» сохраняет лицо и действие. В ZIP спрайты поставляются без всех деталей. У токенов нет рук и ног: действия передаются движением корпуса, головы и выбранных плавающих предметов.</p><p>Сначала выберите «Пол»: мужской или женский. Причёски отфильтрованы по полу; общие варианты доступны обоим. Бороды и усы доступны только мужчинам. Смена пола снимает несовместимые детали и не добавляет новые. «Случайная внешность» сохраняет выбранный пол. Пол сохраняется вместе с персонажем.</p><p>«Эмоция» выбирает выражение лица или режим «По анимации». Флажки «Моргание» и «Движение рта» включают движения выбранных деталей лица. Во время торговли рот двигается, в танце появляется радость, при возмущении — злость. Короткие циклы ходьбы и бега не моргают на каждом шаге. Настройки сохраняются вместе с персонажем и работают при экспорте. Если детали нет, анимация её не добавляет.</p><p>Конструктор занимает всю страницу. Переключайте детали кнопками ‹ и › рядом со списком; когда список в фокусе, работают также клавиши ← и →. Переключение идёт по кругу, включая «Без элемента». «Случайная внешность» выбирает кожу, голову, глаза, волосы и черты лица, снимает одежду, головные уборы, украшения и все предметы, сбрасывает подгонку. Имя и анимация сохраняются. До «Применить изменения» объект проекта не меняется.</p><p>Выберите основу, лицо, причёску и одежду. Выберите бороду или шапку — она появится в блоке «Подгонка детали». Настройте ширину, высоту, сдвиг и поворот, затем нажмите «Добавить персонажа» или «Применить изменения». Рот автоматически помещается в свободное место под усами; борода рисуется поверх его краёв. Ручная подгонка рта добавляется к этому положению. Шрамы не рисуются на глазах.</p><p>Головной убор скрывает причёску, снятие возвращает её. Щит следует корпусу; выбор двуручного предмета снимает щит. Выбор клипа никогда не меняет экипировку. Куст, ящик, мешок и прочие реквизиты выбираются как предметы, только по вашему желанию.</p><p>После добавления откройте «Чиби-пак» или «Внешность → Изменить чиби», чтобы поправить подгонку. «Сохранить» сохраняет проект вместе с PNG. «Экспортировать» создаёт кадры выбранных клипов. Первая версия содержит один ракурс и зеркальное отражение; цвета растровых деталей фиксированы.</p><a className="text-primary" href={TOKEN_PACK_PATH + "README.ru.md"} target="_blank" rel="noreferrer">Полное руководство пака</a></details>
    <div className="dialog-actions"><a className="action-secondary" href={TOKEN_PACK_PATH + "chibi-tokens-v1.zip"} download>Скачать весь ассет-пак ZIP</a>{editing && <button className="action-secondary" disabled={busy} onClick={() => { setEditing(null); setName("Новый чиби"); setSex("male"); setAge("adult"); setTask("all"); setFace({ ...DEFAULT_TOKEN_FACE }); setSelected({}); setFits({}); setClipName("idle"); }}>Новый персонаж</button>}<button className="action-secondary" disabled={busy} onClick={onClose}>Закрыть</button><button className="action-primary ml-auto" disabled={busy || !name.trim()} onClick={() => { void create(); }}>{busy ? "Сохраняется…" : editing ? "Применить изменения" : "Добавить персонажа"}</button></div>
  </DialogContent></Dialog>;
}
