import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play, Pause, Square, SkipBack, SkipForward, Repeat,
  ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, AlignLeft,
} from "lucide-react";
import { useState, useRef, useCallback, useMemo } from "react";
import { getClipsForTemplate } from "@/lib/animationCompatibility";
import { getAllBoneIds, getKeyframesForBone, timeMsToFrame, frameToTimeMs } from "@/lib/animationRuntime";
import { resolveTemplate } from "@/data/templates";
import type { Keyframe } from "@/domain/types";

const TRACK_H = 24;
const LABEL_W = 80;
const LAYER_BADGE: Record<string, string> = {
  full_body: "bg-blue-500/20 text-blue-400",
  upper_body: "bg-amber-500/20 text-amber-400",
  lower_body: "bg-green-500/20 text-green-400",
  additive: "bg-purple-500/20 text-purple-400",
};

const GROUP_NAMES: Record<string, string[]> = {
  "Idles (Torso)": [
    "idle_01_relaxed","idle_02_breathing","idle_03_shifting",
    "idle_04_look_around","idle_05_scratch","idle_06_sway",
    "idle_07_combat_ready","idle_08_tense","idle_09_bored",
    "idle_10_alert","idle_11_fidget","idle_12_roll_shoulders",
    "idle_13_tap_foot","idle_14_cross_arms","idle_15_lean",
  ],
  "Locomotion": ["idle_full","walk","run"],
  "Combat": ["melee_attack","ranged_attack","cast","block"],
  "Reactions": ["hurt","stagger","death"],
  "Actions": ["sit","interact","farm_work","carry"],
  "Monster": ["roar","charge"],
  "Quadruped": ["idle","walk","trot","gallop","rear","bite","hurt","death"],
  "Bird": ["idle","flap","glide","peck","hurt","death"],
  "Siege": ["idle","fire","open","close"],
};

export function TimelinePanel() {
  const activeEntityId   = useStore(s => s.project.activeEntityId);
  const project          = useStore(s => s.project);
  const entities         = useStore(s => s.project.entities);
  const animationClips   = useStore(s => s.project.animationClips);
  const activeClipId     = useStore(s => s.animPlayback.activeClipId);
  const timeMs           = useStore(s => s.animPlayback.timeMs);
  const playing          = useStore(s => s.animPlayback.playing);
  const looping          = useStore(s => s.animPlayback.looping);
  const zoomPx           = useStore(s => s.animPlayback.zoomPx);
  const setPlaybackClip  = useStore(s => s.setPlaybackClip);
  const setPlaybackTime  = useStore(s => s.setPlaybackTime);
  const setPlaybackPlaying  = useStore(s => s.setPlaybackPlaying);
  const setPlaybackLooping  = useStore(s => s.setPlaybackLooping);
  const setTimelineZoom  = useStore(s => s.setTimelineZoom);

  const [showMs, setShowMs] = useState(false);
  const [selectedKf, setSelectedKf] = useState<{ boneId: string; kf: Keyframe } | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const upperClipId      = useStore(s => s.animPlayback.upperClipId);
  const lowerClipId      = useStore(s => s.animPlayback.lowerClipId);
  const upperBlendWeight = useStore(s => s.animPlayback.upperBlendWeight);
  const setUpperClip     = useStore(s => s.setUpperClip);
  const setLowerClip     = useStore(s => s.setLowerClip);
  const setBlendWeight   = useStore(s => s.setBlendWeight);

  const activeEntity = entities.find(e => e.id === activeEntityId) ?? null;
  const template = activeEntity ? resolveTemplate(project, activeEntity.templateId) : undefined;

  const familyClips = useMemo(() => {
    if (!template) return animationClips;
    return getClipsForTemplate(template, animationClips);
  }, [template, animationClips]);

  const activeClip = useMemo(
    () => animationClips.find(c => c.id === activeClipId) ?? null,
    [animationClips, activeClipId],
  );

  const durationMs = activeClip?.durationMs ?? 2000;
  const fps        = activeClip?.fps ?? 12;
  const rulerW     = (durationMs / 1000) * zoomPx;
  const playheadX  = (timeMs / durationMs) * rulerW;

  type TrackRow = { layerMask: string; boneId: string; keyframes: Keyframe[] };

  const buildRows = (clip: typeof activeClip): TrackRow[] => {
    if (!clip) return [];
    const rows: TrackRow[] = [];
    for (const layer of clip.layers) {
      for (const track of layer.tracks) {
        rows.push({ layerMask: layer.mask, boneId: track.boneId, keyframes: track.keyframes });
      }
    }
    return rows;
  };

  // Track sections: BASE clip + any active upper/lower layer clips
  const trackSections = useMemo(() => {
    const sections: {
      label:      string;
      labelClass: string;
      clipName:   string;
      rows:       TrackRow[];
      clipDurationMs: number;
    }[] = [];

    if (activeClip) {
      sections.push({
        label:          "BASE",
        labelClass:     "bg-blue-500/20 text-blue-400 border border-blue-500/30",
        clipName:       activeClip.label,
        rows:           buildRows(activeClip),
        clipDurationMs: activeClip.durationMs,
      });
    }

    const upperClip = animationClips.find(c => c.id === upperClipId) ?? null;
    if (upperClip) {
      sections.push({
        label:          "UPPER",
        labelClass:     "bg-amber-500/20 text-amber-400 border border-amber-500/30",
        clipName:       upperClip.label,
        rows:           buildRows(upperClip),
        clipDurationMs: upperClip.durationMs,
      });
    }

    const lowerClip = animationClips.find(c => c.id === lowerClipId) ?? null;
    if (lowerClip) {
      sections.push({
        label:          "LOWER",
        labelClass:     "bg-green-500/20 text-green-400 border border-green-500/30",
        clipName:       lowerClip.label,
        rows:           buildRows(lowerClip),
        clipDurationMs: lowerClip.durationMs,
      });
    }

    return sections;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip, upperClipId, lowerClipId, animationClips]);

  // Grouped clip list for current family
  const clipGroups = useMemo(() => {
    const groups: { group: string; clips: typeof familyClips }[] = [];
    const usedIds = new Set<string>();
    for (const [group, names] of Object.entries(GROUP_NAMES)) {
      const matched = familyClips.filter(c => names.includes(c.name) && !usedIds.has(c.id));
      if (matched.length) {
        matched.forEach(c => usedIds.add(c.id));
        groups.push({ group, clips: matched });
      }
    }
    // catch-all for remaining clips
    const rest = familyClips.filter(c => !usedIds.has(c.id));
    if (rest.length) groups.push({ group: "Other", clips: rest });
    return groups;
  }, [familyClips]);

  // Playhead drag
  const scrub = useCallback((clientX: number) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rulerW));
    setPlaybackTime((x / rulerW) * durationMs);
  }, [rulerW, durationMs, setPlaybackTime]);

  const onRulerPointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setPlaybackPlaying(false);
    scrub(e.clientX);
  }, [scrub, setPlaybackPlaying]);

  const onRulerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    scrub(e.clientX);
  }, [scrub]);

  const onRulerPointerUp = useCallback(() => { isDragging.current = false; }, []);

  // Format time label
  const fmtTime = (t: number) => {
    if (showMs) return `${Math.round(t)}ms`;
    return `${timeMsToFrame(t, fps)}f`;
  };

  // Ruler tick interval
  const tickInterval = zoomPx < 60 ? 500 : zoomPx < 120 ? 250 : 100; // ms per tick
  const tickCount = Math.ceil(durationMs / tickInterval) + 1;

  return (
    <div data-testid="timeline-panel" className="flex flex-col h-full bg-sidebar">
      {/* ── Header: transport + zoom ── */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border flex-shrink-0 bg-sidebar">
        {/* Rewind to start */}
        <Button size="icon" variant="ghost" className="h-6 w-6"
          onClick={() => { setPlaybackTime(0); setPlaybackPlaying(false); }}
          data-testid="timeline-rewind" title="Rewind to start">
          <SkipBack className="w-3 h-3" />
        </Button>
        {/* Step back 1 frame */}
        <Button size="icon" variant="ghost" className="h-6 w-6"
          onClick={() => {
            setPlaybackPlaying(false);
            setPlaybackTime(Math.max(0, timeMs - frameToTimeMs(1, fps)));
          }}
          data-testid="timeline-step-back" title="Step back 1 frame">
          <ChevronLeft className="w-3 h-3" />
        </Button>
        {/* Play / Pause */}
        <Button size="icon" variant={playing ? "default" : "ghost"} className="h-6 w-6"
          onClick={() => setPlaybackPlaying(!playing)}
          data-testid="timeline-play">
          {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </Button>
        {/* Stop (pause + rewind) */}
        <Button size="icon" variant="ghost" className="h-6 w-6"
          onClick={() => { setPlaybackPlaying(false); setPlaybackTime(0); }}
          data-testid="timeline-stop" title="Stop">
          <Square className="w-3 h-3" />
        </Button>
        {/* Step forward 1 frame */}
        <Button size="icon" variant="ghost" className="h-6 w-6"
          onClick={() => {
            setPlaybackPlaying(false);
            setPlaybackTime(Math.min(durationMs, timeMs + frameToTimeMs(1, fps)));
          }}
          data-testid="timeline-step-forward" title="Step forward 1 frame">
          <ChevronRight className="w-3 h-3" />
        </Button>
        {/* Skip to end */}
        <Button size="icon" variant="ghost" className="h-6 w-6"
          onClick={() => { setPlaybackTime(durationMs); setPlaybackPlaying(false); }}
          data-testid="timeline-end" title="Skip to end">
          <SkipForward className="w-3 h-3" />
        </Button>
        <Button size="icon" variant={looping ? "default" : "ghost"} className="h-6 w-6"
          onClick={() => setPlaybackLooping(!looping)} title="Loop">
          <Repeat className="w-3 h-3" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Time display */}
        <button
          className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1 rounded hover:bg-accent transition-colors min-w-[48px] text-center"
          onClick={() => setShowMs(v => !v)}
          title="Toggle ms/frames"
        >
          {fmtTime(timeMs)} / {fmtTime(durationMs)}
        </button>

        {activeClip && (
          <span className="text-[10px] text-muted-foreground hidden sm:block ml-1">
            {activeClip.fps}fps
          </span>
        )}

        <div className="flex-1" />

        {/* Zoom */}
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setTimelineZoom(zoomPx / 1.4)} title="Zoom out">
          <ZoomOut className="w-3 h-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setTimelineZoom(zoomPx * 1.4)} title="Zoom in">
          <ZoomIn className="w-3 h-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setTimelineZoom(120)} title="Reset zoom">
          <AlignLeft className="w-3 h-3" />
        </Button>
      </div>

      {/* ── Multi-clip blend row ── */}
      {activeEntity && (
        <div className="flex items-center gap-2 px-2 py-1 border-b border-border flex-shrink-0 bg-background/40">
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider w-14 flex-shrink-0">Blend</span>
          {/* Upper body override */}
          <span className="text-[9px] text-amber-400/80">↑ Upper:</span>
          <select
            className="text-[9px] bg-background border border-border rounded px-1 py-0 h-5 text-foreground max-w-[120px] cursor-pointer"
            value={upperClipId ?? ""}
            onChange={e => setUpperClip(e.target.value || null)}
            title="Upper-body clip overlay (plays simultaneously with base clip)"
          >
            <option value="">— none —</option>
            {animationClips.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {upperClipId && (
            <button
              className="text-[9px] text-muted-foreground hover:text-foreground leading-none"
              onClick={() => setUpperClip(null)}
              title="Clear upper body override"
            >✕</button>
          )}

          {/* Blend weight slider (only visible when upper clip is active) */}
          {upperClipId && (
            <>
              <div className="w-px h-3 bg-border mx-0.5 flex-shrink-0" />
              <span className="text-[9px] text-muted-foreground/60">wt:</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={upperBlendWeight}
                onChange={e => setBlendWeight(parseFloat(e.target.value))}
                className="w-14 h-3 cursor-pointer accent-amber-400"
                title={`Upper blend weight: ${upperBlendWeight.toFixed(2)}`}
              />
              <span className="text-[9px] font-mono text-amber-400/80 w-6 flex-shrink-0">
                {upperBlendWeight.toFixed(2)}
              </span>
            </>
          )}

          <div className="w-px h-3 bg-border mx-0.5 flex-shrink-0" />

          {/* Lower body override */}
          <span className="text-[9px] text-green-400/80">↓ Lower:</span>
          <select
            className="text-[9px] bg-background border border-border rounded px-1 py-0 h-5 text-foreground max-w-[120px] cursor-pointer"
            value={lowerClipId ?? ""}
            onChange={e => setLowerClip(e.target.value || null)}
            title="Lower-body clip override (plays simultaneously with base clip)"
          >
            <option value="">— none —</option>
            {animationClips.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {lowerClipId && (
            <button
              className="text-[9px] text-muted-foreground hover:text-foreground leading-none"
              onClick={() => setLowerClip(null)}
              title="Clear lower body override"
            >✕</button>
          )}
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* LEFT: clip list */}
        <div className="w-44 flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 ide-scroll">
            {!activeEntity ? (
              <p className="text-[10px] text-muted-foreground px-3 py-4">No entity selected.</p>
            ) : clipGroups.length === 0 ? (
              <p className="text-[10px] text-muted-foreground px-3 py-4">No clips for this family.</p>
            ) : clipGroups.map(({ group, clips }) => (
              <div key={group} className="mb-1">
                <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider px-3 py-0.5 bg-background/40 sticky top-0">
                  {group}
                </p>
                {clips.map(clip => (
                  <button
                    key={clip.id}
                    data-testid={`clip-${clip.name}`}
                    onClick={() => setPlaybackClip(clip.id)}
                    className={`
                      w-full text-left text-[11px] px-3 py-0.5 truncate transition-colors
                      ${clip.id === activeClipId
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }
                    `}
                  >
                    {clip.label}
                  </button>
                ))}
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* RIGHT: ruler + tracks */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Ruler row */}
          <div
            ref={rulerRef}
            className="h-6 border-b border-border bg-background flex-shrink-0 relative select-none cursor-crosshair overflow-x-auto overflow-y-hidden"
            style={{ minWidth: LABEL_W }}
            onPointerDown={onRulerPointerDown}
            onPointerMove={onRulerPointerMove}
            onPointerUp={onRulerPointerUp}
          >
            <div className="relative h-full" style={{ width: Math.max(rulerW, 100) }}>
              {/* Ticks */}
              {Array.from({ length: tickCount }, (_, i) => {
                const t = i * tickInterval;
                if (t > durationMs) return null;
                const x = (t / durationMs) * rulerW;
                const major = t % (tickInterval * 4) === 0;
                return (
                  <div key={i} className="absolute top-0 flex flex-col items-start" style={{ left: x }}>
                    <div className={`w-px ${major ? "h-4 bg-border" : "h-2 bg-border/50"}`} />
                    {major && (
                      <span className="text-[8px] text-muted-foreground/70 ml-0.5 leading-none">
                        {fmtTime(t)}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* Duration marker */}
              <div className="absolute top-0 h-full w-px bg-red-500/50" style={{ left: rulerW }} />
              {/* Playhead */}
              <div
                className="absolute top-0 h-full w-0.5 bg-primary z-10 pointer-events-none"
                style={{ left: playheadX }}
              />
            </div>
          </div>

          {/* Track area */}
          <ScrollArea className="flex-1 ide-scroll">
            {trackSections.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Select an animation clip to view its keyframe tracks.
              </div>
            ) : (
              <div className="relative" style={{ width: Math.max(rulerW + LABEL_W, 200) }}>
                {trackSections.map(section => (
                  <div key={section.label}>
                    {/* Section header: clip layer badge + clip name */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-background/70 border-b border-border/60 sticky left-0 z-10">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded leading-none ${section.labelClass}`}>
                        {section.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground truncate">{section.clipName}</span>
                      <span className="text-[8px] text-muted-foreground/50 ml-auto flex-shrink-0">
                        {section.rows.length} tracks
                      </span>
                    </div>

                    {/* Track rows for this clip */}
                    {section.rows.map(({ layerMask, boneId, keyframes }) => {
                      const clipRulerW = (section.clipDurationMs / 1000) * zoomPx;
                      return (
                        <div
                          key={`${section.label}-${layerMask}-${boneId}`}
                          className="flex border-b border-border/30 hover:bg-accent/10 transition-colors"
                          style={{ height: TRACK_H }}
                        >
                          {/* Bone label */}
                          <div
                            className="flex-shrink-0 flex items-center gap-1 px-1.5 border-r border-border/40"
                            style={{ width: LABEL_W }}
                          >
                            <span className={`text-[8px] px-1 rounded leading-none py-0.5 ${LAYER_BADGE[layerMask] ?? ""}`}>
                              {layerMask.replace("_body", "").replace("_", "")}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">{boneId}</span>
                          </div>

                          {/* Track lane */}
                          <div className="relative flex-1" style={{ height: TRACK_H }}>
                            {/* Playhead */}
                            <div
                              className="absolute top-0 h-full w-px bg-primary/25 pointer-events-none z-10"
                              style={{ left: playheadX }}
                            />
                            {/* Keyframe diamonds */}
                            {keyframes.map((kf, ki) => {
                              const kx = (kf.timeMs / section.clipDurationMs) * clipRulerW;
                              const isSelected = selectedKf?.kf === kf;
                              return (
                                <div
                                  key={ki}
                                  data-testid="keyframe-diamond"
                                  className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 cursor-pointer z-20 border transition-colors
                                    ${isSelected
                                      ? "bg-primary border-primary-foreground shadow-md"
                                      : "bg-primary/60 border-primary/30 hover:bg-primary"
                                    }`}
                                  style={{ left: kx - 5 }}
                                  onClick={() => setSelectedKf(prev =>
                                    prev?.kf === kf ? null : { boneId, kf }
                                  )}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {section.rows.length === 0 && (
                      <div className="py-2 text-center text-[10px] text-muted-foreground">
                        No keyframe tracks in this clip.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Keyframe inspector */}
          {selectedKf && (
            <div className="border-t border-border flex-shrink-0 bg-background/80 px-3 py-1.5 flex gap-4 flex-wrap">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider self-center">
                {selectedKf.boneId} @ {fmtTime(selectedKf.kf.timeMs)}
              </span>
              {(["tx","ty","rotation","scaleX","scaleY"] as const).map(k => {
                const v = selectedKf.kf.transform[k];
                return (
                  <span key={k} className="text-[10px]">
                    <span className="text-muted-foreground">{k}: </span>
                    <span className="font-mono text-foreground">{v.toFixed(2)}</span>
                  </span>
                );
              })}
              <span className="text-[10px]">
                <span className="text-muted-foreground">easing: </span>
                <span className="font-mono">{selectedKf.kf.easing}</span>
              </span>
              <button
                className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedKf(null)}
              >✕</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
