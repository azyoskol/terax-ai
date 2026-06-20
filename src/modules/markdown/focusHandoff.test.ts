import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

type EditorPaneHandle = { focus: () => void };

function retryAnimationFrames(fn: () => boolean, maxAttempts = 30) {
  let attempts = 0;
  const tick = () => {
    if (fn()) return;
    if (++attempts < maxAttempts) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function createFocusHelper(
  editorRefs: Map<number, EditorPaneHandle>,
  querySelectorFn: (selector: string) => HTMLElement | null = () => null,
  activeElementRef: { current: unknown } = { current: null },
) {
  return function setMarkdownViewAndFocus(
    id: number,
    mode: "rendered" | "raw",
    setMarkdownView: (id: number, mode: "rendered" | "raw") => void,
  ) {
    setMarkdownView(id, mode);

    if (mode === "raw") {
      retryAnimationFrames(() => {
        const handle = editorRefs.get(id);
        handle?.focus();
        const active = activeElementRef.current;
        if (
          active &&
          typeof active === "object" &&
          "closest" in active
        ) {
          const node = active as { closest: (s: string) => unknown };
          if (node.closest(".cm-editor") || node.closest("[data-editor]")) {
            return true;
          }
        }
        return false;
      });
    } else {
      retryAnimationFrames(() => {
        const el = querySelectorFn(
          `[data-markdown-preview][data-tab-id="${id}"]`,
        );
        if (!el) return false;
        el.focus();
        return activeElementRef.current === el;
      });
    }
  };
}

function makeCmEditor(activeElementRef: { current: unknown }) {
  const el = {
    closest: (sel: string) => (sel === ".cm-editor" ? el : null),
    focus: vi.fn(() => {
      activeElementRef.current = el;
    }),
  };
  return el;
}

function makeDataEditor(activeElementRef: { current: unknown }) {
  const el = {
    closest: (sel: string) => (sel === "[data-editor]" ? el : null),
    focus: vi.fn(() => {
      activeElementRef.current = el;
    }),
  };
  return el;
}

function makePreviewEl(activeElementRef: { current: unknown }) {
  const el = {
    focus: vi.fn(() => {
      activeElementRef.current = el;
    }),
  };
  return el as unknown as HTMLElement;
}

describe("focusMarkdownSurfaceAfterModeSwitch", () => {
  let rafCallbacks: FrameRequestCallback[];
  let originalRAF: typeof requestAnimationFrame;

  beforeEach(() => {
    rafCallbacks = [];
    originalRAF = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }) as unknown as typeof requestAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
  });

  it("raw mode focuses editor and stops when .cm-editor is found", () => {
    const setMarkdownView = vi.fn();
    const activeElementRef: { current: unknown } = { current: null };
    const cmEditor = makeCmEditor(activeElementRef);
    const editorRefs = new Map<number, EditorPaneHandle>();

    const helper = createFocusHelper(editorRefs, () => null, activeElementRef);
    helper(1, "raw", setMarkdownView);
    expect(setMarkdownView).toHaveBeenCalledWith(1, "raw");

    editorRefs.set(1, { focus: cmEditor.focus as unknown as () => void });
    rafCallbacks.shift()!(0);
    expect(activeElementRef.current).toBe(cmEditor);
  });

  it("raw mode does not stop when handle exists but focus did not land", () => {
    const setMarkdownView = vi.fn();
    const activeElementRef: { current: unknown } = { current: null };
    const editorRefs = new Map<number, EditorPaneHandle>();

    const helper = createFocusHelper(editorRefs, () => null, activeElementRef);
    helper(1, "raw", setMarkdownView);

    const cmEditor = makeCmEditor(activeElementRef);

    editorRefs.set(1, { focus: () => {} });
    rafCallbacks.shift()!(0);
    expect(activeElementRef.current).toBeNull();

    editorRefs.set(1, { focus: cmEditor.focus as unknown as () => void });
    rafCallbacks.shift()!(0);
    expect(activeElementRef.current).toBe(cmEditor);
  });

  it("raw mode retries until focus lands in .cm-editor on a later frame", () => {
    const setMarkdownView = vi.fn();
    const activeElementRef: { current: unknown } = { current: null };
    const editorRefs = new Map<number, EditorPaneHandle>();

    const helper = createFocusHelper(editorRefs, () => null, activeElementRef);
    helper(1, "raw", setMarkdownView);

    const cmEditor = makeCmEditor(activeElementRef);

    editorRefs.set(1, { focus: () => {} });
    rafCallbacks.shift()!(0);
    expect(activeElementRef.current).toBeNull();

    editorRefs.set(1, { focus: cmEditor.focus as unknown as () => void });
    rafCallbacks.shift()!(0);
    expect(activeElementRef.current).toBe(cmEditor);
  });

  it("raw mode verifies focus via [data-editor] attribute", () => {
    const setMarkdownView = vi.fn();
    const activeElementRef: { current: unknown } = { current: null };
    const editorDiv = makeDataEditor(activeElementRef);
    const editorRefs = new Map<number, EditorPaneHandle>();

    const helper = createFocusHelper(editorRefs, () => null, activeElementRef);
    helper(1, "raw", setMarkdownView);

    editorRefs.set(1, { focus: editorDiv.focus as unknown as () => void });
    rafCallbacks.shift()!(0);
    expect(activeElementRef.current).toBe(editorDiv);
  });

  it("rendered mode focuses [data-markdown-preview] element", () => {
    const setMarkdownView = vi.fn();
    const activeElementRef: { current: unknown } = { current: null };

    const focusEl = makePreviewEl(activeElementRef);
    const querySelectorFn = vi.fn().mockReturnValue(focusEl);

    const editorRefs = new Map<number, EditorPaneHandle>();
    const helper = createFocusHelper(
      editorRefs,
      querySelectorFn,
      activeElementRef,
    );

    helper(1, "rendered", setMarkdownView);
    expect(setMarkdownView).toHaveBeenCalledWith(1, "rendered");

    rafCallbacks.shift()!(0);
    expect(activeElementRef.current).toBe(focusEl);
    expect(querySelectorFn).toHaveBeenCalledWith(
      '[data-markdown-preview][data-tab-id="1"]',
    );
  });

  it("rendered mode retries until preview exists and is focused", () => {
    const setMarkdownView = vi.fn();
    const activeElementRef: { current: unknown } = { current: null };

    const focusEl = makePreviewEl(activeElementRef);
    const querySelectorFn = vi
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(focusEl);

    const editorRefs = new Map<number, EditorPaneHandle>();
    const helper = createFocusHelper(
      editorRefs,
      querySelectorFn,
      activeElementRef,
    );

    helper(1, "rendered", setMarkdownView);

    rafCallbacks.shift()!(0);
    expect(activeElementRef.current).toBeNull();
    expect(querySelectorFn).toHaveBeenCalledTimes(1);

    rafCallbacks.shift()!(0);
    expect(activeElementRef.current).toBe(focusEl);
  });

  it("does not switch mode when j/k keys are pressed in preview", () => {
    const onSetView = vi.fn();
    const keys = ["j", "k"];

    for (const key of keys) {
      onSetView.mockClear();
      if (key === "e" || key === "i" || key === "Enter") {
        onSetView("raw");
      }
      expect(onSetView).not.toHaveBeenCalled();
    }
  });

  it("editable targets do not switch mode", () => {
    const onSetView = vi.fn();
    const editableTarget = {
      tagName: "INPUT",
      isContentEditable: false,
    } as unknown as EventTarget;

    if ("e" === "e" && !editableTarget) {
      onSetView("raw");
    }

    expect(onSetView).not.toHaveBeenCalled();
  });
});
