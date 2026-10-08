import type { DepthSlot, Entity, EvaluatedVisual, Item, ItemFitProfile, Template } from "@/domain/types";
import { evaluateScene, type EvaluatedScene, type EvaluatedSkeleton } from "./evaluationPipeline";
import { DEPTH_COLORS, resolveArmRoles } from "./limbDepth";

export type AnimationXRayMode = "normal" | "rig" | "depth" | "skeleton";
export interface AnimationXRayOptions {
  mode: AnimationXRayMode;
  depthShading: boolean;
  markers: boolean;
  showEquipment: boolean;
}
export interface AnimationXRayPresentation {
  options: AnimationXRayOptions;
  facing: "left" | "right" | "front";
  supported: boolean;
}
export const DEFAULT_XRAY_OPTIONS: AnimationXRayOptions = {
  mode: "normal", depthShading: true, markers: true, showEquipment: false,
};
export const XRAY_PALETTE_VERSION = 1;
export const ANATOMY_COLORS = {
  leftArm: "#E53935", rightArm: "#27AE60", leftLeg: "#F28C28", rightLeg: "#2878E0",
  torso: "#17191D", pelvis: "#9356C7", head: "#A3A7AE",
} as const;
export const XRAY_UNSUPPORTED = "Animation X-Ray requires separate anatomical body parts; this artwork has no complete segmented body.";
export const EQUIPMENT_CATEGORIES = new Set(["weapon_main", "weapon_off", "shield"]);

export function escapeSvgText(text: string): string {
  return text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
}

function mix(color: string, toward: number, amount: number): string {
  return "#" + [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - amount) + toward * amount).toString(16).padStart(2, "0")).join("");
}

export function anatomyColor(boneId?: string): string | undefined {
  if (/^(shoulder|elbow|hand)_[lr]$/.test(boneId ?? "")) {
    const color = boneId!.endsWith("_l") ? ANATOMY_COLORS.leftArm : ANATOMY_COLORS.rightArm;
    return boneId!.startsWith("hand") ? mix(color, 255, .28) : color;
  }
  if (/^(hip|knee|foot)_[lr]$/.test(boneId ?? "")) {
    const color = boneId!.endsWith("_l") ? ANATOMY_COLORS.leftLeg : ANATOMY_COLORS.rightLeg;
    return boneId!.startsWith("foot") ? mix(color, 255, .28) : color;
  }
  if (boneId === "head" || boneId === "neck") return ANATOMY_COLORS.head;
  if (boneId === "pelvis") return ANATOMY_COLORS.pelvis;
  if (["root", "spine", "chest"].includes(boneId ?? "")) return ANATOMY_COLORS.torso;
  return undefined;
}

export function shadeForDepth(color: string, slot?: DepthSlot): string {
  if (slot && ["FAR_BACK", "FAR_LIMB", "BODY_BACK"].includes(slot)) return mix(color, 0, .48);
  if (slot && ["NEAR_LIMB", "BODY_FRONT", "HAND_FRONT", "EQUIPMENT_FRONT"].includes(slot)) return mix(color, 255, .22);
  return color;
}

/** SVG filter paints SourceAlpha, so gradients/CSS/strokes cannot leak art colors.
 * Keep the original root/viewBox and filter the original content inside it. */
export function silhouetteSvg(svg: string, color: string, opacity = 1): string {
  const root = /<svg\b[^>]*>/i.exec(svg);
  const end = svg.toLowerCase().lastIndexOf("</svg>");
  if (!root || end < root.index) return svg;
  const content = svg.slice(root.index + root[0].length, end);
  let id = "animation-xray-alpha";
  while (svg.includes(id)) id += "-x";
  return `${svg.slice(0, root.index)}${root[0]}<defs><filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feFlood flood-color="${color}"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs><g opacity="${opacity}" filter="url(#${id})">${content}</g></svg>`;
}

function bodyVisual(visual: EvaluatedVisual): boolean {
  return !!visual.anatomicalBody && !!anatomyColor(visual.boneId);
}

export function supportsAnimationXRay(scene: EvaluatedScene): boolean {
  const bones = new Set(scene.visuals.filter(bodyVisual).map(v => v.boneId));
  return bones.has("head") && (bones.has("chest") || bones.has("spine"))
    && ["shoulder_l", "shoulder_r", "elbow_l", "elbow_r", "hand_l", "hand_r"].every(id => bones.has(id));
}

/** Presentation is a copy. Geometry, evaluation context, ordering and project art stay intact. */
export function presentAnimationXRay(scene: EvaluatedScene, items: Item[], options: AnimationXRayOptions,
  facing: AnimationXRayPresentation["facing"] = "right"): EvaluatedScene {
  if (options.mode === "normal") return scene;
  const supported = supportsAnimationXRay(scene);
  const presentation = { options: { ...options }, facing, supported };
  if (!supported) return { ...scene, presentation };
  const equipment = new Set(items.filter(item => EQUIPMENT_CATEGORIES.has(item.category)).map(item => item.id));
  const visuals = scene.visuals.filter(v => bodyVisual(v) || (options.showEquipment && v.itemId && equipment.has(v.itemId))).map(v => {
    if (!bodyVisual(v)) return { ...v };
    let color = anatomyColor(v.boneId)!;
    if (options.mode === "depth") color = v.renderDepth ? DEPTH_COLORS[v.renderDepth.slot] : "#767B85";
    else if (options.mode === "skeleton") color = "#A3A7AE";
    else if (options.depthShading) color = shadeForDepth(color, v.renderDepth?.slot);
    return { ...v, ...(v.content?.kind==="vector" || !v.content ? {svgData:silhouetteSvg(v.svgData ?? (v.content?.kind==="vector" ? v.content.svgData:""),color),content:{kind:"vector" as const,svgData:silhouetteSvg(v.svgData ?? (v.content?.kind==="vector" ? v.content.svgData:""),color)}} : {tint:color}), opacity:options.mode==="skeleton" ? .18 : 1 };
  });
  const byId = new Map(visuals.map(v => [v.id, v]));
  return { ...scene, presentation, visuals,
    layers: scene.layers.filter(layer => byId.has(layer.id)).map(layer => ({ ...layer, svgData: byId.get(layer.id)!.svgData ?? "" })),
  };
}

export function evaluatePresentedScene(entity: Entity, template: Template, skeleton: EvaluatedSkeleton,
  items: Item[], fitProfiles: ItemFitProfile[] = [], options: AnimationXRayOptions = DEFAULT_XRAY_OPTIONS): EvaluatedScene {
  const scene = evaluateScene(entity, template, skeleton, items, fitProfiles, { includeCoveredBody: options.mode !== "normal" });
  const facing = entity.appearance?.view ?? "front";
  if (options.mode !== "normal" && !supportsAnimationXRay(scene)) {
    return { ...evaluateScene(entity, template, skeleton, items, fitProfiles), presentation: { options, facing, supported: false } };
  }
  return presentAnimationXRay(scene, items, options, facing);
}

export function shoulderRoots(scene: EvaluatedScene) {
  const left = scene.skeleton.bones.get("shoulder_l"), right = scene.skeleton.bones.get("shoulder_r");
  return { left: left ? { x: left.x, y: left.y } : null, right: right ? { x: right.x, y: right.y } : null,
    distance: left && right ? Math.hypot(left.x - right.x, left.y - right.y) : null };
}

/** Shared world-space annotation markup; scale keeps labels legible in canvas and export. */
export function xrayOverlaySvg(scene: EvaluatedScene, pixelsPerUnit = 1): string {
  const p = scene.presentation;
  if (!p?.supported || p.options.mode === "normal") return "";
  const bones = scene.skeleton.bones;
  const scale = Math.max(.01, pixelsPerUnit);
  const stroke = 1.5 / scale, radius = 3.5 / scale, font = 11 / scale;
  const chains = [
    ["root", "pelvis", "spine", "chest", "neck", "head"],
    ["chest", "shoulder_l", "elbow_l", "hand_l"], ["chest", "shoulder_r", "elbow_r", "hand_r"],
    ["pelvis", "hip_l", "knee_l", "foot_l"], ["pelvis", "hip_r", "knee_r", "foot_r"],
  ];
  const lines = p.options.mode === "skeleton" ? chains.map(ids => {
    const points = ids.map(id => bones.get(id)).filter(b => !!b);
    const color = anatomyColor(ids.at(-1)) ?? "#B7A2EF";
    return `<polyline points="${points.map(b => `${b.x},${b.y}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${stroke}"/>`;
  }).join("") : "";
  if (!p.options.markers && p.options.mode !== "skeleton") return lines;
  const ids = p.options.mode === "skeleton" ? [...new Set(chains.flat())] : ["shoulder_l", "elbow_l", "hand_l", "shoulder_r", "elbow_r", "hand_r"];
  const roles = resolveArmRoles(p.facing === "left" ? "left" : "right");
  const markers = ids.map(id => {
    const bone = bones.get(id);
    if (!bone) return "";
    const arm = /^(shoulder|elbow|hand)_([lr])$/.exec(id);
    const side = arm?.[2];
    let label = arm ? `${{ shoulder: "S", elbow: "E", hand: "H" }[arm[1] as "shoulder" | "elbow" | "hand"]}${side!.toUpperCase()}` : id;
    if (arm?.[1] === "shoulder" && p.facing !== "front") label += side === roles.near ? " · N" : " · F";
    const color = anatomyColor(id) ?? "#B7A2EF";
    const labelX = bone.x + (side === "r" ? -6 : 6) / scale;
    const anchor = side === "r" ? "end" : "start";
    const circle = `<circle cx="${bone.x}" cy="${bone.y}" r="${radius}" fill="${color}" stroke="#FFFFFF" stroke-width="${stroke}"/>`;
    const text = p.options.markers ? `<text x="${labelX}" y="${bone.y - 6 / scale}" text-anchor="${anchor}" font-size="${font}" fill="${color}" stroke="#111318" stroke-width="${3 / scale}" paint-order="stroke">${escapeSvgText(label)}</text>` : "";
    return circle + text;
  }).join("");
  return `<g font-family="sans-serif" pointer-events="none">${lines}${markers}</g>`;
}
