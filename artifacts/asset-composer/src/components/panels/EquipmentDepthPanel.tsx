import { useState } from "react";
import { useStore } from "@/store";
import { PRESET_ANIMATIONS } from "@/data/presetAnimations";
import { resolveTemplate } from "@/data/templates";
import { DEPTH_SLOTS, resolveEquipmentDepth } from "@/lib/limbDepth";
import { newId, studioCommit } from "@/lib/studioActions";
import type { AnimationClip, DepthSlot } from "@/domain/types";

export function EquipmentDepthPanel() {
  const project = useStore((s) => s.project);
  const playback = useStore((s) => s.animPlayback);
  const entity = project.entities.find((e) => e.id === project.activeEntityId);
  const clip = project.animationClips.find(
    (c) => c.id === playback.activeClipId,
  );
  const equipped =
    entity?.slots.filter(
      (s) =>
        s.itemId &&
        project.items.some(
          (i) =>
            i.id === s.itemId &&
            ["weapon_main", "weapon_off", "shield"].includes(i.category),
        ),
    ) ?? [];
  const [chosenSlot, setSlot] = useState("");
  const [partId, setPart] = useState("");
  const [depth, setDepth] = useState<DepthSlot | "inherit">("EQUIPMENT_FRONT");
  const [hands, setHands] = useState(true);
  const [directionOnly, setDirectionOnly] = useState(false);
  const [setupDraft, setSetupDraft] = useState<{
    key: string;
    near: DepthSlot;
    far: DepthSlot;
  } | null>(null);
  if (!clip || !entity || !equipped.length) return null;
  const slotId = equipped.some((s) => s.slotId === chosenSlot)
    ? chosenSlot
    : equipped[0].slotId;
  const item = project.items.find(
    (i) => i.id === equipped.find((s) => s.slotId === slotId)?.itemId,
  )!;
  const facing = entity.appearance?.view === "left" ? "left" : "right";
  const handBones =
    resolveTemplate(project, entity.templateId)
      ?.bones.filter((b) => b.id === "hand_l" || b.id === "hand_r")
      .map((b) => b.id) ?? [];
  const resolved = resolveEquipmentDepth(
    clip,
    slotId,
    partId || undefined,
    playback.timeMs,
    facing,
  );
  const tracks =
    clip.equipmentDepth?.filter(
      (t) => t.slotId === slotId && (t.partId ?? "") === partId,
    ) ?? [];
  const selectedParts =
    item.parts?.filter((p) => !partId || p.id === partId) ?? [];
  const setupKey = `${item.id}:${partId}`;
  const binding = selectedParts[0]?.depthBinding;
  const setup =
    setupDraft?.key === setupKey
      ? setupDraft
      : {
          key: setupKey,
          near: binding?.nearSlot ?? ("EQUIPMENT_FRONT" as DepthSlot),
          far: binding?.farSlot ?? ("BODY_BACK" as DepthSlot),
        };
  function edit(change: (c: AnimationClip) => void) {
    let id = clip!.id;
    studioCommit("Equipment depth key", (p) => {
      let c = p.animationClips.find((c) => c.id === clip!.id)!;
      if (PRESET_ANIMATIONS.some((preset) => preset.id === c.id)) {
        c = structuredClone(clip!);
        c.id = id = newId();
        c.name += "_equipment";
        c.label += " · Equipment";
        c.templateId = resolveTemplate(p, entity!.templateId)?.id;
        p.animationClips.push(c);
      }
      p.entities.find((e) => e.id === entity!.id)!.activeAnimationClipId = id;
      change(c);
    });
    if (id !== clip!.id) {
      const store = useStore.getState();
      store.setPlaybackClip(id);
      store.setPlaybackTime(playback.timeMs);
      store.setPlaybackLooping(playback.looping);
      store.setPlaybackPlaying(playback.playing);
    }
  }
  const control =
    "bg-muted border border-border rounded px-1 py-0.5 text-[10px]";
  return (
    <details className="border-b border-border px-2 py-1 shrink-0 text-[10px]">
      <summary className="cursor-pointer">
        Equipment Depth · {resolved?.slot ?? "Setup / inherited"} ·{" "}
        {Math.round(playback.timeMs)} ms
      </summary>
      <div className="flex flex-wrap gap-2 items-center py-1">
        <select
          aria-label="Equipment depth slot"
          className={control}
          value={slotId}
          onChange={(e) => {
            setSlot(e.target.value);
            setPart("");
          }}
        >
          {equipped.map((s) => (
            <option key={s.slotId} value={s.slotId}>
              {project.items.find((i) => i.id === s.itemId)?.name} · {s.slotId}
            </option>
          ))}
        </select>
        <select
          aria-label="Equipment depth part"
          className={control}
          value={partId}
          onChange={(e) => setPart(e.target.value)}
        >
          <option value="">All parts</option>
          {item.parts?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>
        <select
          aria-label="Equipment depth layer"
          className={control}
          value={depth}
          onChange={(e) => setDepth(e.target.value as typeof depth)}
        >
          <option value="inherit">Setup / inherited</option>
          {Object.keys(DEPTH_SLOTS).map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            disabled={!handBones.length}
            checked={hands && !!handBones.length}
            onChange={(e) => setHands(e.target.checked)}
          />{" "}
          Hands cover grip
        </label>
        <label>
          <input
            type="checkbox"
            checked={directionOnly}
            onChange={(e) => setDirectionOnly(e.target.checked)}
          />{" "}
          Only {facing.toUpperCase()}
        </label>
        <button
          className={control}
          onClick={() =>
            edit((c) => {
              c.equipmentDepth ??= [];
              let track = c.equipmentDepth.find(
                (t) => t.slotId === slotId && (t.partId ?? "") === partId,
              );
              if (!track) {
                track = { slotId, partId: partId || undefined, keyframes: [] };
                c.equipmentDepth.push(track);
              }
              const timeMs = Math.min(
                c.durationMs,
                Math.max(0, Math.round(playback.timeMs)),
              );
              const keyFacing = directionOnly ? facing : undefined;
              track.keyframes = track.keyframes.filter(
                (k) => k.timeMs !== timeMs || k.facing !== keyFacing,
              );
              track.keyframes.push({
                timeMs,
                facing: keyFacing,
                slot: depth === "inherit" ? null : depth,
                occludedByBones: hands ? handBones : [],
              });
              track.keyframes.sort((a, b) => a.timeMs - b.timeMs);
            })
          }
        >
          Set depth key
        </button>
      </div>
      {!!selectedParts.length && (
        <fieldset className="border border-border rounded px-2 py-1 my-1">
          <legend>Слои предмета во всех клипах</legend>
          <div className="flex flex-wrap gap-2 items-center">
            <label>
              Ближняя сторона{" "}
              <select
                aria-label="Setup equipment near layer"
                className={control}
                value={setup.near}
                onChange={(e) =>
                  setSetupDraft({ ...setup, near: e.target.value as DepthSlot })
                }
              >
                {Object.keys(DEPTH_SLOTS).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Дальняя сторона{" "}
              <select
                aria-label="Setup equipment far layer"
                className={control}
                value={setup.far}
                onChange={(e) =>
                  setSetupDraft({ ...setup, far: e.target.value as DepthSlot })
                }
              >
                {Object.keys(DEPTH_SLOTS).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <button
              className={control}
              onClick={() =>
                studioCommit("Equipment setup depth", (p) => {
                  const target = p.items.find((i) => i.id === item.id);
                  if (!target) return;
                  for (const part of target.parts ?? [])
                    if (!partId || part.id === partId) {
                      part.depthBinding = {
                        boneId: part.boneId,
                        nearSlot: setup.near,
                        farSlot: setup.far,
                      };
                      part.occludedByBones = hands ? handBones : [];
                    }
                })
              }
            >
              Сохранить слои предмета
            </button>
          </div>
          <p className="text-muted-foreground mt-1">
            Ближняя и дальняя сторона меняются при повороте. Ключи глубины клипа
            имеют приоритет. Настройка относится к этому предмету во всех его
            экземплярах.
          </p>
        </fieldset>
      )}
      <p className="text-muted-foreground">
        Stepped layers, independent of the carrying wrist. Keys preserve the
        rigid artwork and IK; hand silhouettes cover the grip.
      </p>
      <div className="flex flex-wrap gap-2 py-1">
        {tracks.flatMap((track, ti) =>
          track.keyframes.map((key, ki) => (
            <span key={`${ti}_${ki}`}>
              <button
                className={control}
                onClick={() => {
                  useStore.getState().setPlaybackPlaying(false);
                  useStore.getState().setPlaybackTime(key.timeMs);
                  setDepth(key.slot ?? "inherit");
                  setHands(!!key.occludedByBones?.length);
                  setDirectionOnly(!!key.facing);
                }}
              >
                {key.timeMs} ms · {key.slot ?? "Setup"} · {key.facing ?? "L/R"}
              </button>
              <button
                aria-label={`Remove equipment depth key ${key.timeMs} ${key.facing ?? "both"}`}
                className={control}
                onClick={() =>
                  edit((c) => {
                    const t = c.equipmentDepth?.filter(
                      (t) => t.slotId === slotId && (t.partId ?? "") === partId,
                    )[ti];
                    if (t) t.keyframes.splice(ki, 1);
                  })
                }
              >
                ×
              </button>
            </span>
          )),
        )}
      </div>
    </details>
  );
}
