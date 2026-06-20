import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement, type FC, createRef } from "react";
import { renderToString } from "react-dom/server";

if (typeof HTMLElement === "undefined") {
  class MockHTMLElement {
    tagName = "DIV";
    isContentEditable = false;
    closest() {
      return null;
    }
  }
  (globalThis as any).HTMLElement = MockHTMLElement as unknown as typeof HTMLElement;
}
import {
  useVimScrollNavigation,
  type VimScrollNavigationOptions,
} from "./useVimScrollNavigation";

function makeEvent(
  key: string,
  mods: { ctrl?: boolean; alt?: boolean; meta?: boolean } = {},
): KeyboardEvent {
  return {
    key,
    ctrlKey: mods.ctrl ?? false,
    altKey: mods.alt ?? false,
    metaKey: mods.meta ?? false,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

function renderHook(
  options: VimScrollNavigationOptions,
): ReturnType<typeof useVimScrollNavigation> {
  const result: { current: ReturnType<typeof useVimScrollNavigation> | null } = {
    current: null,
  };
  const TestComponent: FC = () => {
    result.current = useVimScrollNavigation(options);
    return null;
  };
  renderToString(createElement(TestComponent));
  return result.current!;
}

function makeScrollContainer(scrollHeight = 1000, clientHeight = 200) {
  let _scrollTop = 0;
  const el = {
    scrollHeight,
    clientHeight,
    get scrollTop() {
      return _scrollTop;
    },
    set scrollTop(v: number) {
      _scrollTop = Math.max(0, Math.min(v, scrollHeight - clientHeight));
    },
  } as HTMLElement;
  return el;
}

const el = makeScrollContainer(1000, 200);

describe("useVimScrollNavigation", () => {
  beforeEach(() => {
    el.scrollTop = 0;
  });

  function createOptions(
    overrides: Partial<VimScrollNavigationOptions> = {},
  ): VimScrollNavigationOptions {
    const ref = createRef<HTMLElement>();
    (ref as any).current = el;
    return {
      enabled: true,
      scrollRef: ref,
      step: 60,
      ...overrides,
    };
  }

  describe("j scrolls down", () => {
    it("scrolls down by step", () => {
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("j"));
      expect(el.scrollTop).toBe(60);
    });

    it("clamps at bottom", () => {
      el.scrollTop = 790;
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("j"));
      expect(el.scrollTop).toBe(800);
    });
  });

  describe("k scrolls up", () => {
    it("scrolls up by step", () => {
      el.scrollTop = 200;
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("k"));
      expect(el.scrollTop).toBe(140);
    });

    it("clamps at top", () => {
      el.scrollTop = 30;
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("k"));
      expect(el.scrollTop).toBe(0);
    });
  });

  describe("gg scrolls to top", () => {
    it("scrolls to top on gg", () => {
      el.scrollTop = 500;
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("g"));
      hook.onKeyDown(makeEvent("g"));
      expect(el.scrollTop).toBe(0);
    });
  });

  describe("G scrolls to bottom", () => {
    it("scrolls to bottom on G", () => {
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("G"));
      expect(el.scrollTop).toBe(800);
    });
  });

  describe("g then Ctrl+k then g does not complete gg", () => {
    it("clears pending g on modified key", () => {
      el.scrollTop = 200;
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("g"));
      hook.onKeyDown(makeEvent("k", { ctrl: true }));
      hook.onKeyDown(makeEvent("g"));
      // second g should arm pending-g again, not jump
      expect(el.scrollTop).toBe(200);
    });
  });

  describe("editable target is ignored", () => {
    it("does not scroll when target is editable", () => {
      el.scrollTop = 0;
      const hook = renderHook(createOptions());
      const input = new (globalThis as any).HTMLElement();
      input.tagName = "INPUT";
      const ev = { ...makeEvent("j"), target: input } as unknown as KeyboardEvent;
      hook.onKeyDown(ev);
      expect(el.scrollTop).toBe(0);
    });
  });

  describe("disabled mode does nothing", () => {
    it("j does not scroll when enabled is false", () => {
      const hook = renderHook(createOptions({ enabled: false }));
      hook.onKeyDown(makeEvent("j"));
      expect(el.scrollTop).toBe(0);
    });

    it("G does not scroll when enabled is false", () => {
      const hook = renderHook(createOptions({ enabled: false }));
      hook.onKeyDown(makeEvent("G"));
      expect(el.scrollTop).toBe(0);
    });

    it("gg does not scroll when enabled is false", () => {
      const hook = renderHook(createOptions({ enabled: false }));
      hook.onKeyDown(makeEvent("g"));
      hook.onKeyDown(makeEvent("g"));
      expect(el.scrollTop).toBe(0);
    });
  });
});
