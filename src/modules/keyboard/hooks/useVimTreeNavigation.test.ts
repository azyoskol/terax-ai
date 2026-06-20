import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement, type FC } from "react";
import { renderToString } from "react-dom/server";
import {
  useVimTreeNavigation,
  type VimTreeNavigationOptions,
} from "./useVimTreeNavigation";

function renderHook(
  options: VimTreeNavigationOptions,
): ReturnType<typeof useVimTreeNavigation> {
  const result: { current: ReturnType<typeof useVimTreeNavigation> | null } = {
    current: null,
  };
  const TestComponent: FC = () => {
    result.current = useVimTreeNavigation(options);
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

describe("useVimTreeNavigation", () => {
  let selectedId: string | null;
  let setSelectedId: ((id: string) => void) & ReturnType<typeof vi.fn>;
  let expand: ((id: string) => void) & ReturnType<typeof vi.fn>;
  let collapse: ((id: string) => void) & ReturnType<typeof vi.fn>;
  let onActivate: ((id: string) => void) & ReturnType<typeof vi.fn>;

  const itemIds = ["/root/a", "/root/b", "/root/b/c", "/root/d"];

  beforeEach(() => {
    selectedId = "/root/a";
    setSelectedId = vi.fn((id: string) => { selectedId = id; }) as typeof setSelectedId;
    expand = vi.fn() as typeof expand;
    collapse = vi.fn() as typeof collapse;
    onActivate = vi.fn() as typeof onActivate;
  });

  function createOptions(
    overrides: Partial<VimTreeNavigationOptions> = {},
  ): VimTreeNavigationOptions {
    return {
      enabled: true,
      itemIds,
      selectedId,
      setSelectedId,
      isDirectory: (id) => ["/root/b", "/root/d"].includes(id),
      isExpanded: (id) => id === "/root/b",
      expand,
      collapse,
      parentOf: (id) => {
        const i = id.lastIndexOf("/");
        return i > 0 ? id.slice(0, i) : "";
      },
      rootPath: "/root",
      onActivate,
      ...overrides,
    };
  }

  describe("j/k navigation", () => {
    it("moves to next item", () => {
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("j"));
      expect(selectedId).toBe("/root/b");
    });

    it("moves to previous item", () => {
      selectedId = "/root/b";
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("k"));
      expect(selectedId).toBe("/root/a");
    });

    it("clamps at first item", () => {
      selectedId = "/root/a";
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("k"));
      expect(selectedId).toBe("/root/a");
    });

    it("clamps at last item", () => {
      selectedId = "/root/d";
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("j"));
      expect(selectedId).toBe("/root/d");
    });
  });

  describe("gg/G navigation", () => {
    it("gg moves to first item", () => {
      selectedId = "/root/d";
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("g"));
      hook.onKeyDown(makeEvent("g"));
      expect(selectedId).toBe("/root/a");
    });

    it("G moves to last item", () => {
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("G"));
      expect(selectedId).toBe("/root/d");
    });
  });

  describe("h/ArrowLeft", () => {
    it("collapses expanded directory", () => {
      selectedId = "/root/b";
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("h"));
      expect(collapse).toHaveBeenCalledWith("/root/b");
    });

    it("moves to parent when not expanded", () => {
      selectedId = "/root/d";
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("h"));
      expect(selectedId).toBe("/root");
    });
  });

  describe("l/ArrowRight", () => {
    it("expands collapsed directory", () => {
      selectedId = "/root/d";
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("l"));
      expect(expand).toHaveBeenCalledWith("/root/d");
    });

    it("moves to first child when already expanded", () => {
      selectedId = "/root/b";
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("l"));
      expect(selectedId).toBe("/root/b/c");
    });
  });

  describe("Enter activates", () => {
    it("calls onActivate with selected id", () => {
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("Enter"));
      expect(onActivate).toHaveBeenCalledWith("/root/a");
    });
  });

  describe("disabled navigation", () => {
    it("does not move when enabled is false", () => {
      selectedId = "/root/a";
      const hook = renderHook(createOptions({ enabled: false }));
      hook.onKeyDown(makeEvent("j"));
      expect(selectedId).toBe("/root/a");
    });

    it("arrow keys still work when enabled is false", () => {
      selectedId = "/root/a";
      const hook = renderHook(createOptions({ enabled: false }));
      hook.onKeyDown(makeEvent("ArrowDown"));
      expect(selectedId).toBe("/root/b");
    });
  });

  describe("empty list", () => {
    it("does not crash when itemIds is empty", () => {
      const hook = renderHook(
        createOptions({ itemIds: [], selectedId: null }),
      );
      expect(() => hook.onKeyDown(makeEvent("j"))).not.toThrow();
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

  describe("g then Ctrl+k then g does not complete gg", () => {
    it("clears pending g on modified key", () => {
      selectedId = "/root/d";
      const hook = renderHook(createOptions());
      hook.onKeyDown(makeEvent("g"));
      hook.onKeyDown(makeEvent("k", { ctrl: true }));
      hook.onKeyDown(makeEvent("g"));
      expect(selectedId).toBe("/root/d");
    });
  });
});
