import type { CharacterAppearance, Entity, EvaluatedVisual, Item, Matrix2D } from "@/domain/types";
import type { AnimationContext } from "./animationContext";
import { identity, inverse, multiply, translation, transformAABB, transformPoint } from "./matrixUtils";
import { eyeOpennessAt } from "./faceAnimation";

export const DEFAULT_TOKEN_FACE: NonNullable<CharacterAppearance["tokenFace"]> = { emotion: "auto", blink: true, mouthMotion: true };
export const TOKEN_EMOTIONS = [{ value: "auto", label: "По анимации" }, { value: "neutral", label: "Спокойствие" }, { value: "happy", label: "Радость" }, { value: "angry", label: "Злость" }, { value: "sad", label: "Грусть" }, { value: "surprised", label: "Удивление" }] as const;

/** Mouth sockets measured inside the transparent opening of each original atlas crop. */
export const TOKEN_BEARD_MOUTHS: Record<string, { x: number; y: number; w: number; h: number }> = {
  extras_0: { x: .5, y: .515, w: .35, h: .20 },
  extras_1: { x: .5, y: .279, w: .22, h: .095 },
  extras_2: { x: .5, y: .25, w: .23, h: .085 },
  beards_extra_0: { x: .615, y: .533, w: .31, h: .16 },
  beards_extra_1: { x: .608, y: .519, w: .30, h: .15 },
  beards_extra_2: { x: .58, y: .49, w: .28, h: .11 },
  beards_extra_3: { x: .602, y: .43, w: .29, h: .12 },
  beards_extra_4: { x: .61, y: .52, w: .30, h: .14 },
};

export function tokenExpressionAt(entity: Entity, context?: AnimationContext) {
  const config = entity.appearance?.tokenFace ?? DEFAULT_TOKEN_FACE;
  const name = context?.clip.name ?? "";
  const speaking = /trade|talk|teach|stories|shout|dispute|care_gathering|alarm_horn/.test(name);
  const emotion = config.emotion !== "auto" ? config.emotion : !context ? "neutral"
    : /dance|child_run_play|rock_baby/.test(name) ? "happy" : /indignation|attack|chop|block|slash_combo|spear_thrust|spear_throw|punch/.test(name) ? "angry"
    : /fall|jump/.test(name) ? "surprised" : /death|hide|cower|mourn/.test(name) ? "sad" : "neutral";
  const time = context?.timeMs ?? 0;
  const pulse = context && config.mouthMotion ? Math.sin(Math.PI * time / (speaking ? 420 : 650)) ** 2 : 0;
  const dead = name === "death" && !!context && time > context.clip.durationMs * .3;
  const blink = config.blink && !!context && context.clip.durationMs >= 1200 && !dead
    ? eyeOpennessAt({ blink: { enabled: true, intervalMs: 2600, durationMs: 180 } }, context) : dead ? 0 : 1;
  const mouth = dead ? 0 : config.mouthMotion && context && (emotion === "happy" || emotion === "angry" || emotion === "surprised" || speaking || /^(eat|drink)/.test(name)) ? pulse : 0;
  const brow = emotion === "happy" ? -2 - pulse * 1.5 : emotion === "angry" ? 2 + pulse : emotion === "surprised" ? -5 - pulse : emotion === "sad" ? -1 : 0;
  return { emotion, blink, mouth, brow, dead };
}

function around(v: EvaluatedVisual, sx: number, sy: number, dy = 0, rotation = 0) {
  const b = v.localBounds, cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  v.worldMatrix = multiply(v.worldMatrix, multiply(translation(cx, cy + dy), multiply([cos * sx, sin * sx, -sin * sy, cos * sy, 0, 0], translation(-cx, -cy))));
  v.worldBounds = transformAABB(v.worldMatrix, b);
}
function mask(v: EvaluatedVisual, id: string, matrix: Matrix2D, width: number, height: number, svgData: string): EvaluatedVisual {
  const bounds = { minX: 0, minY: 0, maxX: width, maxY: height };
  return { id: `${v.id}__${id}`, content: { kind: "vector", svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${svgData}</svg>` }, zIndex: 0, worldMatrix: matrix, localBounds: bounds, worldBounds: transformAABB(matrix, bounds) };
}

/** Apply after native placement, before any renderer. No changes to the saved selection or rig. */
export function applyTokenFace(visuals: EvaluatedVisual[], entity: Entity, items: Item[], headMatrix: Matrix2D = identity(), context?: AnimationContext, includeCoveredBody = false) {
  if (!entity.templateId.startsWith("chibi_token_skin_")) return;
  const get = (slot: string) => visuals.find(v => v.slotId === slot);
  const eyes = get("token_eyes"), mouth = get("token_mouth"), brows = get("token_brows"), beard = get("token_beard"), hat = get("token_headgear");
  const expression = tokenExpressionAt(entity, context);
  if (brows) around(brows, 1, expression.emotion === "angry" ? 1.12 : 1, expression.brow);
  if (mouth) {
    const poseMouth = expression.emotion === "happy" ? "face_extra_16" : expression.emotion === "angry" ? "face_plus_19" : expression.emotion === "sad" ? "face_plus_20" : expression.emotion === "surprised" ? "face_plus_21" : null;
    const mouthId = expression.mouth > .25 ? expression.emotion === "happy" ? "face_plus_18" : expression.emotion === "angry" ? "face_extra_21" : "face_plus_21" : poseMouth;
    const replacement = mouthId ? items.find(i => i.id === `token_item_${mouthId}`)?.parts?.[0] : undefined;
    if (replacement?.content) mouth.content = replacement.content;
    around(mouth, 1, 1 + expression.mouth * .9);
    const socket = beard && TOKEN_BEARD_MOUTHS[beard.itemId?.replace("token_item_", "") ?? ""];
    if (beard && socket) {
      const b = beard.localBounds, mb = mouth.localBounds;
      const w = b.maxX - b.minX, h = b.maxY - b.minY;
      const point = transformPoint(beard.worldMatrix, b.minX + w * socket.x, b.minY + h * socket.y);
      const current = transformPoint(mouth.worldMatrix, (mb.minX + mb.maxX) / 2, (mb.minY + mb.maxY) / 2);
      const origin = transformPoint(headMatrix, 12, -29);
      const manual = entity.slots.find(s => s.slotId === "token_mouth")?.attachmentOverride;
      // Keep the user's mouth adjustment as a delta from the automatic mouth socket.
      const mouthDefault = items.find(i => i.id === mouth.itemId)?.parts?.[0];
      const mw = mouthDefault?.metrics.viewBoxWidth ?? 27, mh = mouthDefault?.metrics.viewBoxHeight ?? 8;
      const beardScaleX = Math.hypot(beard.worldMatrix[0], beard.worldMatrix[1]) / Math.max(.001, Math.hypot(headMatrix[0], headMatrix[1]));
      const beardScaleY = Math.hypot(beard.worldMatrix[2], beard.worldMatrix[3]) / Math.max(.001, Math.hypot(headMatrix[2], headMatrix[3]));
      const relativeBeard = multiply(inverse(headMatrix), beard.worldMatrix);
      around(mouth, Math.min(1, w * socket.w / mw) * beardScaleX, Math.min(1, h * socket.h / mh) * beardScaleY, 0, Math.atan2(relativeBeard[1], relativeBeard[0]));
      const delta = manual && Object.keys(manual).length ? { x: current.x - origin.x, y: current.y - origin.y } : { x: 0, y: 0 };
      const center = transformPoint(mouth.worldMatrix, (mb.minX + mb.maxX) / 2, (mb.minY + mb.maxY) / 2);
      mouth.worldMatrix[4] += point.x + delta.x - center.x; mouth.worldMatrix[5] += point.y + delta.y - center.y;
      mouth.worldBounds = transformAABB(mouth.worldMatrix, mb);
    }
  }
  // Reserve the whole eye socket before blinking; scars cannot paint on the cornea.
  const scar = get("token_scar");
  if (scar && eyes) {
    const b = eyes.localBounds, w = b.maxX - b.minX + 4, h = b.maxY - b.minY + 4;
    scar.occlusionMasks = [...(scar.occlusionMasks ?? []), mask(scar, "eye-protection", multiply(eyes.worldMatrix, translation(b.minX - 2, b.minY - 2)), w, h, `<rect width="${w}" height="${h}" fill="black"/>`)];
  }
  if (eyes && expression.blink < .999) {
    const b = eyes.localBounds, w = b.maxX - b.minX, h = b.maxY - b.minY;
    const opening = expression.blink;
    if (opening < .03) {
      eyes.svgData = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><path d="M${w*.08} ${h*.51} Q${w*.24} ${h*.64} ${w*.4} ${h*.51} M${w*.65} ${h*.51} Q${w*.79} ${h*.64} ${w*.93} ${h*.51}" fill="none" stroke="#291c16" stroke-width="1.7" stroke-linecap="round"/></svg>`;
      eyes.content = { kind: "vector", svgData: eyes.svgData };
    }
    else {
      const cut = h * (1 - opening) / 2;
      eyes.occlusionMasks = [...(eyes.occlusionMasks ?? []), mask(eyes, "eyelids", multiply(eyes.worldMatrix, translation(b.minX, b.minY)), w, h, `<path d="M0 0H${w}V${cut}H0Z M0 ${h-cut}H${w}V${h}H0Z" fill="black"/>`)];
    }
  }
  if (hat && !includeCoveredBody) {
    const index = Number(hat.itemId?.split("_").at(-1));
    const b = hat.localBounds, w = b.maxX - b.minX, h = b.maxY - b.minY;
    const aperture = index === 0 || index === 2 ? [[.27,.43],[.78,.43],[.82,.9],[.84,1.05],[2,1.05],[2,4],[-1,4],[-1,1.05],[.26,1.05]]
      : index === 3 ? [[.54,.24],[.82,.55],[.78,.92],[.67,1.08],[2,1.12],[2,4],[-1,4],[-1,1.12],[.32,.98],[.30,.70]]
      : [[-1,index === 6 ? .72 : index === 7 ? .69 : .57],[2,index === 6 ? .72 : index === 7 ? .69 : .57],[2,4],[-1,4]];
    const maskWidth = w + 160, maskHeight = h + 200;
    const path = aperture.map(([x,y],i) => `${i ? "L" : "M"}${x*w+80} ${y*h+80}`).join(" ") + "Z";
    const matrix = multiply(hat.worldMatrix, translation(b.minX - 80, b.minY - 80));
    for (const v of visuals.filter(v => v !== hat && (v.boneId === "head" || ["token_eyes", "token_nose", "token_mouth", "token_brows", "token_scar", "token_freckles", "token_mole", "token_beard", "token_patch", "token_circlet"].includes(v.slotId ?? "")))) {
      v.occlusionMasks = [...(v.occlusionMasks ?? []), mask(v, "hat-aperture", matrix, maskWidth, maskHeight, `<path d="M0 0H${maskWidth}V${maskHeight}H0Z ${path}" fill="black" fill-rule="evenodd"/>`)];
    }
  }
}
