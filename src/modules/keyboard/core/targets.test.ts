import { describe, expect, it } from "vitest";
import {
  isEditableTarget,
  isTerminalTarget,
  isInExplorer,
  isInExplorerSearch,
  isInExplorerSearchResults,
  isInSourceControl,
} from "./targets";

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

function makeEl(
  overrides: Partial<HTMLElement> = {},
): HTMLElement {
  const el = new (globalThis as any).HTMLElement();
  Object.assign(el, overrides);
  return el as unknown as HTMLElement;
}

describe("target guards", () => {
  describe("isEditableTarget", () => {
    it("returns false for null target", () => {
      expect(isEditableTarget(null)).toBe(false);
    });

    it("returns false for non-HTMLElement target", () => {
      expect(isEditableTarget({} as EventTarget)).toBe(false);
    });

    it("returns true for INPUT", () => {
      expect(isEditableTarget(makeEl({ tagName: "INPUT" }))).toBe(true);
    });

    it("returns true for TEXTAREA", () => {
      expect(isEditableTarget(makeEl({ tagName: "TEXTAREA" }))).toBe(true);
    });

    it("returns true for contentEditable", () => {
      expect(
        isEditableTarget(makeEl({ isContentEditable: true })),
      ).toBe(true);
    });

    it("returns false for regular DIV", () => {
      expect(isEditableTarget(makeEl({ tagName: "DIV" }))).toBe(false);
    });
  });

  describe("isTerminalTarget", () => {
    it("returns false for null target", () => {
      expect(isTerminalTarget(null)).toBe(false);
    });

    it("returns false for non-HTMLElement target", () => {
      expect(isTerminalTarget({} as EventTarget)).toBe(false);
    });

    it("returns true for element inside .xterm", () => {
      const terminal = makeEl({ className: "xterm" });
      const child = makeEl({ closest: () => terminal });
      expect(isTerminalTarget(child)).toBe(true);
    });

    it("returns false for element not in .xterm", () => {
      const child = makeEl({ closest: () => null });
      expect(isTerminalTarget(child)).toBe(false);
    });
  });

  describe("isInExplorer", () => {
    it("returns true for element inside [data-file-explorer]", () => {
      const explorer = makeEl();
      const child = makeEl({ closest: () => explorer });
      expect(isInExplorer(child)).toBe(true);
    });

    it("returns false for element outside explorer", () => {
      expect(isInExplorer(makeEl())).toBe(false);
    });

    it("returns false for null target", () => {
      expect(isInExplorer(null)).toBe(false);
    });
  });

  describe("isInExplorerSearch", () => {
    it("returns true for element inside [data-file-explorer-search]", () => {
      const search = makeEl();
      const child = makeEl({ closest: () => search });
      expect(isInExplorerSearch(child)).toBe(true);
    });

    it("returns false for element outside search", () => {
      expect(isInExplorerSearch(makeEl())).toBe(false);
    });
  });

  describe("isInExplorerSearchResults", () => {
    it("returns true for element inside [data-file-explorer-search-results]", () => {
      const results = makeEl();
      const child = makeEl({ closest: () => results });
      expect(isInExplorerSearchResults(child)).toBe(true);
    });

    it("returns false for element outside results", () => {
      expect(isInExplorerSearchResults(makeEl())).toBe(false);
    });
  });

  describe("isInSourceControl", () => {
    it("returns true for element inside [data-source-control]", () => {
      const sc = makeEl();
      const child = makeEl({ closest: () => sc });
      expect(isInSourceControl(child)).toBe(true);
    });

    it("returns false for element outside source control", () => {
      expect(isInSourceControl(makeEl())).toBe(false);
    });
  });
});
