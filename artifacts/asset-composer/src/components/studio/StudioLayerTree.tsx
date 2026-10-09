import { uiLabel } from "@/lib/uiLabels";
import type { SpriteEditorDocument, SpriteEditorLayer } from "@/domain/types";
export function StudioLayerTree({
  doc,
  selectedId,
  onSelect,
  onVisibility,
}: {
  doc: SpriteEditorDocument;
  selectedId?: string;
  onSelect: (id: string) => void;
  onVisibility: (id: string, visible: boolean) => void;
}) {
  const rows = (
    parentId?: string | null,
    depth = 0,
  ): { layer: SpriteEditorLayer; depth: number }[] =>
    doc.layers
      .filter((l) => (l.parentId ?? null) === (parentId ?? null))
      .sort((a, b) => b.zIndex - a.zIndex)
      .flatMap((layer) => [{ layer, depth }, ...rows(layer.id, depth + 1)]);
  return (
    <div role="group" aria-label="Слои рисунка">
      {rows().map(({ layer: l, depth }) => (
        <div
          key={l.id}
          className={
            "flex items-center gap-1 text-xs rounded p-1 " +
            (l.id === selectedId ? "bg-accent" : "")
          }
        >
          <input
            aria-label={"Видимость: " + l.name}
            type="checkbox"
            checked={l.visible}
            onChange={(e) => onVisibility(l.id, e.target.checked)}
          />
          <button
            aria-pressed={l.id === selectedId}
            onClick={() => onSelect(l.id)}
            className="truncate flex-1 text-left"
            style={{ paddingLeft: depth * 12 }}
          >
            {l.kind === "group" ? "▾ " : l.binding ? "🦴 " : ""}
            {l.name}
          </button>
          <span className="text-muted-foreground">{uiLabel(l.kind ?? "vector")}</span>
        </div>
      ))}
    </div>
  );
}
