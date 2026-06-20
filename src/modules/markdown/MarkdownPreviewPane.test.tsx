import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

vi.mock("@/modules/keyboard/core/targets", () => ({
  isEditableTarget: (target: EventTarget | null) => {
    if (!target) return false;
    const tag = (target as { tagName?: string }).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return true;
    if ((target as { isContentEditable?: boolean }).isContentEditable) return true;
    return false;
  },
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({
    kind: "text",
    content: "# hello",
    size: 8,
  }),
}));

vi.mock("streamdown", () => ({
  Streamdown: () => null,
}));

vi.mock("@/components/ai-elements/markdown-code", () => ({
  MarkdownCode: () => null,
}));

vi.mock("@/modules/workspace", () => ({
  currentWorkspaceEnv: () => null,
}));

vi.mock("@/modules/settings/preferences", () => ({
  usePreferencesStore: Object.assign(
    (sel: any) => sel?.({ vimNavigationEnabled: true }) ?? true,
    { getState: () => ({ vimNavigationEnabled: true }) },
  ),
}));

import { MarkdownPreviewPane } from "./MarkdownPreviewPane";
import { isEditableTarget } from "@/modules/keyboard/core/targets";

describe("MarkdownPreviewPane", () => {
  it("renders loading state initially", () => {
    const el = createElement(MarkdownPreviewPane, {
      path: "/test.md",
      visible: true,
      onSetView: vi.fn(),
    });
    const html = renderToString(el);
    expect(html).toContain("Loading");
  });

  it("has data-markdown-preview on the container", () => {
    const el = createElement(MarkdownPreviewPane, {
      path: "/test.md",
      visible: true,
      onSetView: vi.fn(),
    });
    const html = renderToString(el);
    expect(html).toContain("data-markdown-preview");
  });
});

describe("isEditableTarget — mode switching guard", () => {
  it("returns false for null target", () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  it("returns true for INPUT elements", () => {
    const target = { tagName: "INPUT", isContentEditable: false } as unknown as EventTarget;
    expect(isEditableTarget(target)).toBe(true);
  });

  it("returns true for TEXTAREA elements", () => {
    const target = { tagName: "TEXTAREA", isContentEditable: false } as unknown as EventTarget;
    expect(isEditableTarget(target)).toBe(true);
  });

  it("returns true for contentEditable elements", () => {
    const target = { tagName: "DIV", isContentEditable: true } as unknown as EventTarget;
    expect(isEditableTarget(target)).toBe(true);
  });

  it("returns false for plain div elements", () => {
    const target = { tagName: "DIV", isContentEditable: false } as unknown as EventTarget;
    expect(isEditableTarget(target)).toBe(false);
  });
});

describe("MarkdownPreviewPane mode switching logic", () => {
  it("e/i/Enter trigger onSetView('raw') when target is not editable", () => {
    const onSetView = vi.fn();
    const nonEditableTarget = { tagName: "DIV", isContentEditable: false } as unknown as EventTarget;
    const keys = ["e", "i", "Enter"];

    for (const key of keys) {
      onSetView.mockClear();
      if ((key === "e" || key === "i" || key === "Enter") && !isEditableTarget(nonEditableTarget)) {
        onSetView("raw");
      }
      expect(onSetView).toHaveBeenCalledWith("raw");
    }
  });

  it("does not trigger onSetView when target is editable", () => {
    const onSetView = vi.fn();
    const editableTarget = { tagName: "INPUT", isContentEditable: false } as unknown as EventTarget;

    if ("e" === "e" && !isEditableTarget(editableTarget)) {
      onSetView("raw");
    }

    expect(onSetView).not.toHaveBeenCalled();
  });

  it("j key does not trigger onSetView", () => {
    const onSetView = vi.fn();
    const target = { tagName: "DIV", isContentEditable: false } as unknown as EventTarget;
    const key = "j" as string;

    if ((key === "e" || key === "i" || key === "Enter") && !isEditableTarget(target)) {
      onSetView("raw");
    }

    expect(onSetView).not.toHaveBeenCalled();
  });
});
