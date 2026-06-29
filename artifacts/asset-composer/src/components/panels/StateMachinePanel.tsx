import { useMemo, useState } from "react";
import { useStore } from "@/store";
import { resolveTemplate } from "@/data/templates";
import { getStateMachineForTemplate } from "@/lib/animationCompatibility";
import type { Transition } from "@/domain/types";

// Layout constants
const NODE_W = 120;
const NODE_H = 42;
const COL_GAP = 60;
const ROW_GAP = 50;
const PAD = 24;

type NodeLayout = {
  stateId: string;
  clipId: string;
  label: string;
  x: number;
  y: number;
};

function buildLayout(states: { id: string; clipId: string }[], entryId: string): NodeLayout[] {
  const ordered = [
    ...states.filter(s => s.id === entryId),
    ...states.filter(s => s.id !== entryId),
  ];
  const COLS = 3;
  return ordered.map((s, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const label = s.clipId.split("__").pop() ?? s.clipId;
    return {
      stateId: s.id,
      clipId: s.clipId,
      label,
      x: PAD + col * (NODE_W + COL_GAP),
      y: PAD + row * (NODE_H + ROW_GAP),
    };
  });
}

function curvedPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = x1 + dx * 0.5 + dy * 0.2;
  const cy = y1 + dy * 0.5 - dx * 0.2;
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

const ARROW_ID = "sm-arrow";
const ARROW_SEL_ID = "sm-arrow-sel";

export function StateMachinePanel() {
  const activeEntityId     = useStore(s => s.project.activeEntityId);
  const project            = useStore(s => s.project);
  const entities           = useStore(s => s.project.entities);
  const stateMachines      = useStore(s => s.project.stateMachines);
  const activeSmId         = useStore(s => s.animPlayback.activeStateMachineId);
  const selectedStateId    = useStore(s => s.animPlayback.selectedStateId);
  const setSelectedState   = useStore(s => s.setSelectedState);

  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);

  const activeEntity = entities.find(e => e.id === activeEntityId) ?? null;
  const template     = activeEntity ? resolveTemplate(project, activeEntity.templateId) : null;

  const sm = useMemo(() => {
    if (template) {
      const byFamily = getStateMachineForTemplate(template, stateMachines);
      if (byFamily) return byFamily;
    }
    return stateMachines.find(m => m.id === activeSmId) ?? stateMachines[0] ?? null;
  }, [stateMachines, activeSmId, template]);

  const layout = useMemo(() => {
    if (!sm) return [];
    return buildLayout(sm.states, sm.entryStateId);
  }, [sm]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, NodeLayout>();
    layout.forEach(n => m.set(n.stateId, n));
    return m;
  }, [layout]);

  // Currently selected transition object
  const selectedTransition: Transition | null = useMemo(() => {
    if (!sm || !selectedTransitionId) return null;
    return sm.transitions.find(t => t.id === selectedTransitionId) ?? null;
  }, [sm, selectedTransitionId]);

  function handleTransitionClick(t: Transition) {
    setSelectedTransitionId(prev => prev === t.id ? null : t.id);
    setSelectedState(null); // deselect state when selecting transition
  }

  function handleStateClick(stateId: string) {
    setSelectedState(stateId);
    setSelectedTransitionId(null); // deselect transition when selecting state
  }

  if (!sm) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        No state machine available. Create an entity first.
      </div>
    );
  }

  const COLS = 3;
  const rows = Math.ceil(sm.states.length / COLS);
  const svgW = PAD * 2 + COLS * NODE_W + (COLS - 1) * COL_GAP;
  const svgH = PAD * 2 + rows * NODE_H + (rows - 1) * ROW_GAP + 20;

  return (
    <div className="flex flex-col h-full bg-sidebar overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border flex-shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {sm.name}
        </span>
        <span className="text-[10px] text-muted-foreground/50 ml-2">
          {sm.states.length} states · {sm.transitions.length} transitions
        </span>
        <span className="ml-auto text-[9px] text-muted-foreground/40 italic">read-only</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1 border-b border-border flex-shrink-0 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary/20 border border-primary/60" />
          entry
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/60" />
          active
        </span>
        <span className="flex items-center gap-1 opacity-60 ml-auto">
          click state or edge to inspect
        </span>
      </div>

      {/* SVG graph */}
      <div className="flex-1 overflow-auto ide-scroll p-2">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="block"
        >
          <defs>
            <marker
              id={ARROW_ID}
              viewBox="0 0 10 10"
              refX="9" refY="5"
              markerWidth="5" markerHeight="5"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border" />
            </marker>
            <marker
              id={ARROW_SEL_ID}
              viewBox="0 0 10 10"
              refX="9" refY="5"
              markerWidth="5" markerHeight="5"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
            </marker>
          </defs>

          {/* ── Transition edges ── */}
          {sm.transitions.map(t => {
            const from = nodeMap.get(t.fromStateId);
            const to   = nodeMap.get(t.toStateId);
            const src  = from ?? nodeMap.get(sm.entryStateId);
            if (!src || !to || src === to) return null;

            const x1 = src.x + NODE_W / 2;
            const y1 = src.y + NODE_H;
            const x2 = to.x + NODE_W / 2;
            const y2 = to.y;
            const midX = (x1 * 0.25 + x2 * 0.75);
            const midY = (y1 * 0.25 + y2 * 0.75) - 4;
            const d    = curvedPath(x1, y1, x2, y2);
            const isSel = selectedTransitionId === t.id;

            return (
              <g
                key={t.id}
                className="group cursor-pointer"
                onClick={() => handleTransitionClick(t)}
              >
                {/* Wide invisible hit area for easier clicking */}
                <path
                  d={d}
                  fill="none"
                  strokeWidth={14}
                  stroke="transparent"
                  className="pointer-events-auto"
                />
                {/* Visible edge */}
                <path
                  d={d}
                  fill="none"
                  strokeWidth={isSel ? 2.5 : 1.5}
                  markerEnd={`url(#${isSel ? ARROW_SEL_ID : ARROW_ID})`}
                  className={`transition-colors pointer-events-none ${
                    isSel
                      ? "stroke-primary"
                      : "stroke-border group-hover:stroke-primary/60"
                  }`}
                />
                {/* Condition label — always visible when selected, hover-only otherwise */}
                <text
                  x={midX}
                  y={midY}
                  textAnchor="middle"
                  fontSize={7.5}
                  className={`pointer-events-none transition-opacity ${
                    isSel ? "fill-primary" : "fill-muted-foreground opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {t.condition}
                </text>
              </g>
            );
          })}

          {/* ── State nodes ── */}
          {layout.map(node => {
            const isEntry  = node.stateId === sm.entryStateId;
            const isActive = node.stateId === selectedStateId;

            return (
              <g
                key={node.stateId}
                data-testid={`sm-state-${node.stateId}`}
                className="cursor-pointer"
                onClick={() => handleStateClick(node.stateId)}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  className={`transition-all ${
                    isActive
                      ? "fill-amber-500/20 stroke-amber-500/80 stroke-2"
                      : isEntry
                        ? "fill-primary/15 stroke-primary/60 stroke-1"
                        : "fill-background stroke-border stroke-1 hover:fill-accent hover:stroke-primary/40"
                  }`}
                />
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + 14}
                  textAnchor="middle"
                  fontSize={9}
                  className={`font-semibold pointer-events-none ${
                    isActive ? "fill-amber-400" : isEntry ? "fill-primary" : "fill-foreground"
                  }`}
                >
                  {node.stateId}
                </text>
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + 27}
                  textAnchor="middle"
                  fontSize={7.5}
                  className="fill-muted-foreground pointer-events-none"
                >
                  {node.label.length > 18 ? node.label.slice(0, 17) + "…" : node.label}
                </text>
                {isEntry && (
                  <polygon
                    points={`${node.x - 10},${node.y + 10} ${node.x - 2},${node.y + 21} ${node.x - 10},${node.y + 32}`}
                    className="fill-primary/50 pointer-events-none"
                  />
                )}
                {isActive && (
                  <circle
                    cx={node.x + NODE_W - 8}
                    cy={node.y + 8}
                    r={4}
                    className="fill-amber-500/80 pointer-events-none"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Inspector footer ── */}
      {(selectedStateId || selectedTransition) && (
        <div className="border-t border-border flex-shrink-0 px-3 py-1.5 bg-background/60">
          {selectedTransition ? (
            // Transition inspector
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Transition</span>
              <span className="text-[10px] font-semibold text-primary">
                {selectedTransition.fromStateId === "*"
                  ? "any"
                  : selectedTransition.fromStateId}
                {" → "}
                {selectedTransition.toStateId}
              </span>
              <span className="text-[9px] bg-primary/10 text-primary rounded px-1 font-mono">
                {selectedTransition.condition}
              </span>
              {selectedTransition.durationMs > 0 && (
                <span className="text-[9px] text-muted-foreground">
                  blend {selectedTransition.durationMs}ms
                </span>
              )}
              <button
                className="ml-auto text-[9px] text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedTransitionId(null)}
              >✕</button>
            </div>
          ) : selectedStateId ? (
            // State inspector
            (() => {
              const st = sm.states.find(s => s.id === selectedStateId);
              if (!st) return null;
              const outgoing = sm.transitions.filter(
                t => t.fromStateId === selectedStateId || t.fromStateId === "*"
              );
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider">State</span>
                  <span className="text-[10px] font-semibold text-amber-400">{selectedStateId}</span>
                  <span className="text-[9px] text-muted-foreground">
                    speed×{st.speed} · {st.loop ? "loops" : "once"}
                  </span>
                  {outgoing.length > 0 && (
                    <span className="text-[9px] text-muted-foreground/60 ml-1">
                      → {outgoing.map(t => t.toStateId).join(", ")}
                    </span>
                  )}
                  <button
                    className="ml-auto text-[9px] text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedState(null)}
                  >✕</button>
                </div>
              );
            })()
          ) : null}
        </div>
      )}
    </div>
  );
}
