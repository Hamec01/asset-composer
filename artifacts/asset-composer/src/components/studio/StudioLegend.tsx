import type { SpriteEditorDocument, Template } from "@/domain/types";
import { ANATOMY_COLORS } from "@/lib/animationXRay";
import { DEPTH_COLORS } from "@/lib/limbDepth";
import { stablePartColor } from "@/lib/studioDiagnostics";
export function StudioLegend({
  doc,
  template,
  mode,
}: {
  doc: SpriteEditorDocument;
  template?: Template;
  mode: string;
}) {
  const rows =
    mode === "depth"
      ? Object.entries(DEPTH_COLORS)
      : mode === "rig"
        ? template?.skeletonFamily === "custom_2d_v1"
          ? doc.layers
              .filter((l) => l.visible)
              .map((l) => [l.name, stablePartColor(l.id)])
          : Object.entries(ANATOMY_COLORS)
        : [];
  return rows.length ? (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] p-1 border-b">
      {rows.map(([name, color]) => (
        <span key={name}>
          <i
            className="inline-block w-2 h-2 mr-1"
            style={{ background: color }}
          />
          {name}
        </span>
      ))}
      {mode === "rig" && template?.skeletonFamily !== "custom_2d_v1" && (
        <span>Dark = FAR · base = BODY/CROSS · light = NEAR/FRONT</span>
      )}
    </div>
  ) : null;
}
