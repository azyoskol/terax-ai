import { describe, expect, it } from "vitest";
import { interpretVimListKey, type VimListAction } from "./vimKeys";

/**
 * Pure helper that mirrors what BufferTabPicker / SpaceSwitcher do with a
 * VimListAction: move an index within [0, len) and return whether the action
 * was "activate" or "escape".
 */
function applyListAction(
  action: VimListAction,
  index: number,
  len: number,
): { index: number; didActivate: boolean; didEscape: boolean } {
  switch (action.kind) {
    case "next":
      return { index: Math.min(index + 1, len - 1), didActivate: false, didEscape: false };
    case "prev":
      return { index: Math.max(index - 1, 0), didActivate: false, didEscape: false };
    case "first":
      return { index: 0, didActivate: false, didEscape: false };
    case "last":
      return { index: len - 1, didActivate: false, didEscape: false };
    case "activate":
      return { index, didActivate: true, didEscape: false };
    case "escape":
      return { index, didActivate: false, didEscape: true };
    case "armG":
    case "none":
      return { index, didActivate: false, didEscape: false };
  }
}

function makeEvent(key: string): KeyboardEvent {
  return { key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false } as KeyboardEvent;
}

describe("list navigation actions", () => {
  describe("next / prev clamp", () => {
    it("next moves forward within bounds", () => {
      const ref = { current: null };
      expect(applyListAction(interpretVimListKey(makeEvent("j"), ref), 0, 5).index).toBe(1);
      expect(applyListAction(interpretVimListKey(makeEvent("j"), ref), 3, 5).index).toBe(4);
    });

    it("next clamps at last item", () => {
      const ref = { current: null };
      expect(applyListAction(interpretVimListKey(makeEvent("j"), ref), 4, 5).index).toBe(4);
    });

    it("next clamps when list is empty", () => {
      const ref = { current: null };
      expect(applyListAction(interpretVimListKey(makeEvent("j"), ref), 0, 0).index).toBe(-1);
    });

    it("prev moves backward within bounds", () => {
      const ref = { current: null };
      expect(applyListAction(interpretVimListKey(makeEvent("k"), ref), 3, 5).index).toBe(2);
      expect(applyListAction(interpretVimListKey(makeEvent("k"), ref), 1, 5).index).toBe(0);
    });

    it("prev clamps at first item", () => {
      const ref = { current: null };
      expect(applyListAction(interpretVimListKey(makeEvent("k"), ref), 0, 5).index).toBe(0);
    });
  });

  describe("first / last", () => {
    it("first goes to index 0", () => {
      const ref = { current: null };
      expect(applyListAction(interpretVimListKey(makeEvent("g"), ref), 3, 5).index).toBe(3);
      expect(ref.current).not.toBeNull();
      expect(applyListAction(interpretVimListKey(makeEvent("g"), ref), 3, 5).index).toBe(0);
    });

    it("last goes to len-1", () => {
      const ref = { current: null };
      expect(applyListAction(interpretVimListKey(makeEvent("G"), ref), 0, 5).index).toBe(4);
    });

    it("first on empty list sets index to 0", () => {
      const ref = { current: null };
      interpretVimListKey(makeEvent("g"), ref);
      expect(applyListAction(interpretVimListKey(makeEvent("g"), ref), 0, 0).index).toBe(0);
    });

    it("last on empty list sets index to -1", () => {
      const ref = { current: null };
      expect(applyListAction(interpretVimListKey(makeEvent("G"), ref), 0, 0).index).toBe(-1);
    });
  });

  describe("activate / escape", () => {
    it("Enter returns activate", () => {
      const ref = { current: null };
      const r = applyListAction(interpretVimListKey(makeEvent("Enter"), ref), 2, 10);
      expect(r.didActivate).toBe(true);
      expect(r.didEscape).toBe(false);
      expect(r.index).toBe(2);
    });

    it("Escape returns escape", () => {
      const ref = { current: null };
      const r = applyListAction(interpretVimListKey(makeEvent("Escape"), ref), 2, 10);
      expect(r.didActivate).toBe(false);
      expect(r.didEscape).toBe(true);
      expect(r.index).toBe(2);
    });

    it("unrecognized keys do not activate or escape", () => {
      const ref = { current: null };
      const r = applyListAction(interpretVimListKey(makeEvent("a"), ref), 2, 10);
      expect(r.didActivate).toBe(false);
      expect(r.didEscape).toBe(false);
      expect(r.index).toBe(2);
    });
  });

  describe("index unchanged on armG", () => {
    it("first g press keeps current index", () => {
      const ref = { current: null };
      const r = applyListAction(interpretVimListKey(makeEvent("g"), ref), 3, 10);
      expect(r.index).toBe(3);
      expect(r.didActivate).toBe(false);
    });
  });
});
