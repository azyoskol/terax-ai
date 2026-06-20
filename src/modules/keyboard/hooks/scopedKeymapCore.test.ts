import { describe, expect, it, vi } from "vitest";
import {
  createSequenceState,
  armSequence,
  resetSequence,
  clearSequenceTimeoutOnly,
  processSequenceKey,
  matchesModifiers,
  matchesKeyBinding,
  getBindingHelp,
} from "./scopedKeymapCore";
import type { KeyBinding } from "./useScopedKeymap";

function makeEvent(
  key: string,
  opts: {
    ctrl?: boolean;
    meta?: boolean;
    alt?: boolean;
    shift?: boolean;
    preventDefault?: ReturnType<typeof vi.fn>;
    stopPropagation?: ReturnType<typeof vi.fn>;
  } = {},
): KeyboardEvent {
  return {
    key,
    ctrlKey: opts.ctrl ?? false,
    metaKey: opts.meta ?? false,
    altKey: opts.alt ?? false,
    shiftKey: opts.shift ?? false,
    preventDefault: opts.preventDefault ?? vi.fn(),
    stopPropagation: opts.stopPropagation ?? vi.fn(),
  } as unknown as KeyboardEvent;
}

function makeBinding(
  overrides: Partial<KeyBinding> & { key: string },
): KeyBinding {
  return {
    description: overrides.description ?? "test",
    action: overrides.action ?? vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// matchesModifiers
// ---------------------------------------------------------------------------

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
    expect(matchesModifiers(makeEvent("r"), { ctrl: true })).toBe(false);
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
    expect(matchesModifiers(makeEvent("p"), { shift: true })).toBe(false);
  });

  it("matches ctrl+shift when both required", () => {
    expect(
      matchesModifiers(makeEvent("r", { ctrl: true, shift: true }), {
        ctrl: true,
        shift: true,
      }),
    ).toBe(true);
  });

  it("rejects alt when ctrl required", () => {
    expect(
      matchesModifiers(makeEvent("r", { alt: true }), { ctrl: true }),
    ).toBe(false);
  });

  it("matches ctrl+alt when both required", () => {
    expect(
      matchesModifiers(makeEvent("r", { ctrl: true, alt: true }), {
        ctrl: true,
        alt: true,
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// matchesKeyBinding
// ---------------------------------------------------------------------------

describe("matchesKeyBinding", () => {
  it("matches plain key", () => {
    const binding = makeBinding({ key: "r" });
    expect(matchesKeyBinding(makeEvent("r"), binding)).toBe(true);
  });

  it("rejects wrong key", () => {
    const binding = makeBinding({ key: "r" });
    expect(matchesKeyBinding(makeEvent("j"), binding)).toBe(false);
  });

  it("rejects ctrl when not in modifier descriptor", () => {
    const binding = makeBinding({ key: "r" });
    expect(matchesKeyBinding(makeEvent("r", { ctrl: true }), binding)).toBe(
      false,
    );
  });

  it("matches ctrl+R with modifier descriptor", () => {
    const binding = makeBinding({ key: "r", modifiers: { ctrl: true } });
    expect(matchesKeyBinding(makeEvent("r", { ctrl: true }), binding)).toBe(
      true,
    );
  });

  it("matches uppercase P without explicit shift", () => {
    const binding = makeBinding({ key: "P" });
    expect(
      matchesKeyBinding(makeEvent("P", { shift: true }), binding),
    ).toBe(true);
  });

  it("matches Enter", () => {
    const binding = makeBinding({ key: "Enter" });
    expect(matchesKeyBinding(makeEvent("Enter"), binding)).toBe(true);
  });

  it("matches Ctrl+Enter with modifier descriptor", () => {
    const binding = makeBinding({
      key: "Enter",
      modifiers: { ctrl: true },
    });
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
      makeBinding({ key: "j", description: "Next" }),
      makeBinding({ key: "k", description: "Prev", hidden: true }),
    ];
    const help = getBindingHelp(bindings);
    expect(help).toHaveLength(1);
    expect(help[0].description).toBe("Next");
  });

  it("uses helpKey when provided", () => {
    const bindings: KeyBinding[] = [
      makeBinding({ key: "g", sequence: "gg", helpKey: "gg" }),
    ];
    const help = getBindingHelp(bindings);
    expect(help[0].key).toBe("gg");
  });

  it("uses sequence when helpKey not provided", () => {
    const bindings: KeyBinding[] = [
      makeBinding({ key: "g", sequence: "gg" }),
    ];
    const help = getBindingHelp(bindings);
    expect(help[0].key).toBe("gg");
  });

  it("formats modifiers", () => {
    const bindings: KeyBinding[] = [
      makeBinding({ key: "r", modifiers: { ctrl: true } }),
    ];
    const help = getBindingHelp(bindings);
    expect(help[0].key).toBe("Ctrl+r");
  });

  it("formats ctrl+shift", () => {
    const bindings: KeyBinding[] = [
      makeBinding({
        key: "P",
        modifiers: { ctrl: true, shift: true },
      }),
    ];
    const help = getBindingHelp(bindings);
    expect(help[0].key).toBe("Ctrl+Shift+P");
  });

  it("formats plain key", () => {
    const bindings: KeyBinding[] = [makeBinding({ key: "Enter" })];
    const help = getBindingHelp(bindings);
    expect(help[0].key).toBe("Enter");
  });
});

// ---------------------------------------------------------------------------
// Sequence state machine
// ---------------------------------------------------------------------------

describe("createSequenceState", () => {
  it("creates empty state", () => {
    const state = createSequenceState();
    expect(state.pendingSequence).toBeNull();
    expect(state.pendingTimeout).toBeNull();
    expect(state.pendingBindings).toEqual([]);
  });
});

describe("resetSequence", () => {
  it("clears timeout and resets fields", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    state.pendingSequence = "g";
    state.pendingTimeout = setTimeout(() => {}, 1000);
    state.pendingBindings = [makeBinding({ key: "g", sequence: "gg" })];

    resetSequence(state);

    expect(state.pendingSequence).toBeNull();
    expect(state.pendingTimeout).toBeNull();
    expect(state.pendingBindings).toEqual([]);
    vi.useRealTimers();
  });

  it("is safe to call on already-empty state", () => {
    const state = createSequenceState();
    resetSequence(state);
    expect(state.pendingSequence).toBeNull();
  });
});

describe("clearSequenceTimeoutOnly", () => {
  it("clears timeout without touching sequence data", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    state.pendingSequence = "g";
    state.pendingTimeout = setTimeout(() => {}, 1000);
    state.pendingBindings = [makeBinding({ key: "g", sequence: "gg" })];

    clearSequenceTimeoutOnly(state);

    expect(state.pendingTimeout).toBeNull();
    expect(state.pendingSequence).toBe("g");
    expect(state.pendingBindings).toHaveLength(1);
    vi.useRealTimers();
  });
});

describe("armSequence", () => {
  it("arms sequence with matching candidates", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    const gg = makeBinding({ key: "g", sequence: "gg" });
    const result = armSequence(state, "g", [gg], 700);

    expect(result).toBe(true);
    expect(state.pendingSequence).toBe("g");
    expect(state.pendingBindings).toHaveLength(1);
    expect(state.pendingTimeout).not.toBeNull();
    vi.useRealTimers();
  });

  it("returns false when no candidate matches", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    const j = makeBinding({ key: "j" });
    const result = armSequence(state, "g", [j], 700);

    expect(result).toBe(false);
    expect(state.pendingSequence).toBeNull();
    vi.useRealTimers();
  });

  it("does not clear pendingSequence after setting it", () => {
    // This is the core bug test — armSequence must NOT call resetSequence
    vi.useFakeTimers();
    const state = createSequenceState();
    const gg = makeBinding({ key: "g", sequence: "gg" });

    armSequence(state, "g", [gg], 700);

    // The bug was: clearSequenceTimeout immediately cleared pendingSequence
    expect(state.pendingSequence).toBe("g");
    expect(state.pendingBindings).toHaveLength(1);
    vi.useRealTimers();
  });

  it("re-arms over a previous pending sequence", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    const gg = makeBinding({ key: "g", sequence: "gg" });

    armSequence(state, "g", [gg], 700);
    const firstTimeout = state.pendingTimeout;

    // Arm again with same key
    armSequence(state, "g", [gg], 700);

    expect(state.pendingSequence).toBe("g");
    // Old timeout should have been cleared
    expect(state.pendingTimeout).not.toBe(firstTimeout);
    vi.useRealTimers();
  });

  it("arms only single-char-first sequences, not single-key bindings", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    const singleKey = makeBinding({ key: "g" }); // no sequence

    const result = armSequence(state, "g", [singleKey], 700);
    expect(result).toBe(false);
    vi.useRealTimers();
  });

  it("arms only sequences longer than 1 char", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    const oneCharSeq = makeBinding({ key: "g", sequence: "g" }); // length 1

    const result = armSequence(state, "g", [oneCharSeq], 700);
    expect(result).toBe(false);
    vi.useRealTimers();
  });

  it("timeout resets sequence state", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    const gg = makeBinding({ key: "g", sequence: "gg" });

    armSequence(state, "g", [gg], 700);
    expect(state.pendingSequence).toBe("g");

    vi.advanceTimersByTime(700);

    expect(state.pendingSequence).toBeNull();
    expect(state.pendingBindings).toEqual([]);
    expect(state.pendingTimeout).toBeNull();
    vi.useRealTimers();
  });
});

describe("processSequenceKey", () => {
  it("returns no-sequence when no pending sequence", () => {
    const state = createSequenceState();
    const result = processSequenceKey(state, makeEvent("g"));
    expect(result).toBe("no-sequence");
  });

  it("returns sequence-broken when modified key during pending sequence", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    armSequence(state, "g", [makeBinding({ key: "g", sequence: "gg" })], 700);

    const result = processSequenceKey(
      state,
      makeEvent("r", { ctrl: true }),
    );

    expect(result).toBe("sequence-broken");
    expect(state.pendingSequence).toBeNull();
    vi.useRealTimers();
  });

  it("returns no-sequence when modified key and no pending sequence", () => {
    const state = createSequenceState();
    const result = processSequenceKey(
      state,
      makeEvent("r", { ctrl: true }),
    );
    expect(result).toBe("no-sequence");
  });

  it("returns sequence-fired when full sequence matches", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    const gg = makeBinding({ key: "g", sequence: "gg" });
    armSequence(state, "g", [gg], 700);

    const result = processSequenceKey(state, makeEvent("g"));

    expect(result).toBe("sequence-fired");
    expect(state.pendingSequence).toBeNull();
    expect(state.pendingBindings).toEqual([]);
    vi.useRealTimers();
  });

  it("returns sequence-broken when second key does not match any candidate", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    const gg = makeBinding({ key: "g", sequence: "gg" });
    armSequence(state, "g", [gg], 700);

    const result = processSequenceKey(state, makeEvent("j"));

    expect(result).toBe("sequence-broken");
    expect(state.pendingSequence).toBeNull();
    vi.useRealTimers();
  });

  it("returns no-sequence after previous sequence already cleared", () => {
    vi.useFakeTimers();
    const state = createSequenceState();
    const gg = makeBinding({ key: "g", sequence: "gg" });
    armSequence(state, "g", [gg], 700);

    // Complete the sequence
    processSequenceKey(state, makeEvent("g"));
    // Now there should be no pending
    const result = processSequenceKey(state, makeEvent("g"));
    expect(result).toBe("no-sequence");
    vi.useRealTimers();
  });
});
