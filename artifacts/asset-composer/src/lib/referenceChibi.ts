import type { BonePart, ImportedAssetSource, Template } from "@/domain/types";
import { createEditableBodyPart } from "./bodyPartAuthoring";
import { createDocumentFromEntityVisual, extractSpriteShapesFromSvg, spriteEditorDocumentToSvg, translateSpriteShape } from "./spriteEditor";
import { createChibiThumbnail } from "@/data/chibiBody";
import { parseMetrics } from "./svgMetrics";

export function getAuthoredDocumentMetrics(svg: string, width: number, height: number) {
  const metrics = parseMetrics(svg);
  return { ...metrics, visualMinX: 0, visualMinY: 0, visualWidth: width, visualHeight: height };
}

export function normalizeReferenceSvg(svg: string) {
  const metrics = parseMetrics(svg);
  if (!metrics.viewBoxX && !metrics.viewBoxY) return svg;
  return spriteEditorDocumentToSvg({
    id: "reference-frame", name: "Reference frame", width: metrics.viewBoxWidth, height: metrics.viewBoxHeight,
    pivot: { x: metrics.viewBoxWidth / 2, y: metrics.viewBoxHeight / 2, preset: "center" }, updatedAt: 0,
    target: { kind: "entity-visual" }, layers: [{ id: "outline", name: "Outline", visible: true, zIndex: 0,
      shapes: extractSpriteShapesFromSvg(svg).map(shape => translateSpriteShape(shape, -metrics.viewBoxX, -metrics.viewBoxY)) }],
  });
}

const SCALE = 0.09;
const JOINTS: Record<string, [number, number]> = {
  root: [535, 1010], pelvis: [535, 1010], spine: [535, 880], chest: [535, 725],
  neck: [532, 660], head: [530, 450],
  shoulder_l: [386, 710], elbow_l: [313, 857], hand_l: [267, 995],
  shoulder_r: [674, 716], elbow_r: [741, 866], hand_r: [792, 1000],
  hip_l: [436, 1077], knee_l: [408, 1211], foot_l: [380, 1350],
  hip_r: [636, 1085], knee_r: [640, 1218], foot_r: [657, 1350],
};

// Absolute reference-image coordinates. Covered anatomy is reconstructed;
// clothes, hair and facial features deliberately do not belong to the base body.
const TRACES: Array<{ id: string; bone: string; box: [number, number, number, number]; path: string; contour?: string; detail?: string; z: number; name: string }> = [
  { id: "head", bone: "head", box: [270, 205, 510, 435], z: -790, name: "Голова",
    path: "M389 480 C370 442 365 372 390 319 C421 251 482 219 550 218 C644 216 709 261 744 335 C769 393 771 473 746 531 C716 603 645 627 548 627 C480 627 419 605 388 572 C355 588 320 584 294 559 C270 537 274 500 300 484 C326 468 357 472 377 492 Z",
    detail: "M305 519 C317 501 343 500 357 522 C341 509 326 521 326 537 C330 548 340 553 351 550" },
  { id: "neck", bone: "neck", box: [430, 592, 190, 135], z: -800, name: "Шея",
    path: "M457 600 C493 615 544 620 588 608 L589 653 C591 672 609 680 611 696 C590 721 465 723 440 695 C444 678 460 668 461 651 Z",
    contour: "M457 615 L461 651 C460 668 444 678 440 695 M588 622 L589 653 C591 672 609 680 611 696" },
  { id: "torso", bone: "chest", box: [365, 670, 345, 305], z: -840, name: "Корпус",
    path: "M447 680 C474 698 501 705 532 705 C560 706 591 697 613 682 C654 683 679 705 692 743 C701 792 676 858 686 922 L689 963 L384 963 L389 921 C399 857 371 791 380 744 C390 706 412 688 447 680 Z",
    contour: "M447 680 C412 688 390 706 380 744 C371 791 399 857 389 921 M613 682 C654 683 679 705 692 743 C701 792 676 858 686 922",
    detail: "M450 736 Q490 753 528 743 M544 744 Q578 755 614 741" },
  { id: "belly", bone: "spine", box: [378, 855, 315, 210], z: -830, name: "Живот",
    path: "M389 865 C448 884 623 884 682 865 C674 917 694 973 680 1049 L391 1049 C377 973 397 917 389 865 Z",
    contour: "M389 886 C397 917 377 973 391 1035 M682 886 C674 917 694 973 680 1035", detail: "M523 958 Q534 968 546 958" },
  { id: "pelvis", bone: "pelvis", box: [355, 981, 373, 164], z: -820, name: "Таз / бельё",
    path: "M388 989 Q531 1009 686 989 L718 1091 Q681 1099 661 1135 L557 1135 Q531 1117 520 1094 Q497 1118 487 1135 L370 1103 Z",
    detail: "M389 1007 Q533 1027 689 1007 M591 1027 Q571 1061 578 1101" },
  { id: "arm_l_upper", bone: "shoulder_l", box: [251, 658, 172, 242], z: -813, name: "Левое плечо",
    path: "M341 676 C367 651 401 666 409 698 C425 751 398 810 355 857 L333 887 L267 860 C269 826 291 793 303 765 C306 726 317 696 341 676 Z",
    contour: "M267 860 C269 826 291 793 303 765 C306 726 317 696 341 676 C367 651 401 666 409 698 C425 751 398 810 355 857" },
  { id: "arm_l_lower", bone: "elbow_l", box: [189, 824, 158, 220], z: -812, name: "Левое предплечье",
    path: "M274 837 C293 824 324 842 332 863 C331 905 317 950 297 989 L292 1033 L208 1027 L211 984 C187 941 197 885 225 858 Z",
    contour: "M208 1027 L211 984 C187 941 197 885 225 858 M332 863 C331 905 317 950 297 989 L292 1033", detail: "M285 971 Q297 972 306 980" },
  { id: "hand_l", bone: "hand_l", box: [184, 972, 155, 135], z: -811, name: "Левая кисть",
    path: "M213 979 Q243 969 289 987 C316 997 337 1026 327 1045 Q316 1063 302 1040 L291 1029 C285 1043 299 1050 309 1058 Q315 1074 296 1081 Q285 1097 263 1090 Q243 1100 225 1086 Q193 1076 193 1047 Q189 1006 213 979 Z",
    detail: "M291 1029 Q280 1038 286 1050 M230 1065 Q241 1080 255 1080" },
  { id: "arm_r_upper", bone: "shoulder_r", box: [650, 676, 121, 225], z: -920, name: "Правое плечо",
    path: "M662 686 Q690 674 714 708 C733 741 731 785 751 822 L762 872 L702 886 C693 853 677 830 676 790 Z",
    contour: "M662 686 Q690 674 714 708 C733 741 731 785 751 822 L762 872 M702 886 C693 853 677 830 676 790" },
  { id: "arm_r_lower", bone: "elbow_r", box: [689, 835, 143, 210], z: -920, name: "Правое предплечье",
    path: "M704 847 Q733 832 762 851 C790 885 792 937 811 975 L821 1029 L750 1035 L744 998 C713 964 701 923 701 887 Z",
    contour: "M762 851 C790 885 792 937 811 975 L821 1029 M750 1035 L744 998 C713 964 701 923 701 887" },
  { id: "hand_r", bone: "hand_r", box: [742, 976, 125, 130], z: -920, name: "Правая кисть",
    path: "M758 986 Q791 973 819 987 C846 1003 860 1031 851 1063 Q843 1090 811 1094 Q788 1104 773 1087 Q755 1088 752 1070 C750 1055 776 1051 782 1033 Q765 1028 759 1047 Q744 1055 746 1034 Z",
    detail: "M782 1033 Q788 1053 775 1066" },
  { id: "thigh_l", bone: "hip_l", box: [330, 1060, 183, 187], z: -890, name: "Левое бедро",
    path: "M360 1070 Q431 1060 502 1080 C505 1117 477 1150 473 1184 L463 1238 L341 1230 C337 1191 348 1160 347 1130 Z",
    contour: "M360 1070 C347 1130 337 1191 341 1230 M502 1080 C505 1117 477 1150 473 1184 L463 1238", detail: "M367 1178 Q399 1208 433 1185" },
  { id: "thigh_r", bone: "hip_r", box: [555, 1068, 164, 183], z: -930, name: "Правое бедро",
    path: "M563 1080 Q633 1071 706 1091 C711 1132 695 1171 700 1200 L693 1240 L580 1240 C576 1200 586 1162 569 1122 Z",
    contour: "M706 1091 C711 1132 695 1171 700 1200 L693 1240 M580 1240 C576 1200 586 1162 569 1122" },
  { id: "calf_l", bone: "knee_l", box: [315, 1200, 164, 195], z: -890, name: "Левая голень",
    path: "M341 1210 Q396 1200 463 1218 C473 1260 449 1304 439 1334 L436 1384 L334 1384 L335 1340 C316 1295 320 1250 341 1210 Z",
    contour: "M341 1210 C320 1250 316 1295 335 1340 L334 1384 M463 1218 C473 1260 449 1304 439 1334 L436 1384" },
  { id: "calf_r", bone: "knee_r", box: [563, 1205, 145, 190], z: -930, name: "Правая голень",
    path: "M580 1218 Q635 1206 692 1222 C705 1265 684 1308 680 1340 L685 1383 L583 1383 L585 1340 C566 1299 568 1253 580 1218 Z",
    contour: "M580 1218 C568 1253 566 1299 585 1340 L583 1383 M692 1222 C705 1265 684 1308 680 1340 L685 1383" },
  { id: "foot_l", bone: "foot_l", box: [289, 1328, 176, 104], z: -880, name: "Левая стопа",
    path: "M335 1338 Q383 1329 436 1338 L441 1370 C451 1380 456 1400 447 1414 Q378 1431 303 1416 C290 1407 298 1385 316 1374 Z",
    contour: "M335 1338 L316 1374 C298 1385 290 1407 303 1416 Q378 1431 447 1414 C456 1400 451 1380 441 1370 L436 1338", detail: "M320 1401 Q374 1411 432 1401" },
  { id: "foot_r", bone: "foot_r", box: [568, 1328, 227, 104], z: -930, name: "Правая стопа",
    path: "M583 1338 Q634 1329 681 1338 L690 1371 C732 1365 774 1383 782 1403 Q785 1420 754 1422 L587 1420 Q572 1410 579 1383 Z",
    contour: "M583 1338 L579 1383 Q572 1410 587 1420 L754 1422 Q785 1420 782 1403 C774 1383 732 1365 690 1371 L681 1338" },
];

export function createReferenceChibiTemplate(base: Template, id: string): Template {
  const palette = { ...base.paletteTokens, skin: "#FFC595", outline: "#583523" };
  const parts: BonePart[] = TRACES.map(trace => {
    const [x, y, w, h] = trace.box;
    const [jointX, jointY] = JOINTS[trace.bone];
    const fill = trace.id === "pelvis" ? "#8A9AA3" : palette.skin;
    return { id: `hero_${trace.id}`, boneId: trace.bone, naturalWidth: w * SCALE, naturalHeight: h * SCALE,
      localX: (x + w / 2 - jointX) * SCALE, localY: (y + h / 2 - jointY) * SCALE, zOffset: trace.z,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}"><path d="${trace.path}" fill="${fill}" stroke="none"/><path d="${trace.contour ?? trace.path}" fill="none" stroke="${palette.outline}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>${trace.detail ? `<path d="${trace.detail}" fill="none" stroke="${trace.id === "pelvis" ? "#596C76" : "#E8A078"}" stroke-width="5" stroke-linecap="round"/>` : ""}</svg>` };
  }).map(part => ({ ...part, svgData: normalizeReferenceSvg(part.svgData) })).sort((a, b) => a.zOffset - b.zOffset);
  const bones = base.bones.map(bone => {
    const point = JOINTS[bone.id];
    const parent = JOINTS[bone.parentId ?? "root"];
    return { ...bone, restPose: { ...bone.restPose, tx: (point[0] - parent[0]) * SCALE, ty: (point[1] - parent[1]) * SCALE } };
  });
  const thumbnail = createChibiThumbnail(parts, bones);
  return { ...base, id, name: "Чиби — обводка референса", paletteTokens: palette, bones, boneParts: parts,
    baseBodyLayers: [], thumbnailSvg: thumbnail, views: { east: { key: "east", viewProfile: "side_view", thumbnailSvg: thumbnail } } };
}

export function createReferenceChibiDocuments(template: Template, entityId: string, source: ImportedAssetSource) {
  return template.boneParts!.map(part => {
    const trace = TRACES.find(candidate => `hero_${candidate.id}` === part.id)!;
    const [x, y, w, h] = trace.box;
    const visual = createEditableBodyPart(part);
    visual.bodyView = "side";
    const doc = createDocumentFromEntityVisual(entityId, visual);
    doc.name = trace.name;
    doc.pivot = { x: w / 2, y: h / 2, preset: "center" };
    doc.authoringHint = { preserveFrame: true };
    doc.tracingAsset = source;
    doc.tracingOpacity = 0.35;
    doc.tracingTransform = { x: 512 - x - w / 2, y: 768 - y - h / 2, scale: 1 / Math.min(w / 1024, h / 1536) };
    visual.pivot = doc.pivot;
    visual.svgData = spriteEditorDocumentToSvg(doc);
    visual.editorDocumentId = doc.id;
    // SVG serialization changed the viewBox origin; rebuild matching metrics.
    visual.metrics = getAuthoredDocumentMetrics(visual.svgData, w, h);
    return { visual, doc };
  });
}
