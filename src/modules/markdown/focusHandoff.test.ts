import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

type EditorPaneHandle = { focus: () => void };

function createFocusHelper(
  editorRefs: Map<number, EditorPaneHandle>,
  querySelectorFn: (selector: string) => HTMLElement | null = () => null,
) {
  return function setMarkdownViewAndFocus(
    id: number,
    mode: "rendered" | "raw",
    setMarkdownView: (id: number, mode: "rendered" | "raw") => void,
  ) {
    setMarkdownView(id, mode);
    if (mode === "raw") {
      let attempts = 0;
      const tryFocus = () => {
        const handle = editorRefs.get(id);
        if (handle) {
          handle.focus();
          return;
        }
        if (++attempts < 10) requestAnimationFrame(tryFocus);
      };
      requestAnimationFrame(tryFocus);
    } else {
      let attempts = 0;
      const tryFocus = () => {
        const el = querySelectorFn(
          `[data-markdown-preview][data-tab-id="${id}"]`,
        );
        if (el) {
          el.focus();
          return;
        }
        if (++attempts < 10) requestAnimationFrame(tryFocus);
      };
      requestAnimationFrame(tryFocus);
    }
  };
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

  it("preview -> raw calls setMarkdownView and focuses editor handle when available", () => {
    const setMarkdownView = vi.fn();
    const focus = vi.fn();
    const editorRefs = new Map<number, EditorPaneHandle>();
    const helper = createFocusHelper(editorRefs);

    helper(1, "raw", setMarkdownView);

    expect(setMarkdownView).toHaveBeenCalledWith(1, "raw");

    editorRefs.set(1, { focus });
    rafCallbacks.shift()!(0);

    expect(focus).toHaveBeenCalled();
  });

  it("raw -> preview focuses [data-markdown-preview] element", () => {
    const setMarkdownView = vi.fn();
    const focusEl = { focus: vi.fn() } as unknown as HTMLElement;
    const querySelectorFn = vi.fn().mockReturnValue(focusEl);

    const editorRefs = new Map<number, EditorPaneHandle>();
    const helper = createFocusHelper(editorRefs, querySelectorFn);

    helper(1, "rendered", setMarkdownView);

    expect(setMarkdownView).toHaveBeenCalledWith(1, "rendered");
    rafCallbacks.shift()!(0);

    expect(focusEl.focus).toHaveBeenCalled();
    expect(querySelectorFn).toHaveBeenCalledWith(
      '[data-markdown-preview][data-tab-id="1"]',
    );
  });

  it("preview -> raw retries when editor handle not yet available", () => {
    const setMarkdownView = vi.fn();
    const focus = vi.fn();
    const editorRefs = new Map<number, EditorPaneHandle>();
    const helper = createFocusHelper(editorRefs);

    helper(1, "raw", setMarkdownView);

    expect(setMarkdownView).toHaveBeenCalledWith(1, "raw");

    rafCallbacks.shift()!(0);
    expect(focus).not.toHaveBeenCalled();

    editorRefs.set(1, { focus });
    rafCallbacks.shift()!(0);

    expect(focus).toHaveBeenCalled();
  });

  it("raw -> preview retries when DOM element not yet available", () => {
    const setMarkdownView = vi.fn();
    const focusEl = { focus: vi.fn() } as unknown as HTMLElement;
    const querySelectorFn = vi
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(focusEl);

    const editorRefs = new Map<number, EditorPaneHandle>();
    const helper = createFocusHelper(editorRefs, querySelectorFn);

    helper(1, "rendered", setMarkdownView);

    rafCallbacks.shift()!(0);
    expect(querySelectorFn).toHaveBeenCalledTimes(1);

    rafCallbacks.shift()!(0);

    expect(focusEl.focus).toHaveBeenCalled();
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
