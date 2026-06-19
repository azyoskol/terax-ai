import { describe, expect, it } from "vitest";
import { normalizeVimKey } from "./vimKeys";

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
