import { describe, expect, it } from "vitest";
import {
  normalizeVimKey,
  isPlainVimKey,
  isPendingGKey,
  isCapitalGKey,
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
