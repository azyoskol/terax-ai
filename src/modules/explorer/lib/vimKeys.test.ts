import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  normalizeVimKey,
  isPlainVimKey,
  isPendingGKey,
  isCapitalGKey,
  interpretVimListKey,
} from "./vimKeys";

describe("normalizeVimKey", () => {
  it("maps h to ArrowLeft", () => {
    expect(normalizeVimKey("h")).toBe("ArrowLeft");
  });

  it("maps j to ArrowDown", () => {
    expect(normalizeVimKey("j")).toBe("ArrowDown");
  });

  it("maps k to ArrowUp", () => {
    expect(normalizeVimKey("k")).toBe("ArrowUp");
  });

  it("maps l to ArrowRight", () => {
    expect(normalizeVimKey("l")).toBe("ArrowRight");
  });

  it("passes through ArrowDown unchanged", () => {
    expect(normalizeVimKey("ArrowDown")).toBe("ArrowDown");
  });

  it("passes through Enter unchanged", () => {
    expect(normalizeVimKey("Enter")).toBe("Enter");
  });

  it("passes through lowercase non-vim keys unchanged", () => {
    expect(normalizeVimKey("a")).toBe("a");
    expect(normalizeVimKey("x")).toBe("x");
  });

  it("passes through uppercase non-vim keys unchanged", () => {
    expect(normalizeVimKey("A")).toBe("A");
    expect(normalizeVimKey("R")).toBe("R");
  });
});

function makeKeyLike(
  key: string,
  opts: { ctrl?: boolean; alt?: boolean; meta?: boolean; shift?: boolean } = {},
) {
  return {
    key,
    ctrlKey: opts.ctrl ?? false,
    altKey: opts.alt ?? false,
    metaKey: opts.meta ?? false,
    shiftKey: opts.shift ?? false,
  };
}

describe("isPlainVimKey", () => {
  it("returns true for plain keys", () => {
    expect(isPlainVimKey(makeKeyLike("j"))).toBe(true);
    expect(isPlainVimKey(makeKeyLike("g"))).toBe(true);
    expect(isPlainVimKey(makeKeyLike("G"))).toBe(true);
  });

  it("returns false for modifier keys", () => {
    expect(isPlainVimKey(makeKeyLike("j", { ctrl: true }))).toBe(false);
    expect(isPlainVimKey(makeKeyLike("j", { alt: true }))).toBe(false);
    expect(isPlainVimKey(makeKeyLike("j", { meta: true }))).toBe(false);
  });
});

describe("isPendingGKey", () => {
  it("returns true for plain g", () => {
    expect(isPendingGKey(makeKeyLike("g"))).toBe(true);
  });

  it("returns false for G", () => {
    expect(isPendingGKey(makeKeyLike("G"))).toBe(false);
  });

  it("returns false for Ctrl+g", () => {
    expect(isPendingGKey(makeKeyLike("g", { ctrl: true }))).toBe(false);
  });

  it("returns false for Alt+g", () => {
    expect(isPendingGKey(makeKeyLike("g", { alt: true }))).toBe(false);
  });
});

describe("isCapitalGKey", () => {
  it("returns true for plain G", () => {
    expect(isCapitalGKey(makeKeyLike("G"))).toBe(true);
  });

  it("returns false for g", () => {
    expect(isCapitalGKey(makeKeyLike("g"))).toBe(false);
  });

  it("returns false for Ctrl+G", () => {
    expect(isCapitalGKey(makeKeyLike("G", { ctrl: true }))).toBe(false);
  });

  it("returns false for Alt+G", () => {
    expect(isCapitalGKey(makeKeyLike("G", { alt: true }))).toBe(false);
  });
});

describe("interpretVimListKey", () => {
  function makeEvent(
    key: string,
    mods: { ctrl?: boolean; alt?: boolean; meta?: boolean } = {},
  ) {
    return { key, ctrlKey: mods.ctrl ?? false, altKey: mods.alt ?? false, metaKey: mods.meta ?? false } as KeyboardEvent;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("j returns next", () => {
    const ref = { current: null };
    expect(interpretVimListKey(makeEvent("j"), ref)).toEqual({ kind: "next" });
  });

  it("k returns prev", () => {
    const ref = { current: null };
    expect(interpretVimListKey(makeEvent("k"), ref)).toEqual({ kind: "prev" });
  });

  it("single g returns armG", () => {
    const ref = { current: null };
    expect(interpretVimListKey(makeEvent("g"), ref)).toEqual({ kind: "armG" });
    expect(ref.current).not.toBeNull();
  });

  it("gg returns first", () => {
    const ref: { current: number | null } = { current: 123 };
    expect(interpretVimListKey(makeEvent("g"), ref)).toEqual({ kind: "first" });
    expect(ref.current).toBeNull();
  });

  it("G returns last", () => {
    const ref = { current: null };
    expect(interpretVimListKey(makeEvent("G"), ref)).toEqual({ kind: "last" });
  });

  it("Ctrl+j returns none (does not move)", () => {
    const ref = { current: null };
    expect(interpretVimListKey(makeEvent("j", { ctrl: true }), ref)).toEqual({
      kind: "none",
    });
  });

  it("Alt+g does not trigger gg", () => {
    const ref = { current: null };
    expect(interpretVimListKey(makeEvent("g", { alt: true }), ref)).toEqual({
      kind: "none",
    });
  });

  it("Meta+g does not trigger gg", () => {
    const ref = { current: null };
    expect(interpretVimListKey(makeEvent("g", { meta: true }), ref)).toEqual({
      kind: "none",
    });
  });

  it("Enter returns activate", () => {
    const ref = { current: null };
    expect(interpretVimListKey(makeEvent("Enter"), ref)).toEqual({
      kind: "activate",
    });
  });

  it("Escape returns escape", () => {
    const ref = { current: null };
    expect(interpretVimListKey(makeEvent("Escape"), ref)).toEqual({
      kind: "escape",
    });
  });

  it("non-g key clears pending g", () => {
    const ref = { current: 123 as unknown as number };
    expect(interpretVimListKey(makeEvent("j"), ref)).toEqual({ kind: "next" });
    expect(ref.current).toBeNull();
  });

  it("Enter clears pending g", () => {
    const ref = { current: 123 as unknown as number };
    expect(interpretVimListKey(makeEvent("Enter"), ref)).toEqual({
      kind: "activate",
    });
    expect(ref.current).toBeNull();
  });

  it("pending g clears after GG_TIMEOUT_MS", () => {
    const ref = { current: null };
    interpretVimListKey(makeEvent("g"), ref);
    expect(ref.current).not.toBeNull();
    vi.advanceTimersByTime(800);
    expect(ref.current).toBeNull();
  });

  it("returns none for unknown keys", () => {
    const ref = { current: null };
    expect(interpretVimListKey(makeEvent("a"), ref)).toEqual({ kind: "none" });
    expect(interpretVimListKey(makeEvent("x"), ref)).toEqual({ kind: "none" });
  });
});
