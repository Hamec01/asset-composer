import { useState, useRef, useCallback } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toolbar } from "@/components/toolbar/Toolbar";
import { LibraryPanel } from "@/components/panels/LibraryPanel";
import { CanvasPanel } from "@/components/panels/CanvasPanel";
import { InspectorPanel } from "@/components/panels/InspectorPanel";
import { TimelinePanel } from "@/components/panels/TimelinePanel";
import { StateMachinePanel } from "@/components/panels/StateMachinePanel";
import { PixiPreviewPanel } from "@/components/panels/PixiPreviewPanel";
import { AuthoringPanel } from "@/components/panels/AuthoringPanel";
import { NewEntityWizard } from "@/components/wizard/NewEntityWizard";
import { ExportDialog } from "@/components/export/ExportDialog";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { useStore } from "@/store";
import type { AnimBottomTab } from "@/store";
import { useEditorShortcuts } from "@/features/shortcuts/useEditorShortcuts";

const MIN_SIDE_WIDTH = 160;
const MAX_SIDE_WIDTH = 480;
const MIN_TIMELINE_H = 80;
const MAX_TIMELINE_H = 400;
const COLLAPSED_SIDE_W = 28;
const COLLAPSED_TIMELINE_H = 28;

const BOTTOM_TABS: { id: AnimBottomTab; label: string }[] = [
  { id: "timeline",     label: "Timeline" },
  { id: "preview",      label: "Preview" },
  { id: "statemachine", label: "State Machine" },
  { id: "authoring",    label: "Authoring" },
];

function useDragHandle() {
  const startRef = useRef({ pos: 0, size: 0 });

  const startHDrag = useCallback(
    (
      e: React.MouseEvent,
      currentSize: number,
      setSize: (n: number) => void,
      invert = false,
    ) => {
      e.preventDefault();
      startRef.current = { pos: e.clientX, size: currentSize };
      const onMove = (ev: MouseEvent) => {
        const delta = invert
          ? startRef.current.pos - ev.clientX
          : ev.clientX - startRef.current.pos;
        const next = Math.max(MIN_SIDE_WIDTH, Math.min(MAX_SIDE_WIDTH, startRef.current.size + delta));
        setSize(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  const startVDrag = useCallback(
    (e: React.MouseEvent, currentSize: number, setSize: (n: number) => void) => {
      e.preventDefault();
      startRef.current = { pos: e.clientY, size: currentSize };
      const onMove = (ev: MouseEvent) => {
        const delta = startRef.current.pos - ev.clientY;
        const next = Math.max(MIN_TIMELINE_H, Math.min(MAX_TIMELINE_H, startRef.current.size + delta));
        setSize(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  return { startHDrag, startVDrag };
}

export function IDE() {
  useEditorShortcuts();

  const [libraryWidth,   setLibraryWidth]   = useState(220);
  const [inspectorWidth, setInspectorWidth] = useState(220);
  const [timelineHeight, setTimelineHeight] = useState(200);

  const [libraryCollapsed,   setLibraryCollapsed]   = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [timelineCollapsed,  setTimelineCollapsed]  = useState(false);

  const activeTab    = useStore(s => s.animPlayback.activeTab);
  const setActiveTab = useStore(s => s.setAnimBottomTab);

  const { startHDrag, startVDrag } = useDragHandle();

  const effectiveLibW    = libraryCollapsed   ? COLLAPSED_SIDE_W   : libraryWidth;
  const effectiveInspW   = inspectorCollapsed ? COLLAPSED_SIDE_W   : inspectorWidth;
  const effectiveTimeH   = timelineCollapsed  ? COLLAPSED_TIMELINE_H : timelineHeight;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        data-testid="ide-shell"
        className="flex flex-col w-screen h-screen overflow-hidden bg-background text-foreground select-none"
      >
        {/* ─── Toolbar ─────────────────────────────────────────── */}
        <Toolbar />

        {/* ─── Main work area ──────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: Library Panel (collapsible) */}
          <div
            data-testid="library-panel-wrapper"
            style={{ width: effectiveLibW, flexShrink: 0 }}
            className="flex flex-col overflow-hidden border-r border-border transition-[width] duration-150"
          >
            {libraryCollapsed ? (
              <div className="flex flex-col items-center py-2 gap-2 h-full bg-sidebar">
                <button
                  aria-label="Expand library panel"
                  onClick={() => setLibraryCollapsed(false)}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span
                  className="text-[10px] text-muted-foreground tracking-widest"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  LIBRARY
                </span>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between px-2 h-7 border-b border-border bg-sidebar flex-shrink-0">
                  <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">Library</span>
                  <button
                    aria-label="Collapse library panel"
                    onClick={() => setLibraryCollapsed(true)}
                    className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <LibraryPanel />
                </div>
              </div>
            )}
          </div>

          {/* Vertical resize handle — library ↔ canvas */}
          {!libraryCollapsed && (
            <div
              className="w-1 bg-border/40 hover:bg-primary/50 active:bg-primary cursor-col-resize transition-colors flex-shrink-0"
              onMouseDown={e => startHDrag(e, libraryWidth, setLibraryWidth)}
            />
          )}

          {/* Center: Canvas + Bottom Panel stacked */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Canvas area */}
            <div className="flex-1 overflow-hidden">
              <CanvasPanel />
            </div>

            {/* Horizontal resize handle */}
            {!timelineCollapsed && (
              <div
                className="h-1 bg-border/40 hover:bg-primary/50 active:bg-primary cursor-row-resize transition-colors flex-shrink-0"
                onMouseDown={e => startVDrag(e, timelineHeight, setTimelineHeight)}
              />
            )}

            {/* Bottom panel: Timeline / Preview / State Machine */}
            <div
              style={{ height: effectiveTimeH, flexShrink: 0 }}
              className="overflow-hidden border-t border-border transition-[height] duration-150"
            >
              {timelineCollapsed ? (
                <div className="flex items-center gap-2 px-3 h-full bg-sidebar">
                  <button
                    aria-label="Expand bottom panel"
                    onClick={() => setTimelineCollapsed(false)}
                    className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase capitalize">
                    {activeTab}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Tab strip + collapse button */}
                  <div className="flex items-center border-b border-border bg-sidebar flex-shrink-0 h-7">
                    <div className="flex items-center">
                      {BOTTOM_TABS.map(tab => (
                        <button
                          key={tab.id}
                          data-testid={`bottom-tab-${tab.id}`}
                          onClick={() => setActiveTab(tab.id)}
                          className={`
                            h-7 px-3 text-[10px] font-semibold uppercase tracking-wider border-r border-border
                            transition-colors
                            ${activeTab === tab.id
                              ? "bg-background text-foreground border-b-2 border-b-primary -mb-px"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            }
                          `}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1" />
                    <button
                      aria-label="Collapse bottom panel"
                      onClick={() => setTimelineCollapsed(true)}
                      className="p-0.5 mr-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Active tab content */}
                  <div className="flex-1 overflow-hidden">
                    {activeTab === "timeline"     && <TimelinePanel />}
                    {activeTab === "preview"      && <PixiPreviewPanel />}
                    {activeTab === "statemachine" && <StateMachinePanel />}
                    {activeTab === "authoring"    && <AuthoringPanel />}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vertical resize handle — canvas ↔ inspector */}
          {!inspectorCollapsed && (
            <div
              className="w-1 bg-border/40 hover:bg-primary/50 active:bg-primary cursor-col-resize transition-colors flex-shrink-0"
              onMouseDown={e => startHDrag(e, inspectorWidth, setInspectorWidth, true)}
            />
          )}

          {/* Right: Inspector (collapsible) */}
          <div
            data-testid="inspector-panel-wrapper"
            style={{ width: effectiveInspW, flexShrink: 0 }}
            className="flex flex-col overflow-hidden border-l border-border transition-[width] duration-150"
          >
            {inspectorCollapsed ? (
              <div className="flex flex-col items-center py-2 gap-2 h-full bg-sidebar">
                <button
                  aria-label="Expand inspector panel"
                  onClick={() => setInspectorCollapsed(false)}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span
                  className="text-[10px] text-muted-foreground tracking-widest"
                  style={{ writingMode: "vertical-rl" }}
                >
                  INSPECTOR
                </span>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between px-2 h-7 border-b border-border bg-sidebar flex-shrink-0">
                  <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">Inspector</span>
                  <button
                    aria-label="Collapse inspector panel"
                    onClick={() => setInspectorCollapsed(true)}
                    className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <InspectorPanel />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Overlays ─────────────────────────────────────────── */}
        <NewEntityWizard />
        <ExportDialog />
      </div>
    </TooltipProvider>
  );
}
