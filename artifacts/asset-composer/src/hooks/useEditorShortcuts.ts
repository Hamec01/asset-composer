import { useEffect } from "react";
import { useStore } from "@/store";

interface EditorShortcutActions {
  undo: () => void;
  redo: () => void;
  togglePlayback: () => void;
  removeSelectedAttachment: () => boolean;
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

  if (event.ctrlKey && !event.metaKey && !event.altKey) {
    if (!typingTarget && key === "z" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      actions.undo();
      return true;
    }
    if (!typingTarget && (key === "x" || key === "y" || (key === "z" && event.shiftKey))) {
      event.preventDefault();
      event.stopPropagation();
      actions.redo();
      return true;
    }
    return false;
  }

  if (event.metaKey && !event.ctrlKey && !event.altKey) {
    if (key === "z" && !event.shiftKey && !typingTarget) {
      event.preventDefault();
      event.stopPropagation();
      actions.undo();
      return true;
    }
    if (key === "z" && event.shiftKey && !typingTarget) {
      event.preventDefault();
      event.stopPropagation();
      actions.redo();
      return true;
    }
    return false;
  }

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

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, setEntitySlot, setPlaybackPlaying, undo]);
}
