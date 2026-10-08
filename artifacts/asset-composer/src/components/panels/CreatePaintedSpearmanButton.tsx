import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import { resolveTemplate } from "@/data/templates";
import { studioCommit } from "@/lib/studioActions";
import { SPEARMAN_TEMPLATE_ID } from "@/data/spearmanAnimation";

export function CreatePaintedSpearmanButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    setError(""); setBusy(true);
    try {
      const [{ createPaintedSpearman, appendPaintedSpearman }, { loadPaintedSpearmanAssets }] = await Promise.all([
        import("@/data/paintedSpearman"), import("@/data/paintedSpearmanAssets"),
      ]);
      const assets = await loadPaintedSpearmanAssets();
      const store = useStore.getState();
      const existing = store.project.entities.find(e => e.templateId === SPEARMAN_TEMPLATE_ID);
      let id = existing?.id;
      if (!id) {
        const base = resolveTemplate(store.project, "biped_profile_base_v1");
        if (!base) throw new Error("Шаблон чиби недоступен");
        const bundle = createPaintedSpearman(base, assets);
        id = bundle.entity.id;
        studioCommit("Создать рисованного копейщика", project => appendPaintedSpearman(project, bundle));
      }
      useStore.getState().setActiveEntity(id);
      useStore.getState().setPlaybackClip("spearman__thrust");
      useStore.getState().setPlaybackPlaying(false);
      useStore.getState().setPlaybackTime(0);
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось создать копейщика"); }
    finally { setBusy(false); }
  }
  return <>
    <Button size="sm" variant="outline" className="w-full h-8 text-xs mt-1" disabled={busy} onClick={create}>
      {busy ? "Загружаю рисунок…" : "Копейщик · Рисованный чиби"}
    </Button>
    {error && <p role="alert" className="text-xs text-destructive mt-1">{error}</p>}
  </>;
}
