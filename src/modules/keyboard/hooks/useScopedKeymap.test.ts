import { describe, expect, it, vi } from "vitest";
import {
  matchesModifiers,
  matchesKeyBinding,
  getBindingHelp,
  type KeyBinding,
} from "./useScopedKeymap";

// ---------------------------------------------------------------------------
// matchesModifiers
// ---------------------------------------------------------------------------

function makeEvent(
  key: string,
  opts: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean } = {},
): KeyboardEvent {
  return {
    key,
    ctrlKey: opts.ctrl ?? false,
    metaKey: opts.meta ?? false,
    altKey: opts.alt ?? false,
    shiftKey: opts.shift ?? false,
  } as unknown as KeyboardEvent;
}

describe("matchesModifiers", () => {
  it("no modifiers required when descriptor omits modifiers", () => {
    expect(matchesModifiers(makeEvent("r"))).toBe(true);
  });

  it("rejects ctrl when no modifiers specified", () => {
    expect(matchesModifiers(makeEvent("r", { ctrl: true }))).toBe(false);
  });

  it("rejects meta when no modifiers specified", () => {
    expect(matchesModifiers(makeEvent("r", { meta: true }))).toBe(false);
  });

  it("rejects alt when no modifiers specified", () => {
    expect(matchesModifiers(makeEvent("r", { alt: true }))).toBe(false);
  });

  it("shift is allowed when no modifiers specified (uppercase key)", () => {
    expect(matchesModifiers(makeEvent("P", { shift: true }))).toBe(true);
  });

  it("matches ctrl when explicitly required", () => {
    expect(
      matchesModifiers(makeEvent("r", { ctrl: true }), { ctrl: true }),
    ).toBe(true);
  });

  it("rejects non-ctrl when ctrl required", () => {
    expect(
      matchesModifiers(makeEvent("r"), { ctrl: true }),
    ).toBe(false);
  });

  it("rejects ctrl when ctrl not required", () => {
    expect(
      matchesModifiers(makeEvent("r", { ctrl: true }), { ctrl: false }),
    ).toBe(false);
  });

  it("matches meta when explicitly required", () => {
    expect(
      matchesModifiers(makeEvent("s", { meta: true }), { meta: true }),
    ).toBe(true);
  });

  it("matches alt when explicitly required", () => {
    expect(
      matchesModifiers(makeEvent("r", { alt: true }), { alt: true }),
    ).toBe(true);
  });

  it("matches shift when explicitly required", () => {
    expect(
      matchesModifiers(makeEvent("P", { shift: true }), { shift: true }),
    ).toBe(true);
  });

  it("rejects shift when shift required but absent", () => {
    expect(
      matchesModifiers(makeEvent("p"), { shift: true }),
    ).toBe(false);
  });

  it("matches ctrl+shift when both required", () => {
    expect(
      matchesModifiers(makeEvent("r", { ctrl: true, shift: true }), {
        ctrl: true,
        shift: true,
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchesKeyBinding
// ---------------------------------------------------------------------------

describe("matchesKeyBinding", () => {
  it("matches plain key", () => {
    const binding: KeyBinding = {
      key: "r",
      description: "Refresh",
      action: vi.fn(),
    };
    expect(matchesKeyBinding(makeEvent("r"), binding)).toBe(true);
  });

  it("rejects wrong key", () => {
    const binding: KeyBinding = {
      key: "r",
      description: "Refresh",
      action: vi.fn(),
    };
    expect(matchesKeyBinding(makeEvent("j"), binding)).toBe(false);
  });

  it("rejects ctrl when not in modifier descriptor", () => {
    const binding: KeyBinding = {
      key: "r",
      description: "Refresh",
      action: vi.fn(),
    };
    expect(matchesKeyBinding(makeEvent("r", { ctrl: true }), binding)).toBe(
      false,
    );
  });

  it("matches ctrl+R with modifier descriptor", () => {
    const binding: KeyBinding = {
      key: "r",
      description: "Refresh",
      modifiers: { ctrl: true },
      action: vi.fn(),
    };
    expect(matchesKeyBinding(makeEvent("r", { ctrl: true }), binding)).toBe(
      true,
    );
  });

  it("matches uppercase P without explicit shift", () => {
    const binding: KeyBinding = {
      key: "P",
      description: "Pull",
      action: vi.fn(),
    };
    expect(
      matchesKeyBinding(makeEvent("P", { shift: true }), binding),
    ).toBe(true);
  });

  it("matches Enter", () => {
    const binding: KeyBinding = {
      key: "Enter",
      description: "Open",
      action: vi.fn(),
    };
    expect(matchesKeyBinding(makeEvent("Enter"), binding)).toBe(true);
  });

  it("matches Ctrl+Enter with modifier descriptor", () => {
    const binding: KeyBinding = {
      key: "Enter",
      description: "Commit",
      modifiers: { ctrl: true },
      action: vi.fn(),
    };
    expect(
      matchesKeyBinding(makeEvent("Enter", { ctrl: true }), binding),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getBindingHelp
// ---------------------------------------------------------------------------

describe("getBindingHelp", () => {
  it("excludes hidden bindings", () => {
    const bindings: KeyBinding[] = [
      { key: "j", description: "Next", action: vi.fn() },
      { key: "k", description: "Prev", action: vi.fn(), hidden: true },
    ];
    const help = getBindingHelp(bindings);
    expect(help).toHaveLength(1);
    expect(help[0].description).toBe("Next");
  });

  it("uses helpKey when provided", () => {
    const bindings: KeyBinding[] = [
      {
        key: "g",
        sequence: "gg",
        description: "First",
        helpKey: "gg",
        action: vi.fn(),
      },
    ];
    const help = getBindingHelp(bindings);
    expect(help[0].key).toBe("gg");
  });

  it("uses sequence when helpKey not provided", () => {
    const bindings: KeyBinding[] = [
      { key: "g", sequence: "gg", description: "First", action: vi.fn() },
    ];
    const help = getBindingHelp(bindings);
    expect(help[0].key).toBe("gg");
  });

  it("formats modifiers", () => {
    const bindings: KeyBinding[] = [
      {
        key: "r",
        modifiers: { ctrl: true },
        description: "Refresh",
        action: vi.fn(),
      },
    ];
    const help = getBindingHelp(bindings);
    expect(help[0].key).toBe("Ctrl+r");
  });

  it("formats ctrl+shift", () => {
    const bindings: KeyBinding[] = [
      {
        key: "P",
        modifiers: { ctrl: true, shift: true },
        description: "Push",
        action: vi.fn(),
      },
    ];
    const help = getBindingHelp(bindings);
    expect(help[0].key).toBe("Ctrl+Shift+P");
  });

  it("formats plain key", () => {
    const bindings: KeyBinding[] = [
      { key: "Enter", description: "Open", action: vi.fn() },
    ];
    const help = getBindingHelp(bindings);
    expect(help[0].key).toBe("Enter");
  });
});
