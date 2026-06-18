// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { handleEditorShortcutKeydown } from "../src/features/shortcuts/useEditorShortcuts";

function makeKeyboardEvent(
  target: EventTarget,
  init: KeyboardEventInit,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  Object.defineProperty(event, "target", { value: target });
  return event;
}

describe("editor shortcuts", () => {
  it("Ctrl+Z invokes undo", () => {
    const undo = vi.fn();
    const event = makeKeyboardEvent(document.body, { key: "z", ctrlKey: true });

    const handled = handleEditorShortcutKeydown(event, {
      undo,
      redo: vi.fn(),
      togglePlayback: vi.fn(),
      removeSelectedAttachment: vi.fn(() => false),
    });

    expect(handled).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("Cmd+Z invokes undo", () => {
    const undo = vi.fn();
    const event = makeKeyboardEvent(document.body, { key: "z", metaKey: true });

    const handled = handleEditorShortcutKeydown(event, {
      undo,
      redo: vi.fn(),
      togglePlayback: vi.fn(),
      removeSelectedAttachment: vi.fn(() => false),
    });

    expect(handled).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("Ctrl+X invokes redo outside input", () => {
    const redo = vi.fn();
    const event = makeKeyboardEvent(document.body, { key: "x", ctrlKey: true });

    const handled = handleEditorShortcutKeydown(event, {
      undo: vi.fn(),
      redo,
      togglePlayback: vi.fn(),
      removeSelectedAttachment: vi.fn(() => false),
    });

    expect(handled).toBe(true);
    expect(redo).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("Ctrl+Shift+Z invokes redo", () => {
    const redo = vi.fn();
    const event = makeKeyboardEvent(document.body, { key: "z", ctrlKey: true, shiftKey: true });

    const handled = handleEditorShortcutKeydown(event, {
      undo: vi.fn(),
      redo,
      togglePlayback: vi.fn(),
      removeSelectedAttachment: vi.fn(() => false),
    });

    expect(handled).toBe(true);
    expect(redo).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+Y invokes redo", () => {
    const redo = vi.fn();
    const event = makeKeyboardEvent(document.body, { key: "y", ctrlKey: true });

    const handled = handleEditorShortcutKeydown(event, {
      undo: vi.fn(),
      redo,
      togglePlayback: vi.fn(),
      removeSelectedAttachment: vi.fn(() => false),
    });

    expect(handled).toBe(true);
    expect(redo).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+X inside input does not invoke redo", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const redo = vi.fn();
    const event = makeKeyboardEvent(input, { key: "x", ctrlKey: true });

    const handled = handleEditorShortcutKeydown(event, {
      undo: vi.fn(),
      redo,
      togglePlayback: vi.fn(),
      removeSelectedAttachment: vi.fn(() => false),
    });

    expect(handled).toBe(false);
    expect(redo).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("Cmd+X inside input does not invoke redo", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const redo = vi.fn();
    const event = makeKeyboardEvent(input, { key: "x", metaKey: true });

    const handled = handleEditorShortcutKeydown(event, {
      undo: vi.fn(),
      redo,
      togglePlayback: vi.fn(),
      removeSelectedAttachment: vi.fn(() => false),
    });

    expect(handled).toBe(false);
    expect(redo).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("Cmd+Shift+Z invokes redo", () => {
    const redo = vi.fn();
    const event = makeKeyboardEvent(document.body, { key: "z", metaKey: true, shiftKey: true });

    const handled = handleEditorShortcutKeydown(event, {
      undo: vi.fn(),
      redo,
      togglePlayback: vi.fn(),
      removeSelectedAttachment: vi.fn(() => false),
    });

    expect(handled).toBe(true);
    expect(redo).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores repeated keydown events", () => {
    const undo = vi.fn();
    const event = makeKeyboardEvent(document.body, { key: "z", ctrlKey: true, repeat: true });

    const handled = handleEditorShortcutKeydown(event, {
      undo,
      redo: vi.fn(),
      togglePlayback: vi.fn(),
      removeSelectedAttachment: vi.fn(() => false),
    });

    expect(handled).toBe(false);
    expect(undo).not.toHaveBeenCalled();
  });
});
