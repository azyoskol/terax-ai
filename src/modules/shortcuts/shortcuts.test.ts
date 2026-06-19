import { describe, expect, it } from "vitest";
import { getBindingTokens, matchBinding, type KeyBinding } from "./shortcuts";

function bind(
  key: string,
  opts: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {},
): KeyBinding {
  return { key, ...opts };
}

type FakeEvent = {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
};

function evt(
  key: string,
  opts: {
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
  } = {},
): FakeEvent {
  return {
    key,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    metaKey: opts.metaKey ?? false,
  };
}

describe("matchBinding", () => {
  it("matches a simple key", () => {
    expect(matchBinding(evt("a") as unknown as KeyboardEvent, bind("a"))).toBe(true);
  });

  it("matches with ctrl modifier", () => {
    expect(matchBinding(evt("p", { ctrlKey: true }) as unknown as KeyboardEvent, bind("p", { ctrl: true }))).toBe(true);
  });

  it("rejects when ctrl is missing", () => {
    expect(matchBinding(evt("p") as unknown as KeyboardEvent, bind("p", { ctrl: true }))).toBe(false);
  });

  it("rejects when extra ctrl present", () => {
    expect(matchBinding(evt("p", { ctrlKey: true }) as unknown as KeyboardEvent, bind("p"))).toBe(false);
  });

  it("matches with shift modifier", () => {
    expect(matchBinding(evt("P", { shiftKey: true }) as unknown as KeyboardEvent, bind("P", { shift: true }))).toBe(true);
  });

  it("matches with alt modifier", () => {
    expect(matchBinding(evt("ArrowLeft", { altKey: true }) as unknown as KeyboardEvent, bind("ArrowLeft", { alt: true }))).toBe(true);
  });

  it("matches with meta modifier", () => {
    expect(matchBinding(evt("k", { metaKey: true }) as unknown as KeyboardEvent, bind("k", { meta: true }))).toBe(true);
  });

  it("matches combined modifiers", () => {
    expect(
      matchBinding(
        evt("h", { ctrlKey: true }) as unknown as KeyboardEvent,
        bind("h", { ctrl: true }),
      ),
    ).toBe(true);
  });

  it("case-insensitive matching", () => {
    expect(matchBinding(evt("a") as unknown as KeyboardEvent, bind("A"))).toBe(true);
    expect(matchBinding(evt("A") as unknown as KeyboardEvent, bind("a"))).toBe(true);
  });

  it("special case: tab.selectByIndex accepts digits 1-9", () => {
    expect(matchBinding(evt("5") as unknown as KeyboardEvent, bind("5"), "tab.selectByIndex")).toBe(true);
    expect(matchBinding(evt("0") as unknown as KeyboardEvent, bind("0"), "tab.selectByIndex")).toBe(false);
  });

  it("rejects different keys", () => {
    expect(matchBinding(evt("b") as unknown as KeyboardEvent, bind("a"))).toBe(false);
  });
});

describe("getBindingTokens", () => {
  it("returns empty array for undefined", () => {
    expect(getBindingTokens(undefined)).toEqual([]);
  });

  it("returns a single key token for a bare binding", () => {
    expect(getBindingTokens(bind("a"))).toEqual(["A"]);
  });

  it("shows Ctrl for ctrl bindings", () => {
    const tokens = getBindingTokens(bind("h", { ctrl: true }));
    expect(tokens).toContain("Ctrl");
    expect(tokens).toContain("H");
  });

  it("shows modifier tokens in correct order on non-Mac", () => {
    const tokens = getBindingTokens(bind("p", { ctrl: true, shift: true }));
    expect(tokens[0]).toBe("Ctrl");
    expect(tokens[1]).toBe("Shift");
    expect(tokens[2]).toBe("P");
  });

  it("renders Space for spacebar key", () => {
    expect(getBindingTokens(bind(" "))).toEqual(["Space"]);
  });

  it("renders arrow symbols", () => {
    expect(getBindingTokens(bind("ArrowUp"))).toEqual(["↑"]);
    expect(getBindingTokens(bind("ArrowDown"))).toEqual(["↓"]);
    expect(getBindingTokens(bind("ArrowLeft"))).toEqual(["←"]);
    expect(getBindingTokens(bind("ArrowRight"))).toEqual(["→"]);
  });
});
