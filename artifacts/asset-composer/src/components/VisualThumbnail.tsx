import { useEffect, useMemo, useRef } from "react";
import { useStore } from "@/store";
import type { VisualContent } from "@/domain/types";
import { contentOf, contentUri } from "@/lib/visualContent";
import { resolveArtworkContent } from "@/lib/artDocument";
import { renderContent } from "@/lib/visualRenderer";
export function VisualThumbnail({
  visual,
}: {
  visual: { content?: VisualContent; svgData?: string };
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    assets = useStore((s) => s.project.assets),
    documents = useStore((s) => s.project.editorMeta.spriteEditorDocuments);
  const content = useMemo(
    () =>
      resolveArtworkContent(contentOf(visual), {
        assets: assets ?? {},
        documents,
      }),
    [visual, assets, documents],
  );
  useEffect(() => {
    if (content.kind === "vector" || content.kind === "raster") return;
    let stopped = false;
    void renderContent(content, 96, 96, assets ?? {})
      .then((image) => {
        if (stopped || !canvas.current) return;
        const ctx = canvas.current.getContext("2d")!;
        ctx.clearRect(0, 0, 96, 96);
        ctx.drawImage(image, 0, 0);
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [content, assets]);
  if (content.kind === "vector" || content.kind === "raster")
    return (
      <img
        src={contentUri(content, { assets: assets ?? {}, documents })}
        alt="Предпросмотр рисунка"
        className="w-full h-full object-contain"
      />
    );
  return (
    <canvas
      ref={canvas}
      width={96}
      height={96}
      className="w-full h-full object-contain"
      aria-label="Предпросмотр рисунка"
    />
  );
}
