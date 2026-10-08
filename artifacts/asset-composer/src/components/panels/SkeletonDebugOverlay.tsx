import { useEffect, useMemo, useState } from "react";
import { Bug, Download } from "lucide-react";
import { useStore } from "@/store";
import { animController } from "@/core-v2/AnimationController";
import { resolveTemplate } from "@/data/templates";
import { getCharacterBodyParts } from "@/data/chibiBody";
import { refreshCanonicalBuiltInTypedItems } from "@/lib/canonicalItems";
import { buildMultiClipPose, evaluateSkeleton, evaluateScene } from "@/lib/evaluationPipeline";
import { DEPTH_COLORS } from "@/lib/limbDepth";
import { transformPoint, worldBoneToMatrix } from "@/lib/matrixUtils";
import { armDiagnostics } from "@/lib/armDiagnostics";
import { getAnimationContext } from "@/lib/animationContext";
import { headClearance, validateAnimationDepth, validateHeadClearance } from "@/lib/headClearance";

export function SkeletonDebugOverlay({ viewport }: { viewport: { zoom: number; panX: number; panY: number } }) {
  const project = useStore(s => s.project);
  const playback = useStore(s => s.animPlayback);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [onion, setOnion] = useState(false);
  const [joint, setJoint] = useState("");
  const [labels, setLabels] = useState(false);
  const [depthEnabled,setDepthEnabled] = useState(false);
  const [stackEnabled,setStackEnabled] = useState(false);
  const [time, setTime] = useState(animController.currentTimeMs);
  useEffect(() => enabled || depthEnabled || stackEnabled ? animController.addTickListener(setTime) : undefined, [enabled,depthEnabled,stackEnabled]);
  const entity = project.entities.find(e => e.id === project.activeEntityId);
  const template = useMemo(() => entity && resolveTemplate(project, entity.templateId), [project, entity]);
  const clip = project.animationClips.find(c => c.id === playback.activeClipId);
  const items = useMemo(() => refreshCanonicalBuiltInTypedItems(project.items), [project.items]);
  const evaluate = (ms: number) => entity && template ? evaluateSkeleton(template.bones,
    buildMultiClipPose(project.animationClips, playback.activeClipId, playback.upperClipId, playback.lowerClipId,
      playback.upperBlendWeight, ms, entity, items), entity.bodyMorphs, entity.appearance) : null;
  const trajectory = useMemo(() => {
    if (!enabled || !joint || !clip || !template || !entity) return [];
    return Array.from({ length: Math.ceil(clip.durationMs*clip.fps/1000)+1 }, (_, i) =>
      evaluate(Math.min(clip.durationMs, i*1000/clip.fps))?.bones.get(joint)).filter(p => !!p);
  }, [enabled, joint, clip, template, entity, items, playback.upperClipId, playback.lowerClipId, playback.upperBlendWeight]);
  const skeleton = (enabled || depthEnabled || stackEnabled) && evaluate(time);
  const scene = skeleton && entity && template ? evaluateScene(entity,template,skeleton,items) : null;
  const context = skeleton ? getAnimationContext(skeleton) : undefined;
  const depthWarnings = useMemo(()=>clip ? validateAnimationDepth(clip) : [],[clip]);
  const clearance = scene ? headClearance(scene.visuals) : null;
  const clearanceWarnings = scene ? validateHeadClearance(scene,context?.clip,context?.timeMs ?? time) : [];
  const rest = useMemo(() => template ? evaluateSkeleton(template.bones,new Map(),entity?.bodyMorphs,entity?.appearance) : null,
    [template,entity?.bodyMorphs,entity?.appearance]);
  const diagnostics = skeleton && rest && context ? armDiagnostics(context.clip,time,skeleton,rest,
    evaluate(Math.max(0,time-1000/(clip?.fps ?? 24))) ?? undefined,entity?.appearance?.view === "left") : [];
  const parts = entity && template ? getCharacterBodyParts(template, entity) : [];
  const exportDiagnostics = () => {
    if (!clip || !rest) return;
    const frames = Math.ceil(clip.durationMs*clip.fps/1000);
    const samples = Array.from({length:frames*2+1},(_,i) => {
      const ms = Math.min(clip.durationMs,i*500/clip.fps);
      const pose = evaluate(ms);
      const context = pose && getAnimationContext(pose);
      const evaluated=pose && entity && template ? evaluateScene(entity,template,pose,items) : null;
      return {frame:i/2,timeMs:ms,headClearance:evaluated ? validateHeadClearance(evaluated,context?.clip,context?.timeMs ?? ms) : [],arms:pose && context ? armDiagnostics(context.clip,ms,pose,rest,
        evaluate(Math.max(0,ms-500/clip.fps)) ?? undefined,entity?.appearance?.view === "left") : []};
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify({clip:clip.id,fps:clip.fps,depthWarnings,samples},null,2)],{type:"application/json"}));
    const link = document.createElement("a");
    link.href=url; link.download=`${clip.name}-arm-diagnostics.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  const draw = (ms: number, opacity: number, labels: boolean) => {
    const pose = evaluate(ms);
    if (!pose) return null;
    return <g key={ms} opacity={opacity}>
      {["l", "r"].map(side => {
        const ids = [`shoulder_${side}`, `elbow_${side}`, `hand_${side}`];
        const points = ids.map(id => pose.bones.get(id));
        if (points.some(p => !p)) return null;
        const color = side === "l" ? "#52C9FF" : "#FF738D";
        const hand = points[2]!;
        const part = parts.find(p => p.boneId === ids[2]);
        const socket = part?.gripSocket ?? part?.grip ?? { x: 0, y: 0 };
        const grip = transformPoint(worldBoneToMatrix(hand), socket.x, socket.y);
        return <g key={side} stroke={color} fill="none" strokeWidth={1/viewport.zoom}>
          <polyline points={points.map(p => `${p!.x},${p!.y}`).join(" ")} />
          {points.map((p, i) => <g key={ids[i]}>
            <circle cx={p!.x} cy={p!.y} r={2.3/viewport.zoom} fill={color} />
            {labels && <text x={p!.x+3/viewport.zoom} y={p!.y-4/viewport.zoom} fill={color} stroke="none" fontSize={9/viewport.zoom}>{["Shoulder", "Elbow", "Wrist"][i]} {side.toUpperCase()}</text>}
            {labels && [0, 1].map(axis => {
              const end = transformPoint(worldBoneToMatrix(p!), axis ? 0 : 5, axis ? 5 : 0);
              return <line key={axis} x1={p!.x} y1={p!.y} x2={end.x} y2={end.y} stroke={axis ? "#86DE99" : "#F4A968"} />;
            })}
          </g>)}
          <rect x={grip.x-1.5} y={grip.y-1.5} width={3} height={3} />
          {labels && <text x={grip.x+2} y={grip.y+4} fontSize={9/viewport.zoom} stroke="none" fill={color}>Grip {side.toUpperCase()}</text>}
        </g>;
      })}
      <polyline points={["root", "pelvis", "spine", "chest", "neck", "head"].map(id => pose.bones.get(id)).filter(p => !!p).map(p => `${p!.x},${p!.y}`).join(" ")} fill="none" stroke="#B7A2EF" strokeWidth={1/viewport.zoom} />
      {["root","pelvis","chest","neck","head"].map(id => {
        const point=pose.bones.get(id);
        return point && <g key={id}><circle cx={point.x} cy={point.y} r={2/viewport.zoom} fill="#B7A2EF" />
          {labels && <text x={point.x+3/viewport.zoom} y={point.y+8/viewport.zoom} fontSize={9/viewport.zoom} fill="#B7A2EF">{id}</text>}</g>;
      })}
    </g>;
  };
  return <>
    <div className="absolute right-3 top-3 z-20" onMouseDown={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      <button type="button" aria-label="Debug" title="Debug" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-8 items-center gap-1 rounded border border-border bg-card px-2 text-xs"><Bug size={14} />Debug</button>
      {open && <div className="absolute right-0 mt-1 w-56 rounded border border-border bg-card p-2 text-xs space-y-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Skeleton</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={depthEnabled} onChange={e => setDepthEnabled(e.target.checked)} />Depth Layers</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={stackEnabled} onChange={e => setStackEnabled(e.target.checked)} />Draw Order Inspector</label>
        <label className="flex items-center gap-2"><input type="checkbox" disabled={!enabled} checked={onion} onChange={e => setOnion(e.target.checked)} />Onion Skin</label>
        <label className="flex items-center gap-2"><input type="checkbox" disabled={!enabled} checked={labels} onChange={e => setLabels(e.target.checked)} />Joint labels</label>
        <select aria-label="Joint trajectory" disabled={!enabled} value={joint} onChange={e => setJoint(e.target.value)} className="w-full border border-border bg-card">
          <option value="">Trajectory: None</option>
          {["elbow_l", "elbow_r", "hand_l", "hand_r"].map(id => <option key={id} value={id}>{id.replace("hand", "wrist")}</option>)}
        </select>
        <button type="button" disabled={!enabled || !clip} aria-label="Export arm diagnostics" title="Export arm diagnostics" onClick={exportDiagnostics} className="flex h-6 w-6 items-center justify-center rounded border border-border"><Download size={14} /></button>
        {(depthWarnings.length>0 || clearanceWarnings.length>0) && <div aria-label="Animation validation warnings" className="max-h-40 overflow-auto border-t border-border text-amber-400">
          {[...depthWarnings,...clearanceWarnings.map(w=>w.message)].map(message=><div key={message}>{message}</div>)}
        </div>}
        {clip && <details className="border-t border-border pt-1">
          <summary className="cursor-pointer">Animation data</summary>
          <textarea aria-label="Animation data" readOnly value={JSON.stringify(clip,null,2)} className="mt-1 h-24 w-full resize-y border border-border bg-background p-1 font-mono text-[10px]" />
        </details>}
        {enabled && diagnostics.map(d => <div key={d.id} className={`border-t border-border pt-1 font-mono text-[10px] ${d.warnings.length ? "text-red-400" : "text-emerald-400"}`}>
          <div>{d.id}: {d.upper.toFixed(2)} / {d.lower.toFixed(2)}</div>
          <div>Length {d.lengthError.toFixed(2)}% · Grip {d.gripError?.toFixed(2) ?? "—"} px</div>
          <div>Δ {d.velocity.toFixed(2)} px / {d.turn.toFixed(1)}° · Bend {d.bend}</div>
          {d.warnings.length > 0 && <div>{d.warnings.join(", ")}</div>}
        </div>)}
      </div>}
    </div>
    {stackEnabled && scene && <div aria-label="Draw Order Inspector" className="absolute left-3 bottom-3 z-20 w-72 max-h-[85%] overflow-auto rounded border border-border bg-card p-2 text-[10px] font-mono" onMouseDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
      <div className="sticky top-0 bg-card pb-1 font-semibold">Draw Order · {Math.round(time*(clip?.fps ?? 24)/1000)}f · {entity?.appearance?.view}</div>
      {scene.visuals.map((visual,index)=><div key={visual.id} className="border-t border-border py-0.5" style={{color:visual.renderDepth ? DEPTH_COLORS[visual.renderDepth.slot] : undefined}}>
        <div title={`${visual.id} · ${visual.renderDepth?.segment ?? "body"} · ${visual.renderDepth?.source ?? "legacy"}`}>{String(index+1).padStart(2,"0")} {visual.renderDepth?.role} {visual.partId ?? visual.renderDepth?.boneId ?? visual.id} · {visual.renderDepth?.slot ?? "LEGACY"}</div>
        {visual.renderDepth?.source === "binding" && <div className="text-muted-foreground">Pose: {visual.renderDepth.boneId} · Depth: {visual.renderDepth.depthBoneId}</div>}
      </div>)}
    </div>}
    {skeleton && <svg aria-label="Debug skeleton" className="absolute inset-0 h-full w-full pointer-events-none z-10">
      <svg x="50%" y="50%" overflow="visible"><g transform={`translate(${viewport.panX} ${viewport.panY}) scale(${viewport.zoom})`}>
        {enabled && clearance && <ellipse aria-label="Head forbidden core" cx={clearance.center.x} cy={clearance.center.y} rx={clearance.radiusX} ry={clearance.radiusY} fill={clearanceWarnings.length ? "#FF737D" : "#69D98E"} fillOpacity={.1} stroke={clearanceWarnings.length ? "#FF737D" : "#69D98E"} strokeDasharray="2 2" strokeWidth={1/viewport.zoom}/>}
        {trajectory.length > 0 && <polyline points={trajectory.map(p => `${p!.x},${p!.y}`).join(" ")} fill="none" stroke="#FFE07B" strokeWidth={1/viewport.zoom} />}
        {onion && [-2,-1,1,2].map(offset => <g key={offset}>{draw(Math.max(0, Math.min(clip?.durationMs ?? time, time+offset*1000/(clip?.fps ?? 24))), .18, false)}</g>)}
        {enabled && draw(time, 1, labels)}
        {depthEnabled && scene?.visuals.filter(v=>(v.renderDepth?.segment || v.renderDepth?.boneId === "chest" || v.renderDepth?.boneId === "head") && (!v.itemId || !["weapon_main","weapon_off","shield"].includes(items.find(item=>item.id === v.itemId)?.category ?? ""))).map(v=> {
          const depth=v.renderDepth!,bounds=v.worldBounds,color=DEPTH_COLORS[depth.slot];
          const chest=scene.skeleton.bones.get("chest");
          const row=depth.segment === "upperArm" ? 0 : depth.segment === "forearm" ? 1 : 2;
          const labelX=depth.role && chest ? chest.x+(depth.role === "far" ? -18 : 30) : bounds.minX;
          const labelY=depth.role && chest ? chest.y+row*9 : bounds.minY-2/viewport.zoom;
          return <g key={v.id} stroke={color} strokeWidth={1/viewport.zoom} fill="none">
            <rect x={bounds.minX} y={bounds.minY} width={bounds.maxX-bounds.minX} height={bounds.maxY-bounds.minY} fill={color} fillOpacity={.15}/>
            {depth.role && <line x1={(bounds.minX+bounds.maxX)/2} y1={(bounds.minY+bounds.maxY)/2} x2={labelX} y2={labelY} opacity={.6}/>}
            <text x={labelX} y={labelY} textAnchor={depth.role === "far" ? "end" : "start"} stroke="none" fill={color} fontSize={9/viewport.zoom}>{depth.boneId} · {depth.slot}</text>
          </g>;
        })}
        {enabled && diagnostics.map(d => <g key={d.id} stroke="#FFE07B" fill="none" strokeWidth={1/viewport.zoom}>
          {d.target && <><circle cx={d.target.x} cy={d.target.y} r={2} /><line x1={d.grip.x} y1={d.grip.y} x2={d.target.x} y2={d.target.y} /></>}
          {d.pole && <path d={`M${d.pole.x-2} ${d.pole.y}h4 M${d.pole.x} ${d.pole.y-2}v4`} />}
        </g>)}
      </g></svg>
    </svg>}
  </>;
}
