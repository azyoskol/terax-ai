import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement, type FC } from "react";
import { renderToString } from "react-dom/server";
import {
  useVimListNavigation,
  type VimListNavigationOptions,
} from "./useVimListNavigation";

function renderHook(
  options: VimListNavigationOptions,
): ReturnType<typeof useVimListNavigation> {
  const result: { current: ReturnType<typeof useVimListNavigation> | null } = {
    current: null,
  };
  const TestComponent: FC = () => {
    result.current = useVimListNavigation(options);
    return null;
  };
  renderToString(createElement(TestComponent));
  return result.current!;
}

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

describe("useVimListNavigation", () => {
  let index: number;
  let setSelectedIndex: ReturnType<typeof vi.fn>;
  let onActivate: ReturnType<typeof vi.fn>;
  let onEscape: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    index = 0;
    setSelectedIndex = vi.fn(
      (fn: ((prev: number) => number) | number) => {
        index = typeof fn === "function" ? fn(index) : fn;
      },
    );
    onActivate = vi.fn();
    onEscape = vi.fn();
  });

  function createOptions(
    overrides: Partial<VimListNavigationOptions> = {},
  ): VimListNavigationOptions {
    return {
      enabled: true,
      itemCount: 5,
      selectedIndex: index,
      setSelectedIndex: setSelectedIndex as unknown as React.Dispatch<React.SetStateAction<number>>,
      onActivate: onActivate as unknown as (index: number) => void,
      onEscape: onEscape as unknown as () => void,
      ...overrides,
    };
  }

  describe("j moves next and clamps", () => {
    it("moves from 0 to 1", () => {
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("j"));
      expect(setSelectedIndex).toHaveBeenCalledTimes(1);
      expect(index).toBe(1);
    });

    it("clamps at last item", () => {
      index = 4;
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("j"));
      expect(index).toBe(4);
    });
  });

  describe("k moves prev and clamps", () => {
    it("moves from 3 to 2", () => {
      index = 3;
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("k"));
      expect(index).toBe(2);
    });

    it("clamps at first item", () => {
      index = 0;
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("k"));
      expect(index).toBe(0);
    });
  });

  describe("gg moves first", () => {
    it("goes to index 0 from middle", () => {
      index = 3;
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("g"));
      hook.onKeyDown(makeEvent("g"));
      expect(index).toBe(0);
    });
  });

  describe("G moves last", () => {
    it("goes to last item", () => {
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("G"));
      expect(index).toBe(4);
    });

    it("stays at last when already last", () => {
      index = 4;
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("G"));
      expect(index).toBe(4);
    });
  });

  describe("Enter activates selected item", () => {
    it("calls onActivate with current index", () => {
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("Enter"));
      expect(onActivate).toHaveBeenCalledWith(0);
    });

    it("calls onActivate after navigation (re-renders to update ref)", () => {
      // renderHook only renders once, so after calling onKeyDown("j")
      // the hook's selectedIndexRef is stale. We re-render with updated index.
      const options = createOptions();
      let hook = renderHook(options);
      hook.onKeyDown(makeEvent("j"));
      // re-render with updated state
      options.selectedIndex = 1;
      hook = renderHook(options);
      hook.onKeyDown(makeEvent("Enter"));
      expect(onActivate).toHaveBeenCalledWith(1);
    });
  });

  describe("Escape calls onEscape", () => {
    it("calls onEscape", () => {
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("Escape"));
      expect(onEscape).toHaveBeenCalled();
    });
  });

  describe("editable target is ignored", () => {
    it("skips handling when isEventTargetIgnored returns true", () => {
      const hook = renderHook(
        createOptions({
          isEventTargetIgnored: () => true,
        }),
      );
      hook.onKeyDown(makeEvent("j"));
      expect(setSelectedIndex).not.toHaveBeenCalled();
    });

    it("handles when isEventTargetIgnored returns false", () => {
      const hook = renderHook(
        createOptions({
          isEventTargetIgnored: () => false,
        }),
      );
      hook.onKeyDown(makeEvent("j"));
      expect(setSelectedIndex).toHaveBeenCalled();
    });
  });

  describe("g then Ctrl+k clears pending g", () => {
    it("returns none and does not navigate", () => {
      vi.useFakeTimers();
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("g"));
      hook.onKeyDown(makeEvent("k", { ctrl: true }));
      // Should not move
      expect(index).toBe(0);
      // Pending g should be cleared (timeout shouldn't fire)
      vi.advanceTimersByTime(900);
      // Still no movement
      expect(index).toBe(0);
      vi.useRealTimers();
    });
  });

  describe("alwaysHandleActivateEscape allows Enter/Escape when enabled=false", () => {
    it("Enter works when enabled is false but alwaysHandleActivateEscape is true", () => {
      const hook = renderHook(
        createOptions({
          enabled: false,
          alwaysHandleActivateEscape: true,
        }),
      );
      hook.onKeyDown(makeEvent("Enter"));
      expect(onActivate).toHaveBeenCalledWith(0);
    });

    it("Escape works when enabled is false but alwaysHandleActivateEscape is true", () => {
      const hook = renderHook(
        createOptions({
          enabled: false,
          alwaysHandleActivateEscape: true,
        }),
      );
      hook.onKeyDown(makeEvent("Escape"));
      expect(onEscape).toHaveBeenCalled();
    });

    it("j does not move when enabled is false", () => {
      const hook = renderHook(
        createOptions({
          enabled: false,
        }),
      );
      hook.onKeyDown(makeEvent("j"));
      expect(index).toBe(0);
    });

    it("gg does not move when enabled is false", () => {
      index = 3;
      const hook = renderHook(
        createOptions({
          enabled: false,
        }),
      );
      hook.onKeyDown(makeEvent("g"));
      hook.onKeyDown(makeEvent("g"));
      expect(index).toBe(3);
    });
  });

  describe("itemCount=0 does not crash", () => {
    it("j does nothing when itemCount is 0", () => {
      const hook = renderHook(createOptions({ itemCount: 0 }));
      hook.onKeyDown(makeEvent("j"));
      expect(index).toBe(0);
    });

    it("k does nothing when itemCount is 0", () => {
      const hook = renderHook(createOptions({ itemCount: 0 }));
      hook.onKeyDown(makeEvent("k"));
      expect(index).toBe(0);
    });
  });

  describe("preventDefault and stopPropagation", () => {
    it("handled event calls preventDefault and stopPropagation", () => {
      const hook = renderHook(createOptions());
      const ev = makeEvent("j");
      hook.onKeyDown(ev);
      expect(ev.preventDefault).toHaveBeenCalled();
      expect(ev.stopPropagation).toHaveBeenCalled();
    });
  });
});
