import atlasData from "../../public/asset-packs/chibi-tokens-v1/atlases.json";
import type { AnimationClip, AttachmentOverride, Bone, Entity, Item, ItemCategory, LicenseMeta, Project, Template, VisualAsset, VisualContent } from "@/domain/types";
import { enforceTokenEquipment } from "@/lib/chibiEquipment";
import { tokenModuleSex } from "@/lib/chibiGender";
import { tokenAgeAllowsBeard, type TokenAge } from "@/lib/chibiAge";
import { TOKEN_ANIMATIONS } from "./chibiTokenAnimations";

export const TOKEN_PACK_PATH = `${import.meta.env.BASE_URL}asset-packs/chibi-tokens-v1/`;
export const TOKEN_SKINS = ["Тёплая кожа", "Светлая кожа", "Тёмная кожа", "Оливковая кожа"];
export const TOKEN_LICENSE: LicenseMeta = {
  source: "Chibi Tokens v1 · generated with built-in imagegen using user supplied style references",
  author: "AI generation for this project", licenseType: "proprietary", aiGenerated: true,
  commercialUseAllowed: true, purchaseRef: null,
  derivativePolicy: "Generated pack; reference ownership and applicable generation terms remain with the user. Not represented as CC0.",
};
type AtlasName = keyof typeof atlasData;
export interface TokenModule {
  id: string; name: string; atlas: AtlasName; index: number; slot: string; bone: string;
  category: ItemCategory; width: number; height: number; x: number; y: number;
  mirror?: boolean;
  sex?: "male" | "female";
}
const groups: { atlas: AtlasName; names: string[]; slot: string; bone: string; category: ItemCategory; width: number; height: number; x?: number; y?: number }[] = [
  { atlas: "work_clothes", names: ["Детская льняная рубаха", "Детский синий жилет", "Туника подмастерья", "Красная туника подростка", "Мантия короля", "Меховой жилет вождя", "Плащ охотника", "Фартук рыбака", "Рубаха земледельца", "Фартук пекаря", "Фартук кузнеца", "Фартук каменотёса", "Фартук гончара", "Жилет ткача", "Одеяние жреца", "Мантия знахаря"], slot: "token_torso", bone: "chest", category: "torso", width: 132, height: 95 },
  { atlas: "work_tools", names: ["Кирка", "Удочка", "Тесак", "Молоток", "Плетёная корзина", "Мешок семян", "Коса", "Сноп пшеницы", "Пекарская лопата", "Щипцы с заготовкой", "Кузнечные меха", "Кувшин", "Игла и нитки", "Ткацкий станок", "Скребок кожевника", "Скрученная шкура", "Метла", "Деревянный посох", "Сигнальный рог", "Штандарт", "Кадило", "Ступка с травами", "Младенец в пелёнках", "Лопата"], slot: "token_main", bone: "token_weapon", category: "weapon_main", width: 55, height: 100, y: -25 },
  { atlas: "work_stations", names: ["Наковальня", "Бочка с водой", "Гончарный круг", "Печь", "Жернов", "Тесто", "Очаг", "Миска с хлебом", "Полевые цветы", "Корзина с уловом", "Ведро руды", "Связка досок", "Связка брёвен", "Корзина рассады", "Кирпичи", "Рама со шкурой", "Раскрытый свиток", "Подарок", "Носилки", "Могильная насыпь", "Маленький кувшин", "Вязанка хвороста", "Монеты", "Яблоко"], slot: "token_main", bone: "token_weapon", category: "weapon_main", width: 65, height: 60 },
  { atlas: "work_extra", names: ["Охотничья добыча", "Зубило", "Низкий табурет", "Миска с рыбой", "Колыбель", "Рулон ткани", "Глиняная табличка", "Верстак"], slot: "token_main", bone: "token_weapon", category: "weapon_main", width: 65, height: 60 },
  { atlas: "heads", names: TOKEN_SKINS.flatMap(s => ["Круглая голова", "Овальная голова", "Квадратная челюсть", "Острый подбородок и ухо"].map(n => `${n} · ${s}`)), slot: "token_headshape", bone: "head", category: "face", width: 134, height: 156, y: -70 },
  { atlas: "face", names: ["Карие глаза", "Зелёные глаза", "Голубые глаза", "Янтарные глаза", "Сонные глаза", "Сердитые глаза", "Весёлые глаза", "Удивлённые глаза"], slot: "token_eyes", bone: "head", category: "eyes", width: 65, height: 25, x: 10, y: -66 },
  { atlas: "hair", names: ["Растрёпанные каштановые", "Светлая чёлка", "Рыжее каре", "Тёмные волны", "Каштановый хвост", "Рыжие косы", "Короткие чёрные", "Серебристые длинные"], slot: "token_hair", bone: "head", category: "hair", width: 149, height: 139, y: -85 },
  { atlas: "clothes", names: ["Рубаха и жилет", "Туника следопыта", "Мантия мага", "Кожаная броня", "Стёганый доспех", "Стальная броня", "Доспех паладина", "Камзол торговца"], slot: "token_torso", bone: "chest", category: "torso", width: 130, height: 91 },
  { atlas: "helmets", names: ["Открытый стальной шлем", "Закрытый рыцарский шлем", "Кожаный шлем", "Капюшон", "Рогатый шлем", "Крылатый шлем", "Шляпа мага", "Берет с пером"], slot: "token_headgear", bone: "head", category: "head_cover", width: 150, height: 151, y: -72 },
  { atlas: "weapons", names: ["Лук", "Копьё", "Меч", "Двуручный меч", "Топор", "Булава", "Круглый щит", "Стрела"], slot: "token_main", bone: "token_weapon", category: "weapon_main", width: 36, height: 128, y: -40 },
  { atlas: "props", names: ["Мешок", "Ящик", "Кошелёк с монетами", "Мотыга", "Свиток", "Крючок с верёвкой", "Куст", "Деревянная подставка"], slot: "token_main", bone: "token_weapon", category: "weapon_main", width: 52, height: 48 },
  { atlas: "extras", names: ["Короткая борода", "Борода викинга", "Седая борода", "Рыжие усы", "Эспаньолка", "Повязка на глаз", "Диадема", "Щетина"], slot: "token_beard", bone: "head", category: "beard", width: 81, height: 60, x: 7, y: -20 },
  { atlas: "hair_plus", names: ["Каштановые кудри", "Чёрный высокий пучок", "Светлые хвостики", "Рыжая стрижка набок", "Пепельный пробор", "Длинная каштановая коса", "Рыжие волны до плеч", "Чёрные мелкие кудри"], slot: "token_hair", bone: "head", category: "hair", width: 149, height: 139, y: -85 },
  { atlas: "hair_extra", names: ["Каштановая короткая стрижка", "Светлые зачёсанные назад", "Рыжий волнистый пробор", "Чёрный высокий хвост", "Серебристое каре", "Каштановая корона из кос", "Рыжая боковая коса", "Тёмный андеркат"], slot: "token_hair", bone: "head", category: "hair", width: 153, height: 145, y: -88 },
  { atlas: "beards_extra", names: ["Тёмная аккуратная борода", "Рыжая округлая борода", "Светлая бородка и усы", "Каштановая заострённая борода", "Седая раздвоенная борода", "Тёмная борода по челюсти", "Каштановые усы подковой", "Седые опущенные усы"], slot: "token_beard", bone: "head", category: "beard", width: 92, height: 60, x: 7, y: -10 },
  { atlas: "brows_extra", names: ["Тёмные прямые брови", "Тонкие дуги", "Обеспокоенные каштановые", "Рыжие пушистые", "Серебристые строгие", "Светлые озорные", "Тёмные скептические", "Каштановые нахмуренные"], slot: "token_brows", bone: "head", category: "face", width: 67, height: 16, x: 10, y: -87 },
  { atlas: "noses_extra", names: ["Нос пуговкой", "Округлый широкий нос", "Короткий угловатый нос", "Длинный тонкий нос", "Нос с широкой переносицей", "Курносый нос", "Римский нос", "Маленький треугольный нос"], slot: "token_nose", bone: "head", category: "face", width: 14, height: 20, x: 14, y: -46 },
  { atlas: "face_plus", names: ["Фиолетовые любопытные", "Бирюзовые миндалевидные", "Серые серьёзные", "Тёмный прищур", "Карие с ресницами", "Зелёные круглые", "Синие смеющиеся", "Янтарные встревоженные", "Тонкие изогнутые брови", "Прямые чёрные брови", "Густые светлые брови", "Дугообразные рыжие брови", "Сердитый прищур с бровями", "Приподнятые каштановые брови", "Мягкие серебристые брови", "Кустистые седые брови", "Спокойный рот", "Усмешка", "Радостная улыбка", "Недовольный рот", "Печальный рот", "Удивлённый рот", "Стиснутые зубы", "Смех с языком"], slot: "token_eyes", bone: "head", category: "eyes", width: 65, height: 25, x: 10, y: -66 },
];
export const TOKEN_MODULES: TokenModule[] = groups.flatMap(g => g.names.map((name, index) => ({
  id: `${g.atlas}_${index}`, name, atlas: g.atlas, index, slot: g.slot, bone: g.bone, category: g.category,
  width: g.width, height: g.height, x: g.x ?? 0, y: g.y ?? 0,
})));
for (const [index, name, slot, w, h, x, y] of [
  [8, "Нос крючком", "token_nose", 14, 20, 14, -46], [9, "Прямой нос", "token_nose", 14, 20, 14, -46],
  [10, "Улыбка", "token_mouth", 28, 8, 12, -29], [11, "Открытый рот", "token_mouth", 15, 16, 12, -29],
  [12, "Шрам со швами", "token_scar", 23, 33, -12, -52], [13, "Перекрёстный шрам", "token_scar", 28, 28, -12, -52],
  [14, "Веснушки", "token_freckles", 57, 20, 10, -43], [15, "Густые брови", "token_brows", 67, 19, 10, -85],
] as const) TOKEN_MODULES.push({ id: `face_${index}`, name, atlas: "face", index, slot, bone: "head", category: "face", width: w, height: h, x, y });
for (const [index, name, slot, width, height, x, y] of [
  ...["Тёмные добрые глаза", "Бирюзовый прищур", "Ореховые задумчивые", "Фиолетовые раскосые", "Янтарные кошачьи", "Синие любопытные", "Карий прищур", "Серые сонные"].map((name, i) => [i, name, "token_eyes", 65, 25, 10, -66] as const),
  ...["Мягкая улыбка", "Кривая усмешка", "Маленькая открытая улыбка", "Нейтральные губы", "Поджатые губы", "Сердитый открытый рот", "Широкая зубастая улыбка", "Обеспокоенные губы"].map((name, i) => [16 + i, name, "token_mouth", 27, i === 2 || i === 5 || i === 6 ? 15 : 8, 12, -29] as const),
  ...["Косой шрам на щеке", "Шрам со стежками", "Две царапины", "Шрам крестиком"].map((name, i) => [24 + i, name, "token_scar", 23, 30, -12, -52] as const),
  [28, "Редкие веснушки", "token_freckles", 57, 18, 10, -43], [29, "Густые веснушки", "token_freckles", 57, 20, 10, -43],
  [30, "Родинка на щеке", "token_mole", 4, 4, 29, -38], [31, "Три родинки", "token_mole", 11, 12, -19, -43],
] as const) TOKEN_MODULES.push({ id: `face_extra_${index}`, name, atlas: "face_extra", index, slot, bone: "head", category: slot === "token_eyes" ? "eyes" : "face", width, height, x, y });
function amend(id: string, patch: Partial<TokenModule>) { Object.assign(TOKEN_MODULES.find(m => m.id === id)!, patch); }
for (let i = 8; i < 16; i++) if (i !== 12) amend(`face_plus_${i}`, { slot: "token_brows", category: "face", width: 67, height: 16, y: -87 });
for (let i = 0; i < 16; i++) amend(`heads_${i}`, { width: [134, 118, 132, 124][i % 4] });
for (let i = 16; i < 24; i++) amend(`face_plus_${i}`, { slot: "token_mouth", category: "face", width: i === 21 ? 12 : 27, height: i === 16 || i === 17 || i === 19 || i === 20 ? 8 : 16, x: 12, y: -29 });

// Measure each tool by its silhouette, not a square icon box.
for (const [index, width, height] of [[0,65,120],[1,85,160],[2,38,82],[3,48,86],[4,63,54],[5,52,52],[6,72,140],[7,55,90],[8,37,130],[9,50,90],[10,75,45],[11,42,65],[12,45,45],[13,92,90],[14,32,70],[15,65,45],[16,55,125],[17,22,155],[18,68,58],[19,55,150],[20,42,80],[21,55,48],[22,47,72],[23,38,125]]) amend(`work_tools_${index}`, { width, height, y: height > 80 ? -height / 3 : 0 });
for (const index of [0,1,2,3,4,5,6,14,15,19]) amend(`work_stations_${index}`, { slot: "token_station", bone: "token_station", category: "static_part", width: index === 3 ? 115 : 90, height: index === 3 ? 115 : 75, y: index === 3 ? -50 : -32 });
for (const index of [2,4,7]) amend(`work_extra_${index}`, { slot: "token_station", bone: "token_station", category: "static_part", width: 95, height: 70, y: -30 });
amend("work_extra_0", { width: 100, height: 65 });
amend("work_extra_1", { width: 20, height: 65, y: -15 });
amend("work_stations_18", { width: 125, height: 55 });
for (const m of TOKEN_MODULES.filter(m => m.atlas === "work_tools" || m.id === "work_extra_1")) TOKEN_MODULES.push({ ...m, id: `${m.id}_support`, name: `${m.name} · второй предмет`, slot: "token_support", bone: "token_support" });

// Fit each scalp separately; long tails must not determine the scalp's scale.
amend("hair_2", { width: 147, height: 154, y: -82 });
amend("hair_3", { width: 165, height: 170, x: -2, y: -87 });
amend("hair_4", { width: 155, height: 163, y: -82 });
amend("hair_5", { width: 162, height: 177, y: -72 });
amend("hair_6", { width: 148, height: 123, y: -94 });
amend("hair_7", { width: 167, height: 174, x: -2, y: -89 });
amend("hair_plus_1", { height: 171, y: -101 });
amend("hair_plus_2", { width: 172, height: 145, y: -85 });
amend("hair_plus_5", { height: 173, y: -72 });
amend("hair_plus_6", { width: 162, height: 170, y: -78 });
for (let i = 0; i < 8; i++) amend(`hair_extra_${i}`, { mirror: true });
amend("hair_extra_1", { width: 160, height: 153, y: -88 });
amend("hair_extra_2", { width: 164, height: 156, y: -86 });
amend("hair_extra_3", { width: 174, height: 186, x: -5, y: -99 });
amend("hair_extra_4", { width: 159, height: 157, y: -83 });
amend("hair_extra_5", { width: 157, height: 153, y: -91 });
amend("hair_extra_6", { width: 156, height: 181, y: -73 });
amend("hair_extra_7", { width: 158, height: 145, y: -91 });
amend("beards_extra_0", { width: 94, height: 50, y: -17 });
amend("beards_extra_1", { width: 94, height: 52, y: -17 });
amend("beards_extra_2", { width: 73, height: 64, y: -10 });
amend("beards_extra_3", { width: 94, height: 64, y: -10 });
amend("beards_extra_4", { width: 94, height: 54, y: -15 });
amend("beards_extra_5", { width: 94, height: 48, y: -15 });
amend("beards_extra_6", { width: 57, height: 19, x: 12, y: -27 });
amend("beards_extra_7", { width: 60, height: 19, x: 12, y: -27 });
amend("weapons_0", { width: 39, height: 130, y: -28 });
amend("weapons_1", { width: 22, height: 181, y: -65 });
amend("weapons_2", { width: 37, height: 115, y: -37 });
amend("weapons_3", { width: 43, height: 160, y: -52 });
amend("weapons_4", { width: 50, height: 123, y: -41 });
amend("weapons_5", { width: 34, height: 118, y: -40 });
amend("weapons_6", { width: 70, height: 70, slot: "token_off", bone: "token_offhand", category: "shield", y: 0 });
amend("weapons_7", { width: 12, height: 80, slot: "token_projectile", bone: "token_arrow", y: 0 });
amend("props_3", { width: 45, height: 132, y: -42 });
amend("props_5", { width: 32, height: 64, slot: "token_hook", bone: "token_hook", x: 0, y: 0, category: "static_part" });
amend("props_6", { width: 170, height: 115, slot: "token_cover", bone: "token_cover", category: "static_part", y: -53 });
amend("props_7", { width: 134, height: 38, slot: "token_base", bone: "token_base", category: "static_part", y: 8 });
amend("extras_0", { width: 98, height: 50, y: -15 });
amend("extras_1", { width: 96, height: 78, y: -4 });
amend("extras_2", { width: 96, height: 90, y: 1 });
amend("extras_3", { width: 59, height: 16, x: 12, y: -29 });
amend("extras_4", { width: 38, height: 39, y: -14 });
amend("extras_5", { slot: "token_patch", category: "face", width: 76, height: 48, x: 0, y: -63 });
amend("extras_6", { slot: "token_circlet", category: "face", width: 119, height: 40, x: 0, y: -100 });
amend("extras_7", { width: 94, height: 48, y: -16 });
amend("helmets_4", { height: 180, width: 163, y: -86 });
amend("helmets_5", { height: 171, width: 169, y: -75 });
amend("helmets_6", { height: 125, width: 175, y: -119 });
amend("helmets_7", { height: 96, width: 145, y: -116 });

// Mouth openings, rather than the atlas rectangle, determine the jaw placement.
amend("extras_0", { x: 12, y: -30 });
amend("extras_1", { x: 12, y: -12 });
amend("extras_2", { x: 12, y: -7 });
amend("extras_3", { y: -37 });
amend("extras_4", { height: 28, x: 12, y: -11 });
amend("extras_7", { y: -28, x: 4, height: 42 });
amend("beards_extra_0", { x: 1, y: -31 });
amend("beards_extra_1", { x: 2, y: -30 });
amend("beards_extra_2", { x: 6, y: -28 });
amend("beards_extra_3", { x: 3, y: -25 });
amend("beards_extra_4", { x: 2, y: -30 });
amend("beards_extra_5", { width: 94, height: 42, x: 1, y: -28 });
amend("beards_extra_6", { y: -33 });
amend("beards_extra_7", { y: -33 });
for (const m of TOKEN_MODULES.filter(m => m.slot === "token_scar")) Object.assign(m, { x: -22, y: -32, width: 21, height: 25 });
for (const m of TOKEN_MODULES) m.sex = m.slot === "token_beard" ? "male" : tokenModuleSex(m.id);

/** Atlas coordinates are represented by existing composite content, preserving source PNGs. */
export function tokenRegion(atlas: AtlasName, index: number, width: number, height: number, mirror = false): VisualContent {
  const a = atlasData[atlas], [x, y, w, h] = a.rects[index];
  return { kind: "composite", width, height, children: [{ content: { kind: "raster", assetId: `token_atlas_${atlas}` },
    matrix: [mirror ? -a.width / w : a.width / w, 0, 0, a.height / h, mirror ? (x + w) * width / w : -x * width / w, -y * height / h], opacity: 1 }] };
}
export function tokenPreviewAssets(): Record<string, VisualAsset> {
  return Object.fromEntries(Object.entries(atlasData).map(([id, a]) => [`token_atlas_${id}`, {
    id: `token_atlas_${id}`, name: `Чиби · ${id}`, width: a.width, height: a.height, mimeType: "image/png", dataUri: TOKEN_PACK_PATH + a.file,
  }]));
}
export async function loadTokenAssets(): Promise<Record<string, VisualAsset>> {
  const entries = await Promise.all(Object.entries(tokenPreviewAssets()).filter(([id]) => !id.endsWith("_base")).map(async ([id, a]) => {
    const response = await fetch(a.dataUri);
    if (!response.ok) throw new Error(`Не удалось загрузить ${a.name}. Повторите загрузку пака.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    return [id, { ...a, dataUri: `data:image/png;base64,${btoa(chunks.join(""))}` }] as const;
  }));
  return Object.fromEntries(entries);
}
function bone(id: string, name: string, parentId: string | null, tx: number, ty: number): Bone {
  return { id, name, parentId, length: 12, restPose: { tx, ty, rotation: 0, scaleX: 1, scaleY: 1 } };
}
const slotLabels: Record<string, string> = { token_station: "Рабочее место / декорация", token_support: "Второй рабочий предмет", token_headshape: "Форма головы / ушей", token_eyes: "Глаза", token_hair: "Причёска", token_torso: "Одежда и броня", token_headgear: "Шлем / головной убор", token_main: "Оружие / предмет рядом", token_off: "Щит", token_projectile: "Стрела", token_beard: "Борода / усы", token_nose: "Нос", token_mouth: "Рот", token_scar: "Шрам", token_freckles: "Веснушки", token_mole: "Родинки", token_brows: "Брови", token_patch: "Повязка", token_circlet: "Диадема", token_cover: "Укрытие", token_hook: "Крючок", token_base: "Подставка" };
const depths: Record<string, number> = { token_station: -940, token_support: -585, token_headshape: -789, token_base: -980, token_torso: -850, token_eyes: -720, token_nose: -715, token_mouth: -702, token_freckles: -709, token_mole: -707, token_scar: -708, token_brows: -705, token_beard: -700, token_hair: -690, token_patch: -680, token_circlet: -675, token_headgear: -670, token_hook: -660, token_main: -600, token_off: -590, token_projectile: -580, token_cover: -500 };
export function tokenTemplate(skin = 0): Template {
  const id = `chibi_token_skin_${skin}`;
  return {
    id, name: `Чиби-токен · ${TOKEN_SKINS[skin]}`, description: "Рисованный чиби без рук и ног. Модульное лицо, одежда и плавающее оружие.",
    skeletonFamily: "chibi_token_v1", rigFamilyId: "chibi_token_v1", viewProfile: "side_view", defaultFacing: "east", entityTypes: ["character"],
    bones: [bone("root", "Весь персонаж", null, 0, 0), bone("chest", "Корпус", "root", 0, -42), bone("head", "Голова", "chest", 0, -30),
      bone("token_weapon", "Предмет справа", "root", 85, -63), bone("token_offhand", "Щит у корпуса", "chest", -54, -16),
      bone("token_arrow", "Стрела", "root", 85, -63), bone("token_cover", "Укрытие", "root", 0, 0), bone("token_hook", "Крючок", "root", 105, -153), bone("token_base", "Подставка", "root", 0, 0), bone("token_support", "Второй рабочий предмет", "root", -75, -70), bone("token_station", "Рабочее место", "root", 140, 0)],
    slots: Object.entries(slotLabels).map(([slot, name]) => {
      const modules = TOKEN_MODULES.filter(m => m.slot === slot);
      return { id: slot, name, boneId: modules[0].bone, zIndex: depths[slot], allowedCategories: [...new Set(modules.map(m => m.category))], required: false, defaultItemId: null };
    }), anchors: {}, paletteTokens: { skin: ["#C19A73", "#F0C6A2", "#765035", "#8A8C64"][skin], hair: "#62432C", primaryCloth: "#5E4932", secondaryCloth: "#7C8141", metal: "#AAA9A3", accent: "#CAA34F", outline: "#21180F", shadow: "#00000033" },
    baseBodyLayers: [], boneParts: [
      { id: "token_body", boneId: "chest", content: tokenRegion("anatomy", skin + 4, 124, 92), naturalWidth: 124, naturalHeight: 92, localX: 0, localY: 0, zOffset: -900 },
      { id: "token_head", boneId: "head", content: tokenRegion("anatomy", skin, 134, 156), naturalWidth: 134, naturalHeight: 156, localX: 0, localY: -70, zOffset: -790 },
    ], previewWidth: 256, previewHeight: 256, thumbnailSvg: "",
  };
}
export function tokenItems(): Item[] {
  return TOKEN_MODULES.map(m => ({
    id: `token_item_${m.id}`, name: m.name, description: "Чиби-токены v1 · отдельный модуль рисованного атласа", category: m.category,
    compatibility: { skeletonFamilies: ["chibi_token_v1"], species: [], viewProfiles: ["side_view"] }, allowedSlots: [m.slot], fitProfile: "standard",
    paletteChannels: [], hasOwnAnimation: false, animationClipId: null, anchorRules: {}, svgLayers: [], coordinateMode: "bone_local",
    parts: [{ id: `part_${m.id}`, boneId: m.bone, content: tokenRegion(m.atlas, m.index, m.width, m.height, m.mirror),
      metrics: { viewBoxX: 0, viewBoxY: 0, viewBoxWidth: m.width, viewBoxHeight: m.height, visualMinX: 0, visualMinY: 0, visualWidth: m.width, visualHeight: m.height },
      pivot: { x: 0, y: 0, preset: "custom" }, localTransform: { x: m.x - m.width / 2, y: m.y - m.height / 2, rotation: 0, scaleX: 1, scaleY: 1 }, coordinateMode: "bone_local", zOffset: 0 }],
    licenseMeta: { ...TOKEN_LICENSE }, tags: ["чиби", "токен", "chibi-tokens-v1", m.atlas, ...(["helmets_1", "helmets_5"].includes(m.id) ? ["token-closed-headgear"] : [])],
  }));
}
export function tokenClips(templateId: string): AnimationClip[] {
  return TOKEN_ANIMATIONS.map(c => ({ ...c, id: `${templateId}__${c.name}`, templateId }));
}
export interface TokenFit { x: number; y: number; scaleX: number; scaleY: number; rotation: number }
export const DEFAULT_TOKEN_FIT: TokenFit = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
export function tokenFitOverride(m: TokenModule, f: TokenFit): Partial<AttachmentOverride> {
  const a = f.rotation * Math.PI / 180, cx = m.x * f.scaleX, cy = m.y * f.scaleY;
  return { offsetX: m.x + f.x - (cx * Math.cos(a) - cy * Math.sin(a)), offsetY: m.y + f.y - (cx * Math.sin(a) + cy * Math.cos(a)), scaleX: f.scaleX, scaleY: f.scaleY, rotation: f.rotation };
}
export function tokenFitFromOverride(m: TokenModule, o: Partial<AttachmentOverride>): TokenFit {
  const f = { ...DEFAULT_TOKEN_FIT, scaleX: o.scaleX ?? 1, scaleY: o.scaleY ?? 1, rotation: o.rotation ?? 0 };
  const a = f.rotation * Math.PI / 180, cx = m.x * f.scaleX, cy = m.y * f.scaleY;
  return { ...f, x: (o.offsetX ?? 0) + cx * Math.cos(a) - cy * Math.sin(a) - m.x, y: (o.offsetY ?? 0) + cx * Math.sin(a) + cy * Math.cos(a) - m.y };
}
export function tokenEntity(name: string, skin: number, selected: Record<string, string>, clipName = "idle", fits: Record<string, TokenFit> = {}, sex: "male" | "female" = tokenModuleSex(selected.token_hair) ?? "male", age: TokenAge = "adult"): Entity {
  const t = tokenTemplate(skin), now = Date.now();
  return { id: crypto.randomUUID(), name, entityType: "character", templateId: t.id, styleSetId: "dark_fantasy", species: "",
    palette: t.paletteTokens, slots: enforceTokenEquipment(t.slots.map(s => { const m = s.id === "token_beard" && !tokenAgeAllowsBeard(age) ? undefined : TOKEN_MODULES.find(m => m.id === selected[s.id]); return { slotId: s.id, itemId: m ? `token_item_${m.id}` : null, paletteOverride: {}, attachmentOverride: m && fits[s.id] ? tokenFitOverride(m, fits[s.id]) : {} }; }), "token_main"),
    visuals: [], appearance: { sex, tokenAge: age, slimness: 0, muscle: 0, fat: 0, nose: "none", freckles: false, mole: false, scar: "none", view: "right", projection: "authored" },
    activeAnimationClipId: `${t.id}__${clipName}`, activeStateMachineId: null, licenseMeta: { ...TOKEN_LICENSE }, createdAt: now, updatedAt: now };
}
/** Adds to the existing project; never replaces the user's current project or assets. */
export function refreshTokenPackDefinitions(p: Project) {
  for (const old of p.templates.filter(t => t.skeletonFamily === "chibi_token_v1")) {
    const skin = Number(old.id.split("_").at(-1));
    if (!Number.isInteger(skin) || skin < 0 || skin > 3) continue;
    const fresh = tokenTemplate(skin);
    // Keep authored bones and parts; update the pack's slot depths and shield bind.
    old.slots = fresh.slots;
    for (const b of fresh.bones) if (!old.bones.some(existing => existing.id === b.id)) old.bones.push(b);
    const off = old.bones.find(b => b.id === "token_offhand");
    if (off?.parentId === "root" && off.restPose.tx === -80) Object.assign(off, fresh.bones.find(b => b.id === "token_offhand"));
  }
  for (const fresh of tokenItems()) {
    const existing = p.items.find(i => i.id === fresh.id);
    if (existing && !existing.parts?.some(part => part.editorDocumentId || part.source)) Object.assign(existing, fresh);
  }
  for (const e of p.entities.filter(e => e.templateId.startsWith("chibi_token_skin_"))) e.slots = enforceTokenEquipment(e.slots, "token_main");
}
export function addTokenToProject(p: Project, entity: Entity, assets: Record<string, VisualAsset>) {
  const skin = Number(entity.templateId.split("_").at(-1)), template = tokenTemplate(skin);
  p.assets = { ...p.assets, ...assets };
  const oldTemplate = p.templates.find(t => t.id === template.id);
  if (!oldTemplate) p.templates.push(template);
  const ids = new Set(p.items.map(i => i.id)); p.items.push(...tokenItems().filter(i => !ids.has(i.id)));
  const clips = new Set(p.animationClips.map(c => c.id)); p.animationClips.push(...tokenClips(template.id).filter(c => !clips.has(c.id)));
  const index = p.entities.findIndex(e => e.id === entity.id);
  if (index >= 0) p.entities[index] = entity; else p.entities.push(entity);
  p.activeEntityId = entity.id;
  refreshTokenPackDefinitions(p);
}
