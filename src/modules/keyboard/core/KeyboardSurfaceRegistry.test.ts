import { describe, expect, it, vi } from "vitest";
import { keyboardSurfaceRegistry } from "./KeyboardSurfaceRegistry";

describe("keyboardSurfaceRegistry", () => {
  it("registers and retrieves surfaces", () => {
    const handle = {
      id: "test-reg",
      scope: "editor" as const,
      focus: vi.fn(),
      isFocused: vi.fn().mockReturnValue(false),
    };
    const unsub = keyboardSurfaceRegistry.register(handle);
    expect(keyboardSurfaceRegistry.get("test-reg")).toBe(handle);
    unsub();
  });

  it("finds surface by scope", () => {
    const handle = {
      id: "editor-test",
      scope: "editor" as const,
      focus: vi.fn(),
      isFocused: vi.fn().mockReturnValue(false),
    };
    const unsub = keyboardSurfaceRegistry.register(handle);
    expect(keyboardSurfaceRegistry.getByScope("editor")).toBeDefined();
    unsub();
  });

  it("focuses surface by id", () => {
    const handle = {
      id: "focus-test",
      scope: "editor" as const,
      focus: vi.fn().mockReturnValue(true),
      isFocused: vi.fn().mockReturnValue(false),
    };
    const unsub = keyboardSurfaceRegistry.register(handle);
    keyboardSurfaceRegistry.focus("focus-test");
    expect(handle.focus).toHaveBeenCalled();
    unsub();
  });
});
