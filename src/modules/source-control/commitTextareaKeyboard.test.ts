import { describe, expect, it } from "vitest";

// Pure classification of commit-textarea keyboard events.
// Mirrors the decision tree in handleCommitShortcut (SourceControlPanel.tsx).
// Component-level tests (preventDefault, blur, focus restore) require jsdom
// and are covered by the manual smoke checklist in
// docs/keyboard-navigation-behavior.md §6 and §11.
function classifyCommitKey(
  key: string,
  {
    metaKey = false,
    ctrlKey = false,
    canCommit = false,
    canGenerate = false,
  }: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    canCommit?: boolean;
    canGenerate?: boolean;
  } = {},
): "escape" | "commit" | "generate" | "none" {
  const mod = metaKey || ctrlKey;
  if (key === "Escape") return "escape";
  if (key === "Enter" && mod && canCommit) return "commit";
  if (key.toLowerCase() === "g" && mod && canGenerate) return "generate";
  return "none";
}

describe("classifyCommitKey — Escape", () => {
  it("classifies Escape regardless of modifiers or state", () => {
    expect(classifyCommitKey("Escape")).toBe("escape");
    expect(classifyCommitKey("Escape", { metaKey: true, canCommit: true })).toBe("escape");
    expect(classifyCommitKey("Escape", { ctrlKey: true, canGenerate: true })).toBe("escape");
  });

  it("does not classify non-Escape keys as escape", () => {
    expect(classifyCommitKey("Esc")).toBe("none");
    expect(classifyCommitKey("escape")).toBe("none");
  });
});

describe("classifyCommitKey — commit", () => {
  it("classifies Ctrl+Enter as commit when canCommit", () => {
    expect(classifyCommitKey("Enter", { ctrlKey: true, canCommit: true })).toBe("commit");
    expect(classifyCommitKey("Enter", { metaKey: true, canCommit: true })).toBe("commit");
  });

  it("does not commit when canCommit is false", () => {
    expect(classifyCommitKey("Enter", { ctrlKey: true, canCommit: false })).toBe("none");
  });

  it("does not commit on plain Enter", () => {
    expect(classifyCommitKey("Enter", { canCommit: true })).toBe("none");
  });
});

describe("classifyCommitKey — generate", () => {
  it("classifies Ctrl+G / Cmd+G as generate when canGenerate", () => {
    expect(classifyCommitKey("g", { ctrlKey: true, canGenerate: true })).toBe("generate");
    expect(classifyCommitKey("g", { metaKey: true, canGenerate: true })).toBe("generate");
    expect(classifyCommitKey("G", { ctrlKey: true, canGenerate: true })).toBe("generate");
  });

  it("does not generate when canGenerate is false", () => {
    expect(classifyCommitKey("g", { ctrlKey: true, canGenerate: false })).toBe("none");
  });

  it("does not generate on plain g", () => {
    expect(classifyCommitKey("g", { canGenerate: true })).toBe("none");
  });
});

describe("classifyCommitKey — none", () => {
  it("returns none for arbitrary keys", () => {
    expect(classifyCommitKey("a")).toBe("none");
    expect(classifyCommitKey(" ")).toBe("none");
    expect(classifyCommitKey("Tab")).toBe("none");
  });
});

describe("classifyCommitKey — Escape takes priority", () => {
  it("Escape wins even when canCommit and canGenerate are true", () => {
    // Should not accidentally commit or generate when the key is Escape.
    expect(
      classifyCommitKey("Escape", { metaKey: true, canCommit: true, canGenerate: true }),
    ).toBe("escape");
  });
});
