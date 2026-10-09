import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { resolveTemplate } from "@/data/templates";
import { refreshCanonicalBuiltInTypedItems } from "@/lib/canonicalItems";
import { animationReviewArchive, buildAnimationReview, reviewMarkersFor, validateReviewMarkers, type ReviewMarker } from "@/lib/animationReview";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function AnimationReviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const project = useStore(s => s.project);
  const clipId = useStore(s => s.animPlayback.activeClipId);
  const options = useStore(s => s.animationXRay);
  const saveMarkers = useStore(s => s.setAnimationReviewMarkers);
  const clip = project.animationClips.find(c => c.id === clipId);
  const entity = project.entities.find(e => e.id === project.activeEntityId);
  const template = entity && resolveTemplate(project, entity.templateId);
  const [markers, setMarkers] = useState<ReviewMarker[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (open && clip) { setMarkers(reviewMarkersFor(clip)); setError(""); setSaved(false); }
  // Keep edits local until the user explicitly saves them.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clip?.id]);
  const validation = clip ? validateReviewMarkers(markers, clip.durationMs) : "Select an animation clip.";
  const edit = (next: ReviewMarker[]) => { setMarkers(next); setSaved(false); setError(""); };
  const exportReview = async () => {
    if (!entity || !template || !clip || validation) return;
    setBusy(true); setError("");
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const review = buildAnimationReview({ entity, template, clips: project.animationClips, clip,
        items: refreshCanonicalBuiltInTypedItems(project.items), fitProfiles: project.itemFitProfiles, markers, options });
      const archive = await animationReviewArchive(review);
      const url = URL.createObjectURL(new Blob([new Uint8Array(archive).buffer], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${clip.name.replace(/[^a-zA-Z0-9_-]/g, "_") || "animation"}-xray-review.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogTitle>Скачать проверку анимации</DialogTitle>
      <DialogDescription>{clip?.label ?? "Select an animation"} · Справа и слева · Обычный вид / Цвета скелета / Цвета глубины / Скелет. SVG, PNG и JSON диагностики.</DialogDescription>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_100px_32px] gap-2 text-xs text-muted-foreground"><span>Фаза</span><span>Время, мс</span><span /></div>
        {markers.map((marker, i) => <div key={i} className="grid grid-cols-[1fr_100px_32px] gap-2">
          <input aria-label={`Review phase ${i + 1}`} disabled={busy} className="min-w-0 rounded border bg-background px-2 py-1 text-sm" value={marker.label} onChange={e => edit(markers.map((m, j) => j === i ? { ...m, label: e.target.value } : m))} />
          <input aria-label={`Review time ${i + 1}`} disabled={busy} type="number" min={0} max={clip?.durationMs} step="any" className="min-w-0 rounded border bg-background px-2 py-1 text-sm" value={Number.isNaN(marker.timeMs) ? "" : marker.timeMs} onChange={e => edit(markers.map((m, j) => j === i ? { ...m, timeMs: e.target.valueAsNumber } : m))} />
          <button aria-label={`Remove review marker ${i + 1}`} disabled={busy} onClick={() => edit(markers.filter((_, j) => j !== i))}>×</button>
        </div>)}
        <Button variant="outline" size="sm" disabled={busy || !clip} onClick={() => edit([...markers, { label: "Поза", timeMs: clip?.durationMs ?? 0 }])}>Добавить маркер</Button>
      </div>
      <p className="text-xs text-muted-foreground">Маркеры сохраняются кнопкой «Сохранить маркеры в клип». Цвета скелета учитывают глубину. Экипировка и подписи зависят от настроек диагностики.</p>
      {(validation || error) && <p role="alert" className="text-sm text-red-400">{error || validation}</p>}
      {saved && <p role="status" className="text-sm text-emerald-400">Маркеры сохранены в клип.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy || !!validation || !clip} onClick={() => { if (clip) { saveMarkers(clip.id, markers); setSaved(true); } }}>Сохранить маркеры в клип</Button>
        <Button disabled={busy || !!validation || !entity || !template} onClick={exportReview}>{busy ? "Подготовка…" : "Скачать проверку в ZIP"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
