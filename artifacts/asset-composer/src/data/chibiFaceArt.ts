/** Flat, outlined shapes that remain readable at game sprite sizes. */
export const CHIBI_BROWS = [
  { id: "gentle_taper", label: "Мягкие заострённые" },
  { id: "short_dash", label: "Короткие штрихи" },
  { id: "bold_arc", label: "Густые дугой" },
  { id: "determined", label: "Решительные" },
  { id: "curious", label: "Любопытные" },
  { id: "sad_soft", label: "Грустные" },
  { id: "playful", label: "Одна приподнята" },
  { id: "tiny_round", label: "Маленькие округлые" },
  { id: "angular", label: "Угловатые" },
  { id: "relaxed", label: "Расслабленные" },
];
export const CHIBI_MOUTHS = [
  { id: "chibi_smile", label: "Чиби · улыбка" },
  { id: "chibi_line", label: "Чиби · спокойный" },
  { id: "chibi_cat", label: "Чиби · кошачий" },
  { id: "chibi_o", label: "Чиби · удивление" },
  { id: "chibi_grit", label: "Чиби · зубки" },
  { id: "chibi_small_lips", label: "Чиби · маленькие губы" },
];
export function chibiBrowArt(
  id: string,
  color: string,
  side: boolean,
): string | null {
  if (!CHIBI_BROWS.some((b) => b.id === id)) return null;
  const paths: Record<string, string> = {
    gentle_taper: "M-3 -2 Q-.5 -4.3 3 -2.6 L2 -1.8 Q-.8 -2.8 -3 -2Z",
    short_dash: "M-2.3 -2.6 L2.2 -2.8 L2.1 -1.6 L-2.3 -1.5Z",
    bold_arc: "M-3.5 -2 Q0 -5 3.5 -2 L2.8 -.8 Q0 -3 -2.8 -.8Z",
    determined: "M-3.3 -3.5 L3 -1.8 L2.7 -.5 L-3.5 -2.2Z",
    curious: "M-3.1 -3 Q0 -6 3.2 -3.5 L2.8 -2.4 Q0 -4.5 -2.7 -2Z",
    sad_soft: "M-3.3 -1.8 Q0 -2.6 3 -4.6 L3.4 -3.3 Q.3 -1 -3.3 -.7Z",
    playful: "M-3 -3.3 Q0 -4.8 3.4 -3 L3 -1.9 Q0 -3.2 -3 -2.1Z",
    tiny_round: "M-1.8 -2.2 Q0 -3.4 1.8 -2.2 Q0 -1.4 -1.8 -2.2Z",
    angular: "M-3.5 -2.6 L-.7 -4 L3.3 -2.1 L2.6 -.9 L-.7 -2.6 L-3 -1.3Z",
    relaxed: "M-3.2 -2 Q0 -1.3 3.2 -2.3 L3.1 -1.2 Q0 -.2 -3.2 -1Z",
  };
  return (side ? [-2, 11] : [-7, 7])
    .map(
      (x, i) =>
        `<g transform="translate(${x} ${id === "playful" && i === 1 ? 1.5 : 0}) scale(${(i === 0 ? 1 : -1) * (side && i === 1 ? 0.8 : 1)} 1)"><path d="${paths[id]}" fill="${color}"/></g>`,
    )
    .join("");
}
export function defaultMouthOpening(id: string): number {
  return ["chibi_o", "surprised_o"].includes(id)
    ? 0.8
    : ["chibi_grit", "grin", "open_smile"].includes(id)
      ? 0.65
      : id === "parted_lips"
        ? 0.2
        : 0;
}
export function chibiMouthArt(
  id: string,
  color: string,
  opening: number,
): string {
  const o = Math.max(0, Math.min(1, opening)),
    w =
      id === "chibi_o" || id === "surprised_o"
        ? 1.9
        : id === "chibi_line" || id === "neutral"
          ? 2.4
          : id === "chibi_cat"
            ? 3.5
            : 3.2;
  const line = (d: string) =>
    `<path d="${d}" fill="none" stroke="#513b32" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (o < 0.025) {
    if (id === "chibi_cat")
      return line("M-3.5 11.8 Q-1.8 14 0 11.8 Q1.8 14 3.5 11.8");
    if (
      [
        "chibi_small_lips",
        "rose_satin",
        "peach_gloss",
        "berry_lips",
        "cupid_soft",
        "gentle_smile",
        "parted_lips",
        "lips",
        "full_lips",
        "heart_lips",
        "pout",
        "thin_lips",
        "painted_lips",
      ].includes(id)
    )
      return (
        `<path d="M-${w} 12 Q-1.3 10.5 0 11.5 Q1.3 10.5 ${w} 12 Q0 14.2 -${w} 12Z" fill="${color}"/>` +
        line(`M-${w - 0.4} 12 Q0 12.7 ${w - 0.4} 12`)
      );
    return line(
      id === "chibi_line" || id === "neutral"
        ? `M-${w} 12 H${w}`
        : id === "frown"
          ? `M-${w} 13 Q0 10.8 ${w} 13`
          : `M-${w} 11.8 Q0 14 ${w} 11.8`,
    );
  }
  const bottom = 12 + 5 * o,
    upper = 12 - 1.2 * o;
  const shape = `M-${w} 12 Q0 ${upper} ${w} 12 Q${w * 0.7} ${bottom + o} 0 ${bottom} Q-${w * 0.7} ${bottom + o} -${w} 12Z`;
  const clip = `mouth_${id}`;
  return `<defs><clipPath id="${clip}"><path d="${shape}"/></clipPath></defs><path d="${shape}" fill="#593a38" stroke="#513b32" stroke-width=".7" stroke-linejoin="round"/><g clip-path="url(#${clip})">${["chibi_grit", "grin", "open_smile"].includes(id) ? `<path d="M-4 11.5 H4 V${12 + Math.max(0.7, 2.2 * o)} Q0 ${13 + 2 * o} -4 ${12 + Math.max(0.7, 2.2 * o)}Z" fill="#fff1d6"/>` : ""}<ellipse cx="0" cy="${bottom + 0.25}" rx="${w * 0.7}" ry="${1.8 * o}" fill="#d98b86"/></g>`;
}
