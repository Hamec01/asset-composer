import type { CharacterAppearance, FaceFeatureKey } from "@/domain/types";

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  view: "right",
  sex: "male", slimness: 0, muscle: 0, fat: 0, nose: "none",
  freckles: false, mole: false, scar: "none",
  freckleStyle: "light", freckleIntensity: .65,
};
export const NOSE_PRESETS = [
  { id: "none", label: "Нет" }, { id: "button", label: "Кнопка" },
  { id: "small", label: "Маленький" }, { id: "straight", label: "Прямой" },
  { id: "pointed", label: "Острый" }, { id: "rounded", label: "Округлый" },
  { id: "broad", label: "Широкий" }, { id: "upturned", label: "Курносый" },
  { id: "aquiline", label: "С горбинкой" },
];
export const FRECKLE_PRESETS = [
  { id: "none", label: "Нет" }, { id: "light", label: "Редкие" },
  { id: "nose", label: "На переносице" }, { id: "dense", label: "Россыпь" },
  { id: "full", label: "По всему лицу" },
];
export const SCAR_PRESETS = [
  { id: "none", label: "Нет" }, { id: "cheek", label: "На щеке" },
  { id: "brow", label: "Через бровь" }, { id: "eye", label: "Через глаз" },
  { id: "cross", label: "Крестик" }, { id: "lip", label: "У губы" },
  { id: "temple", label: "На виске" }, { id: "claw", label: "Три царапины" },
  { id: "long", label: "Длинный" },
];
export const APPEARANCE_PRESETS: Record<FaceFeatureKey, { id: string; label: string }[]> = {
  eyes: [
    { id: "none", label: "Нет" }, { id: "dot_cute", label: "Маленькие" },
    { id: "round_kawaii", label: "Большие" }, { id: "wide_shine", label: "С бликом" },
    { id: "almond", label: "Миндалевидные" }, { id: "sleepy", label: "Прищур" },
    { id: "iris_round", label: "Круглые с радужкой" }, { id: "iris_almond", label: "Узкие с радужкой" },
    { id: "cat", label: "Кошачьи" }, { id: "sharp", label: "Острые" },
    { id: "tired", label: "Усталые" }, { id: "closed_happy", label: "Смеющиеся" },
    { id: "wink", label: "Подмигивание" }, { id: "surprised", label: "Удивлённые" },
    { id: "sparkle", label: "Звёздочки" }, { id: "round_soft", label: "Мягкие с ресницами" },
  ],
  brows: [
    { id: "none", label: "Нет" }, { id: "soft_arc", label: "Мягкие" },
    { id: "straight", label: "Прямые" }, { id: "thick", label: "Густые" },
    { id: "stern", label: "Суровые" }, { id: "worried", label: "Приподнятые" },
  ],
  mouth: [
    { id: "none", label: "Нет" }, { id: "tiny_smile", label: "Улыбка" },
    { id: "neutral", label: "Нейтральный" }, { id: "open_smile", label: "Открытый" },
    { id: "lips", label: "Губы" }, { id: "frown", label: "Недовольный" },
    { id: "thin_lips", label: "Тонкие губы" }, { id: "full_lips", label: "Полные губы" },
    { id: "heart_lips", label: "Губы сердечком" }, { id: "pout", label: "Надутые губы" },
    { id: "smirk", label: "Усмешка" }, { id: "grin", label: "Улыбка с зубами" },
    { id: "surprised_o", label: "Удивление" },
  ],
  hair: [
    { id: "none", label: "Без волос" }, { id: "messy_short", label: "Взъерошенные" },
    { id: "fringe_short", label: "Короткие" }, { id: "bob", label: "Каре" },
    { id: "long", label: "Длинные" }, { id: "ponytail", label: "Хвост" },
    { id: "tuft", label: "Ирокез" }, { id: "curls", label: "Кудри" },
    { id: "pixie", label: "Пикси" }, { id: "side_part", label: "Боковой пробор" },
    { id: "swept_back", label: "Зачёс назад" }, { id: "undercut", label: "Андеркат" },
    { id: "twin_tails", label: "Два хвоста" }, { id: "buns", label: "Два пучка" },
    { id: "braid", label: "Коса" }, { id: "wavy_long", label: "Длинные волны" },
    { id: "bowl", label: "Горшок" }, { id: "buzz", label: "Ёжик" },
  ],
  beard: [
    { id: "none", label: "Нет" }, { id: "short_goatee", label: "Эспаньолка" },
    { id: "full_short", label: "Короткая" },
  ],
};

export function chibiFeatureSvg(feature: FaceFeatureKey | "nose" | "marks", id: string, color: string, appearance = DEFAULT_APPEARANCE, thumbnail = false): string | null {
  if (id === "none" && feature !== "marks") return null;
  let art = "";
  const line = (d: string, width = 0.8, ink = color) => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (feature === "eyes") {
    const rx = id === "dot_cute" ? 1.35 : id === "wide_shine" ? 2.8 : 2.05;
    const ry = id === "dot_cute" ? 2.15 : id === "wide_shine" ? 3.6 : 3;
    const positions = appearance.view && appearance.view !== "front" ? [-2, 11] : [-7, 7];
    for (const [index, x] of positions.entries()) {
      let eye = "";
      if (id === "sleepy" || id === "wink" && index === 1) eye = line("M-2.4 4 Q0 6 2.4 4", 1);
      else if (id === "closed_happy") eye = line("M-2.6 5 Q0 0 2.6 5", 1.1);
      else if (id === "iris_round" || id === "iris_almond" || id === "cat") {
        const shape = id === "iris_round" ? '<ellipse cx="0" cy="4" rx="3" ry="3.5"' : '<path d="M-3.5 4 Q0 -.5 3.5 4 Q0 7.5 -3.5 4Z"';
        eye = `${shape} fill="#fff8ef" stroke="${color}" stroke-width=".65"/>`
          + `<ellipse cx=".2" cy="4" rx="${id === "iris_round" ? 1.9 : 1.6}" ry="2.3" fill="${color}"/>`
          + `<ellipse cx=".2" cy="4.2" rx="${id === "cat" ? .4 : .8}" ry="1.6" fill="#201918"/>`
          + '<circle cx=".8" cy="2.8" r=".6" fill="white"/>';
        if (id === "cat") eye += line("M2.8 3 L4 1.8", .75);
      } else if (id === "sharp") eye = `<path d="M-3.2 1.8 L3 3 Q1.5 7 -1 6Z" fill="${color}"/><circle cx=".8" cy="3.7" r=".6" fill="white"/>`;
      else if (id === "tired") eye = `<path d="M-2.6 3 H2.6 Q2.2 7 0 7 Q-2.2 7 -2.6 3Z" fill="${color}"/>` + line("M-2 8 Q0 8.8 2 8", .45);
      else if (id === "surprised") eye = `<ellipse cx="0" cy="4" rx="2.8" ry="3.8" fill="#fff8ef" stroke="${color}" stroke-width=".7"/><ellipse cx="0" cy="4" rx=".9" ry="1.6" fill="${color}"/>`;
      else if (id === "sparkle") eye = `<path d="M0 .3 L.9 2.6 L3.3 3 L1.5 4.8 L2 7.3 L0 6 L-2 7.3 L-1.5 4.8 L-3.3 3 L-.9 2.6Z" fill="${color}"/>`;
      else {
        eye = `<ellipse cx="0" cy="4" rx="${id === "round_soft" ? 2.6 : rx}" ry="${id === "round_soft" ? 3.4 : ry}" fill="${color}"/>`;
        if (id === "wide_shine" || id === "round_soft") eye += '<circle cx=".8" cy="2.8" r=".8" fill="white"/><circle cx="-.7" cy="5.8" r=".35" fill="white"/>';
        if (id === "round_soft") eye += line(`M${index === 0 ? "-2 1 L-3 .1" : "2 1 L3 .1"}`, .7);
        if (id === "almond") eye = `<path d="M-3 4 Q0 0 3 4 Q0 7 -3 4Z" fill="${color}"/><circle cx=".7" cy="3.1" r=".65" fill="white"/>`;
      }
      art += `<g transform="translate(${x} 0) scale(${x === 11 ? .8 : 1} 1)">${eye}</g>`;
    }
  } else if (feature === "brows") {
    const paths: Record<string, string> = {
      soft_arc: "M-10 -2 Q-7 -4 -4 -2 M4 -2 Q7 -4 10 -2",
      straight: "M-10 -3 H-4 M4 -3 H10", thick: "M-10 -3 Q-7 -4 -4 -3 M4 -3 Q7 -4 10 -3",
      stern: "M-10 -4 L-4 -1 M4 -1 L10 -4", worried: "M-10 -1 L-4 -4 M4 -4 L10 -1",
    };
    art = line(paths[id] ?? paths.soft_arc, id === "thick" ? 1.8 : 0.85);
  } else if (feature === "mouth") {
    const lipArt: Record<string, string> = {
      thin_lips: `<path d="M-3 12 Q0 10.8 3 12 Q0 13.5 -3 12Z" fill="${color}"/>` + line("M-2.5 12 H2.5", .4, "#713d3e"),
      full_lips: `<path d="M-3.5 12 Q-1 9.5 0 11 Q1 9.5 3.5 12 Q2 15.5 0 15 Q-2 15.5 -3.5 12Z" fill="${color}"/>` + line("M-3 12 Q0 13 3 12", .45, "#713d3e"),
      heart_lips: `<path d="M0 12 C-4 7 -5 13 0 15 C5 13 4 7 0 12Z" fill="${color}"/>`,
      pout: `<ellipse cx="0" cy="12" rx="2.2" ry="1.6" fill="${color}"/>` + line("M-1.3 12 H1.3", .45, "#713d3e"),
      smirk: line("M-2.5 12 Q1 14 3 10 M2.5 10 H3.8"),
      grin: `<path d="M-4 11 Q0 13 4 11 Q3 17 0 17 Q-3 17 -4 11Z" fill="${color}"/><path d="M-3 12 Q0 13.5 3 12 L2.5 14 H-2.5Z" fill="#fff8ef"/>`,
      surprised_o: `<ellipse cx="0" cy="12" rx="1.7" ry="2.4" fill="${color}"/>`,
    };
    if (id === "open_smile") art = `<path d="M-3 11 Q0 12 3 11 Q3 16 0 16 Q-3 16 -3 11Z" fill="${color}"/><path d="M-2 14 Q0 13 2 14 V15 H-2Z" fill="#db8c86"/>`;
    else if (id === "lips") art = `<path d="M-3 12 Q-1 10 0 11 Q1 10 3 12 Q0 15 -3 12Z" fill="${color}"/>` + line("M-2.5 12 H2.5", .45, "#713d3e");
    else art = lipArt[id] ?? line(id === "neutral" ? "M-2 12 H2" : id === "frown" ? "M-2.5 13 Q0 10.5 2.5 13" : "M-2.5 11.5 Q0 14 2.5 11.5");
  } else if (feature === "nose") {
    const noses: Record<string, string> = {
      button: "M-1 8 Q0 9 1 8", small: "M0 7 L.5 8", straight: "M0 6 L-.8 8.5 H.8",
      pointed: "M-.5 6 L2 8.5 L-.7 9", rounded: "M-.6 6.5 Q2 7.5 1 9 Q0 10 -1 9",
      broad: "M-2.2 8 Q-1.5 6.8 0 8 Q1.5 6.8 2.2 8 M-1.6 9 Q0 10 1.6 9",
      upturned: "M-1.8 8.8 Q0 6.5 1.8 8.8 M-.7 9 H.7",
      aquiline: "M-.7 5.5 Q1.6 6 1 7.5 L2 9 L-.5 9.5",
    };
    art = line(noses[id] ?? noses.small, .65);
  } else if (feature === "marks") {
    const freckles: Record<string, number[][]> = {
      light: [[-11,8],[-8,9],[-5,8],[5,8],[8,9],[11,8]],
      nose: [[-8,8],[-5,7],[-2,8],[0,7],[2,8],[5,7],[8,8],[-4,9],[4,9]],
      dense: [[-13,7],[-11,9],[-9,7],[-8,10],[-6,8],[-5,11],[-3,8],[0,7],[3,8],[5,11],[6,8],[8,10],[9,7],[11,9],[13,7]],
      full: [[-13,7],[-11,10],[-9,7],[-7,10],[-5,8],[-3,9],[0,7],[3,9],[5,8],[7,10],[9,7],[11,10],[13,7],[-10,14],[-6,15],[6,15],[10,14],[-8,-7],[-3,-8],[3,-7],[8,-8]],
    };
    if (appearance.freckles) for (const [index, [x,y]] of (freckles[appearance.freckleStyle ?? "light"] ?? freckles.light).entries()) art += `<circle cx="${x}" cy="${y}" r="${index % 3 === 0 ? .5 : .35}" fill="#9b573c" opacity="${appearance.freckleIntensity ?? .65}"/>`;
    if (appearance.mole) art += '<circle cx="9" cy="12" r=".6" fill="#674538"/>';
    if (appearance.scar === "cheek") art += line("M10 7 L13 12 M10.5 9 H12 M11.5 11 H13", .6, "#ba806b");
    if (appearance.scar === "brow") art += line("M8 -5 L6 2 M6.8 -2 L8.4 -1", .7, "#ba806b");
    const scars: Record<string, string> = {
      eye: "M7 -5 L8 2 M8 7 L10 13 M7 -2 L9 -1 M9 10 L11 9",
      cross: "M9 8 L14 13 M14 8 L9 13",
      lip: "M2 10 L3 16 M1.6 13 L3.8 12.5",
      temple: "M15 -3 L17 5 M14.5 0 L17.5 -1 M15.5 3 L18 2",
      claw: "M8 7 L10 13 M11 6 L13 12 M14 5 L16 11",
      long: "M-11 -5 Q-6 3 -9 9 L-6 15 M-10 -2 L-7 -3 M-8 6 L-5 5 M-8 12 L-5 11",
    };
    if (scars[appearance.scar]) art += line(scars[appearance.scar], .7, "#ba806b");
  } else if (feature === "beard") {
    art = `<path d="${id === "short_goatee" ? "M-2 15 Q0 21 2 15 L1 22 H-1Z" : "M-12 12 Q-10 23 0 23 Q10 23 12 12 L8 16 Q0 20 -8 16Z"}" fill="${color}"/>`;
  } else if (feature === "hair") {
    const cap = "M-21 0 Q-23 -18 -10 -22 Q0 -26 10 -22 Q23 -18 21 0 L18 -7 Q12 -9 7 -12 Q0 -6 -7 -11 Q-14 -6 -18 -7Z";
    const hair: Record<string,string> = {
      messy_short: "M-22 2 L-23 -6 L-25 -10 L-20 -11 L-24 -15 L-16 -16 L-17 -22 L-8 -21 L-3 -26 L1 -23 L7 -26 L10 -22 L17 -21 L17 -17 L23 -15 L21 -11 L25 -8 L21 -5 L20 2 L16 -8 L10 -5 L8 -13 L2 -6 L0 -12 L-6 -5 L-5 -13 L-13 -4 L-13 -10 L-19 -4Z",
      fringe_short: cap,
      bob: cap + " M-21 -8 Q-25 8 -21 18 L-15 17 L-17 4 L-18 -9Z M21 -8 Q25 8 21 18 L15 17 L17 4 L18 -9Z",
      long: cap + " M-21 -8 Q-26 17 -22 35 Q-18 39 -14 35 L-16 18 L-17 4 L-18 -9Z M21 -8 Q26 17 22 35 Q18 39 14 35 L16 18 L17 4 L18 -9Z",
      ponytail: cap + " M19 -11 Q29 -18 25 -2 Q21 13 27 21 Q17 19 18 8 L20 -3Z",
      tuft: "M-3 -10 L-6 -20 L-3 -19 L-1 -28 L2 -23 L5 -26 L5 -17 L8 -20 L7 -9Z",
      curls: "M-22 0 Q-29 -3 -23 -9 Q-28 -16 -20 -19 Q-21 -26 -12 -23 Q-6 -30 0 -25 Q7 -31 13 -24 Q23 -27 21 -18 Q30 -14 24 -8 Q29 0 21 3 L17 -6 Q10 -8 7 -12 Q0 -6 -7 -11 Q-14 -6 -18 -5Z",
      pixie: "M-21 1 L-22 -8 Q-21 -19 -12 -22 L-14 -25 L-5 -23 L0 -27 L6 -24 Q20 -23 22 -8 L20 1 L16 -7 L10 -12 L5 -6 L1 -14 L-5 -7 L-8 -13 L-16 -5 L-18 -9Z",
      side_part: "M-21 2 Q-24 -17 -9 -23 Q5 -28 16 -19 Q24 -14 21 2 L17 -8 L12 -16 Q8 -3 -13 1 L-9 -7 L-18 -4Z",
      swept_back: "M-21 1 Q-25 -14 -16 -20 L-18 -24 L-10 -22 L-5 -27 L0 -24 L7 -27 L12 -22 Q26 -18 21 1 L16 -11 Q0 -19 -16 -10 L-18 1Z",
      undercut: "M-19 -7 Q-23 -17 -12 -22 L-15 -26 L-5 -23 L3 -28 L9 -24 Q24 -25 21 -13 L15 -7 Q7 -12 -1 -10 L-9 -5 L-12 -11Z",
      twin_tails: "M-18 -10 Q-28 -10 -26 3 Q-23 14 -26 25 Q-18 24 -17 10 L-14 -9Z M18 -10 Q28 -10 26 3 Q23 14 26 25 Q18 24 17 10 L14 -9Z " + cap,
      buns: "M-18 -12 C-30 -10 -28 -25 -20 -24 C-11 -26 -10 -15 -18 -12Z M18 -12 C30 -10 28 -25 20 -24 C11 -26 10 -15 18 -12Z " + cap,
      braid: "M18 -6 Q28 -3 23 5 Q29 10 23 15 Q29 20 22 25 Q27 31 20 36 L17 40 L16 33 Q11 28 17 23 Q11 18 17 13 Q11 8 17 3 L15 -7Z " + cap,
      wavy_long: "M-19 -11 Q-29 -1 -22 9 Q-28 17 -22 24 Q-27 32 -20 38 L-14 35 Q-18 28 -15 22 Q-20 13 -16 7 L-16 -10Z M19 -11 Q29 -1 22 9 Q28 17 22 24 Q27 32 20 38 L14 35 Q18 28 15 22 Q20 13 16 7 L16 -10Z " + cap,
      bowl: "M-22 2 Q-25 -23 0 -24 Q25 -23 22 2 L18 -5 H-18Z",
      buzz: "M-21 -4 Q-21 -23 0 -24 Q21 -23 21 -4 L18 -8 Q0 -21 -18 -8Z",
    };
    art = `<path d="${hair[id] ?? cap}" fill="${color}" stroke="#49372c" stroke-width=".65" stroke-linejoin="round"/>`;
    if (id === "messy_short" || id === "fringe_short") art += line("M-14 -15 L-18 -7 M-5 -18 L-7 -11 M5 -20 L7 -12 M14 -16 L18 -7", .55, "#ffffff33");
    const strands: Record<string, string> = {
      pixie: "M-14 -17 L-16 -8 M-5 -20 L-6 -12 M5 -21 L7 -14",
      side_part: "M10 -19 Q5 -8 -10 -5 M7 -21 Q0 -12 -15 -9",
      swept_back: "M-15 -12 Q-8 -22 0 -23 M-5 -15 Q0 -24 7 -23 M6 -15 Q13 -21 17 -18",
      undercut: "M-12 -17 Q0 -25 14 -19 M-8 -13 Q4 -21 17 -17",
      twin_tails: "M-23 -4 Q-19 5 -22 18 M23 -4 Q19 5 22 18",
      buns: "M-23 -20 Q-17 -23 -16 -18 M23 -20 Q17 -23 16 -18",
      braid: "M18 3 L23 6 M18 13 L23 16 M18 23 L22 26 M18 32 L21 34",
      wavy_long: "M-21 -3 Q-18 6 -21 12 Q-23 20 -19 30 M21 -3 Q18 6 21 12 Q23 20 19 30",
      bowl: "M-14 -16 L-15 -7 M-5 -19 L-5 -7 M5 -19 L5 -7 M14 -16 L15 -7",
      buzz: "M-14 -14 L-13 -16 M-8 -18 L-7 -20 M0 -20 V-22 M8 -18 L7 -20 M14 -14 L13 -16",
    };
    if (strands[id]) art += line(strands[id], .65, "#ffffff40");
  }
  if (!art) return null;
  if (appearance.view && appearance.view !== "front" && feature !== "eyes") {
    art = `<g transform="translate(${feature === "hair" ? 1 : 5} 0) scale(${feature === "hair" ? .92 : .85} 1)">${art}</g>`;
  }
  const box = thumbnail ? feature === "eyes" ? "-14 -2 28 12" : feature === "brows" ? "-14 -7 28 10" : feature === "mouth" ? "-8 7 16 14" : feature === "nose" ? "-5 4 10 8" : feature === "marks" ? "-20 -10 40 30" : "-27 -29 54 70" : "-27 -29 54 70";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${art}</svg>`;
}
