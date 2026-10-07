type HandPose = "bow_grip" | "string_hook" | "string_release";

/** The wrist enters the back of the palm horizontally; grip is (5, 0). */
export function archeryHandSvg(pose: HandPose, skin: string, ink: string, scale = 1) {
  const shapes: Record<HandPose, [string, string]> = {
    bow_grip: [
      "M-3.5 0 Q-1.4-1.2 1 .2 L3.6 1 Q6.7 1.3 6.7 3.2 L6.4 8 Q6 10 3.4 10 L-.5 9.5 Q-3.5 8.8-4 6 L-4 2Z",
      "M-.8 1 Q.6.3 2 1.6 L4.4 3.3 Q4.9 4.8 3.5 5 L.4 3.3 M1.7 5 L6.4 5.5 M1.5 7 L6.2 7.5 M1.2 9 L5.5 9.3",
    ],
    string_hook: [
      "M-3.4 0 Q-1.4-1 0 .4 L2 1.5 Q4.8.5 5.5 2.2 Q5.7 3.8 3.7 4.2 L1.2 4.4 L3.8 5.2 Q5.4 5.4 5.2 7 Q4.7 8.5 2 8.7 L-1.4 8.1 Q-4 7.4-4.2 4.5Z",
      "M-.6 1.6 L1.2 3 L3.7 2.5 M-.4 4.4 L1.2 4.4 M.4 6 L4.7 6.4 M-.5 7.4 L3.6 7.9",
    ],
    string_release: [
      "M-3.4 0 Q-1.5-1 .2.5 L2.2 1.8 L5.4.8 Q7.2 1 6.2 2.5 L3.2 4 L6.3 4.3 Q7.7 5 6.3 6 L2.8 5.8 L5.2 7.2 Q6 8.7 4.5 8.6 L1.2 7.4 Q-1 9-3 7 L-4 4Z",
      "M-.5 2 L1.4 4 M-.5 5 Q1 5.8 1.2 7.4",
    ],
  };
  const [contour, creases] = shapes[pose];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-2*scale} ${-7*scale} ${14*scale} ${14*scale}"><g transform="scale(${scale})"><g transform="translate(4.2 -4.4)" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round"><path d="${contour}" fill="${skin}" stroke-width=".85"/><path d="${creases}" fill="none" stroke-width=".5"/></g></g></svg>`;
}

export function archeryHandSketchSheet() {
  const poses: HandPose[] = ["bow_grip", "string_hook", "string_release"];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="250"><rect width="720" height="250" fill="#252729"/>${poses.map((pose, i) => `<g transform="translate(${i*240+65} 35)"><svg width="110" height="155">${archeryHandSvg(pose, "#FFD0A8", "#4A3728")}</svg><text x="55" y="190" text-anchor="middle" fill="#ddd" font-family="sans-serif" font-size="16">${pose}</text></g>`).join("")}</svg>`;
}
