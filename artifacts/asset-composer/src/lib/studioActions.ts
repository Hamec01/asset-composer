import { produce } from "immer";
import { useStore } from "@/store";
import type {
  Project,
  SpriteEditorDocument,
  SpriteEditorLayer,
  Bone,
  AnimationClip,
  Template,
  Entity,
} from "@/domain/types";
import { evaluateSkeleton } from "./evaluationPipeline";
import { identity, worldBoneToMatrix } from "./matrixUtils";

export const newId = () => crypto.randomUUID();
export function studioCommit(
  label: string,
  edit: (project: Project) => void,
  mergePrevious = false,
) {
  const before = useStore.getState().project,
    after = produce(before, (draft) => {
      edit(draft as Project);
      draft.version = "3.0";
      draft.updatedAt = Date.now();
    });
  if (after !== before) {
    const previous = useStore.getState().history.past.at(-1),
      merge =
        mergePrevious &&
        previous?.type === "STUDIO_EDIT" &&
        /^(Paint |Cut to New Layer)/.test(previous.label);
    useStore.getState().pushCommand({
      type: "STUDIO_EDIT",
      label: merge ? previous.label : label,
      before: {
        studioProject: merge ? previous.before.studioProject : before,
      },
      after: { studioProject: after },
    });
    if (merge)
      useStore.setState((state) => ({
        ...state,
        history: {
          ...state.history,
          past: [
            ...state.history.past.slice(0, -2),
            state.history.past.at(-1)!,
          ],
        },
      }));
  }
}
export function editStudioDocument(
  id: string,
  label: string,
  edit: (doc: SpriteEditorDocument, project: Project) => void,
  mergePrevious = false,
) {
  studioCommit(
    label,
    (p) => {
      const doc = p.editorMeta.spriteEditorDocuments.find((d) => d.id === id);
      if (!doc) return;
      edit(doc, p);
      doc.updatedAt = Date.now();
    },
    mergePrevious,
  );
}
export function newStudioLayer(
  kind: SpriteEditorLayer["kind"],
  name?: string,
): SpriteEditorLayer {
  return {
    id: newId(),
    kind,
    name:
      name ??
      (kind === "raster"
        ? "Растровый слой"
        : kind === "group"
          ? "Группа"
          : "Векторный слой"),
    visible: true,
    opacity: 1,
    zIndex: 0,
    shapes: [],
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  };
}
export function newStudioDocument(
  width = 512,
  height = 512,
): SpriteEditorDocument {
  return {
    id: newId(),
    name: "Новый рисунок",
    studioArtwork: true,
    width,
    height,
    pivot: { x: width / 2, y: height, preset: "feet" },
    layers: [],
    target: { kind: "world-object" },
    updatedAt: Date.now(),
    sampling: "smooth",
  };
}
export function treeBones(width: number, height: number): Bone[] {
  const bone = (
    id: string,
    parentId: string | null,
    tx: number,
    ty: number,
    rotation: number,
    length: number,
  ): Bone => ({
    id,
    name: id,
    parentId,
    length,
    restPose: { tx, ty, rotation, scaleX: 1, scaleY: 1 },
  });
  const bones = [
    bone("root", null, width * 0.5, height * 0.9, -90, height * 0.45),
    bone("trunk", "root", 0, 0, 0, height * 0.45),
  ];
  for (const [side, offset, angle] of [
    ["left", 0.45, -40],
    ["right", 0.6, 40],
    ["top", 0.85, 0],
  ] as const) {
    bones.push(
      bone(
        "branch_" + side,
        "trunk",
        height * 0.45 * offset,
        0,
        angle,
        width * 0.12,
      ),
      bone(
        "branch_" + side + "_mid",
        "branch_" + side,
        width * 0.12,
        0,
        0,
        width * 0.12,
      ),
      bone(
        "branch_" + side + "_tip",
        "branch_" + side + "_mid",
        width * 0.12,
        0,
        0,
        width * 0.1,
      ),
      bone(
        "leaves_" + side,
        "branch_" + side + "_tip",
        width * 0.08,
        0,
        0,
        width * 0.08,
      ),
      bone(
        "leaves_" + side + "_tip",
        "leaves_" + side,
        width * 0.08,
        0,
        0,
        width * 0.06,
      ),
    );
  }
  return bones;
}
export function starterClip(
  template: Template,
  kind: "wind" | "rotation",
): AnimationClip {
  const durationMs = kind === "wind" ? 2400 : 2000;
  return {
    id: newId(),
    name: kind === "wind" ? "tree_idle_wind" : "continuous_rotation",
    label: kind === "wind" ? "Tree Idle Wind" : "Continuous Rotation",
    skeletonFamily: template.skeletonFamily,
    templateId: template.id,
    durationMs,
    fps: 24,
    loops: true,
    layers: [
      {
        mask: "full_body",
        tracks: template.bones
          .filter((b) =>
            kind === "rotation"
              ? b.id === "root"
              : b.id.startsWith("branch_") || b.id.startsWith("leaves_"),
          )
          .map((b, i) => ({
            boneId: b.id,
            rotationMode: kind === "rotation" ? "unwrapped" : "shortest",
            keyframes: Array.from(
              { length: kind === "wind" ? 9 : 2 },
              (_, n) => ({
                timeMs: kind === "wind" ? (n * durationMs) / 8 : n * durationMs,
                transform: {
                  tx: 0,
                  ty: 0,
                  rotation:
                    kind === "rotation"
                      ? n * 360
                      : Math.sin((n * Math.PI) / 4 + i * 0.7) *
                        (b.id.startsWith("leaves") ? 9 : 4),
                  scaleX: 1,
                  scaleY: 1,
                },
                easing: "linear",
              }),
            ),
          })),
      },
    ],
  };
}
export function createStudioRig(
  documentId: string,
  preset: "empty" | "tree" | string,
): string {
  let entityId = "",
    clipId: string | null = null;
  studioCommit("Create Rig", (p) => {
    const doc = p.editorMeta.spriteEditorDocuments.find(
      (d) => d.id === documentId,
    );
    if (!doc) throw new Error("No active document");
    if (doc.studioEntityId) {
      entityId = doc.studioEntityId;
      return;
    }
    const source = p.templates.find((t) => t.id === preset),
      template: Template = source
        ? {
            ...structuredClone(source),
            id: source.id + "_studio_" + newId(),
            name: doc.name + " · скелет",
            baseBodyLayers: [],
            boneParts: [],
            slots: [],
          }
        : {
            id: newId(),
            name: doc.name + " · скелет",
            description: "Скелет рисунка",
            skeletonFamily: "custom_2d_v1",
            viewProfile: "static",
            entityTypes: ["static_object"],
            bones:
              preset === "tree"
                ? treeBones(doc.width, doc.height)
                : [
                    {
                      id: "root",
                      name: "Корень",
                      parentId: null,
                      length: 40,
                      restPose: {
                        tx: doc.width / 2,
                        ty: doc.height / 2,
                        rotation: 0,
                        scaleX: 1,
                        scaleY: 1,
                      },
                    },
                  ],
            slots: [],
            anchors: {},
            paletteTokens: p.styleSets[0].paletteDefaults,
            baseBodyLayers: [],
            previewWidth: doc.width * 2,
            previewHeight: doc.height * 2,
            thumbnailSvg: "",
          };
    if (source) {
      const scale = (doc.height / Math.max(1, source.previewHeight)) * 0.85;
      for (const b of template.bones)
        if (!b.parentId) {
          b.restPose.tx += doc.width / 2;
          b.restPose.ty += doc.height * 0.85;
          b.restPose.scaleX *= scale;
          b.restPose.scaleY *= scale;
        }
      template.previewWidth = doc.width * 2;
      template.previewHeight = doc.height * 2;
    }
    const license = {
      source: "Art Studio",
      author: "",
      licenseType: "proprietary" as const,
      aiGenerated: false,
      commercialUseAllowed: true,
      purchaseRef: null,
      derivativePolicy: "",
    };
    entityId = newId();
    const entity: Entity = {
      id: entityId,
      name: doc.name,
      entityType: source ? source.entityTypes[0] : "static_object",
      templateId: template.id,
      styleSetId: p.styleSets[0].id,
      species: source ? "custom" : "prop",
      palette: { ...p.styleSets[0].paletteDefaults },
      slots: [],
      visuals: [
        {
          id: newId(),
          content: { kind: "document", documentId: doc.id },
          boneId: "root",
          metrics: {
            viewBoxX: 0,
            viewBoxY: 0,
            viewBoxWidth: doc.width,
            viewBoxHeight: doc.height,
            visualMinX: 0,
            visualMinY: 0,
            visualWidth: doc.width,
            visualHeight: doc.height,
          },
          pivot: { x: 0, y: 0, preset: "custom" },
          localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          zIndex: 0,
          editorDocumentId: doc.id,
        },
      ],
      activeAnimationClipId: null,
      activeStateMachineId: null,
      licenseMeta: license,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    p.templates.push(template);
    p.entities.push(entity);
    p.activeEntityId = entityId;
    doc.studioEntityId = entityId;
    doc.target = {
      kind: "entity-visual",
      entityId,
      visualId: entity.visuals![0].id,
    };
    const rest = evaluateSkeleton(template.bones, new Map());
    for (const l of doc.layers) {
      const guessed = template.bones.find(
        (b) => b.id === l.name.toLowerCase().replaceAll(" ", "_"),
      );
      if (guessed || !l.parentId) {
        const owner = guessed ?? template.bones[0];
        l.binding = {
          mode: "rigid",
          boneId: owner.id,
          bindMatrix: worldBoneToMatrix(rest.bones.get(owner.id)!),
        };
        if (source && guessed) l.anatomicalOwner = owner.id;
      }
    }
    if (preset === "tree") {
      const clip = starterClip(template, "wind");
      p.animationClips.push(clip);
      entity.activeAnimationClipId = clip.id;
      clipId = clip.id;
    }
  });
  useStore.getState().setPlaybackClip(clipId);
  return entityId;
}
