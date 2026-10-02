import { useEffect } from "react";
import { useStore } from "@/store";

interface EditorShortcutActions {
  undo: () => void;
  redo: () => void;
  togglePlayback: () => void;
  removeSelectedAttachment: () => boolean;
}

export function getHistoryShortcut(event: KeyboardEvent): "undo" | "redo" | null {
  if (event.repeat || event.altKey || isTypingTarget(event.target)) return null;
  const key = event.code === "KeyZ" ? "z" : event.code === "KeyX" ? "x"
    : event.code === "KeyY" ? "y" : event.key.toLowerCase();
  if (event.ctrlKey && !event.metaKey) {
    if (key === "z" && !event.shiftKey) return "undo";
    if (key === "x" || key === "y" || (key === "z" && event.shiftKey)) return "redo";
  }
  if (event.metaKey && !event.ctrlKey && key === "z") return event.shiftKey ? "redo" : "undo";
  return null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tagName = el.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    el.isContentEditable
  );
}

export function handleEditorShortcutKeydown(
  event: KeyboardEvent,
  actions: EditorShortcutActions,
): boolean {
  if (event.repeat) return false;

  const key = event.key.toLowerCase();
  const typingTarget = isTypingTarget(event.target);

  const historyAction = getHistoryShortcut(event);
  if (historyAction) {
    event.preventDefault();
    event.stopPropagation();
    actions[historyAction]();
    return true;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return false;

  if (typingTarget) return false;

  if (event.key === " " || key === "spacebar") {
    event.preventDefault();
    event.stopPropagation();
    actions.togglePlayback();
    return true;
  }

  if (key === "delete" || key === "backspace") {
    const removed = actions.removeSelectedAttachment();
    if (!removed) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  return false;
}

export function useEditorShortcuts(): void {
  const undo = useStore(s => s.undo);
  const redo = useStore(s => s.redo);
  const setEntitySlot = useStore(s => s.setEntitySlot);
  const setPlaybackPlaying = useStore(s => s.setPlaybackPlaying);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleEditorShortcutKeydown(event, {
        undo,
        redo,
        togglePlayback: () => {
          const { playing } = useStore.getState().animPlayback;
          setPlaybackPlaying(!playing);
        },
        removeSelectedAttachment: () => {
          const state = useStore.getState();
          const selection = state.editor.selection;
          if (selection.kind !== "item-part" && selection.kind !== "equipped-item") {
            return false;
          }
          setEntitySlot(selection.entityId, selection.slotId, null);
          return true;
        },
      });
    };

    // Some embedded browsers deliver Ctrl+X as a native cut command, without keydown.
    const onCut = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      redo();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("cut", onCut);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("cut", onCut);
    };
  }, [redo, setEntitySlot, setPlaybackPlaying, undo]);
}
