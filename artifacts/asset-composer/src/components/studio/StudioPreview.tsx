import { stablePartColor } from "@/lib/studioDiagnostics";
import { svgToDataUrl } from "@/lib/svgUtils";
import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { animController } from "@/core-v2/AnimationController";
import {
  evaluateScene,
  evaluateSkeleton,
  buildMultiClipPose,
} from "@/lib/evaluationPipeline";
import { drawVisual, loadImage } from "@/lib/visualRenderer";
import { DEPTH_COLORS } from "@/lib/limbDepth";
import {
  anatomyColor,
  shadeForDepth,
  presentAnimationXRay,
  xrayOverlaySvg,
  DEFAULT_XRAY_OPTIONS,
  supportsAnimationXRay,
  XRAY_UNSUPPORTED,
} from "@/lib/animationXRay";
import type {
  SpriteEditorDocument,
  SpriteEditorLayer,
  BoneTransform,
} from "@/domain/types";

export function StudioPreview({
  doc,
  revision,
  draft,
  debug,
  selectedBone,
  poseOverride,
  onError,
}: {
  doc: SpriteEditorDocument;
  revision: number;
  draft: SpriteEditorDocument | null;
  debug: string;
  selectedBone: string;
  poseOverride?: BoneTransform;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    generation = useRef(0);
  useEffect(() => {
    let stopped = false,
      busy = false,
      dirty = true;
    const render = async (time: number) => {
      if (stopped) return;
      if (busy) {
        dirty = true;
        return;
      }
      busy = true;
      dirty = false;
      const token = ++generation.current;
      try {
        const store = useStore.getState(),
          entity = store.project.entities.find(
            (e) =>
              e.id ===
              (doc.studioEntityId ??
                doc.target.entityId ??
                (doc.target.itemId ? store.project.activeEntityId : null)),
          );
        if (!entity) return;
        const template = store.project.templates.find(
          (t) => t.id === entity.templateId,
        );
        if (!template) return;
        const pose = buildMultiClipPose(
          store.project.animationClips,
          store.animPlayback.activeClipId ?? entity.activeAnimationClipId,
          null,
          null,
          0,
          time,
          entity,
          store.project.items,
        );
        if (poseOverride) pose.set(selectedBone, poseOverride);
        const skeleton = evaluateSkeleton(
          template.bones,
          pose,
          entity.bodyMorphs,
          entity.appearance,
        );
        const activeDocument = draft ?? doc;
        let scene = evaluateScene(
          entity,
          template,
          skeleton,
          store.project.items,
          store.project.itemFitProfiles,
          {
            includeCoveredBody: ["rig", "depth", "bones"].includes(debug),
            resources: {
              assets: store.project.assets ?? {},
              documents: store.project.editorMeta.spriteEditorDocuments.map(
                (d) => (d.id === doc.id ? activeDocument : d),
              ),
            },
          },
        );
        const humanoid =
            template.skeletonFamily !== "custom_2d_v1" &&
            entity.entityType === "character",
          xrayMode =
            debug === "bones"
              ? "skeleton"
              : debug === "rig"
                ? "rig"
                : debug === "depth"
                  ? "depth"
                  : "normal";
        if (humanoid && xrayMode !== "normal") {
          if (!supportsAnimationXRay(scene)) onError(XRAY_UNSUPPORTED);
          scene = presentAnimationXRay(
            scene,
            store.project.items,
            { ...DEFAULT_XRAY_OPTIONS, mode: xrayMode },
            entity.appearance?.view ?? "front",
          );
        }
        const buffer = document.createElement("canvas");
        const resolution = Math.max(1, Math.min(4, 512 / Math.max(doc.width, doc.height)));
        buffer.width = Math.ceil(doc.width * resolution);
        buffer.height = Math.ceil(doc.height * resolution);
        const ctx = buffer.getContext("2d")!;
        ctx.scale(resolution, resolution);
        if (!doc.studioEntityId) {
          const scale = Math.min(
            doc.width / template.previewWidth,
            doc.height / template.previewHeight,
          );
          ctx.translate(doc.width / 2, doc.height / 2);
          ctx.scale(scale, scale);
        }
        for (const v of scene.visuals) {
          await drawVisual(
            ctx,
            !humanoid && debug === "rig"
              ? { ...v, tint: stablePartColor(v.id.split("__").at(-1)!) }
              : !humanoid && debug === "depth"
                ? {
                    ...v,
                    tint: v.renderDepth
                      ? DEPTH_COLORS[v.renderDepth.slot]
                      : "#7c8491",
                  }
                : v,
          );
          if (v.surface && (debug === "mesh" || debug === "weights")) {
            ctx.save();
            ctx.transform(...v.worldMatrix);
            ctx.strokeStyle = "#67efce";
            ctx.lineWidth = 0.8;
            for (let i = 0; i < v.surface.triangles.length; i += 3) {
              ctx.beginPath();
              v.surface.triangles
                .slice(i, i + 3)
                .map((n) => v.surface!.vertices[n])
                .forEach((p, j) =>
                  j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
                );
              ctx.closePath();
              if (debug === "weights") {
                const weight =
                  v.surface.triangles
                    .slice(i, i + 3)
                    .reduce(
                      (sum, n) =>
                        sum +
                        (v.surface!.vertices[n].weights?.find(
                          (w) => w.boneId === selectedBone,
                        )?.weight ?? 0),
                      0,
                    ) / 3;
                ctx.fillStyle =
                  "hsl(" + (240 - 240 * weight) + " 95% 55% / .5)";
                ctx.fill();
              }
              ctx.stroke();
            }
            if (debug === "weights")
              for (const p of v.surface.vertices) {
                ctx.fillStyle =
                  "hsl(" +
                  (240 -
                    240 *
                      (p.weights?.find((w) => w.boneId === selectedBone)
                        ?.weight ?? 0)) +
                  " 95% 55%)";
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();
              }
            ctx.restore();
          }
        }
        if (humanoid && scene.presentation?.supported) {
          const fw = template.previewWidth,
            fh = template.previewHeight,
            overlay = xrayOverlaySvg(
              scene,
              Math.min(doc.width / fw, doc.height / fh),
            );
          const image = await loadImage(
            svgToDataUrl(
              '<svg xmlns="http://www.w3.org/2000/svg" width="' +
                fw +
                '" height="' +
                fh +
                '" viewBox="' +
                -fw / 2 +
                " " +
                -fh / 2 +
                " " +
                fw +
                " " +
                fh +
                '">' +
                overlay +
                "</svg>",
            ),
          );
          ctx.drawImage(image, -fw / 2, -fh / 2, fw, fh);
        }
        if ((debug === "bones" && !humanoid) || debug === "pivots")
          for (const bone of template.bones) {
            const b = skeleton.bones.get(bone.id),
              parent = bone.parentId ? skeleton.bones.get(bone.parentId) : null;
            if (!b) continue;
            ctx.strokeStyle = "#ffcd55";
            ctx.fillStyle = "#ffcd55";
            ctx.lineWidth = 2;
            if (parent && debug === "bones") {
              ctx.beginPath();
              ctx.moveTo(parent.x, parent.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        if (debug === "z") {
          ctx.fillStyle = "#fff";
          ctx.font = "12px sans-serif";
          scene.visuals.forEach((v, i) =>
            ctx.fillText(
              i + ": " + (v.boneId ?? v.id) + " [" + v.zIndex + "]",
              8,
              16 + i * 15,
            ),
          );
        }
        if (token !== generation.current || stopped) return;
        const canvas = ref.current;
        if (canvas) {
          canvas.width = buffer.width;
          canvas.height = buffer.height;
          canvas.getContext("2d")!.drawImage(buffer, 0, 0);
        }
      } catch (error) {
        if (!stopped)
          onError(error instanceof Error ? error.message : String(error));
      } finally {
        busy = false;
        if (dirty && !stopped)
          requestAnimationFrame(
            () => void render(animController.currentTimeMs),
          );
      }
    };
    void render(animController.currentTimeMs);
    const remove = animController.addTickListener((time) => void render(time));
    return () => {
      stopped = true;
      generation.current++;
      remove();
    };
  }, [doc, revision, draft, debug, selectedBone, poseOverride]);
  return (
    <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center bg-[#20232a] p-3">
      <canvas
        data-testid="studio-animation-preview"
        ref={ref}
        width={doc.width}
        height={doc.height}
        className="max-w-full max-h-full"
        style={{
          aspectRatio: doc.width + " / " + doc.height,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "#292c32",
        }}
      />
    </div>
  );
}
