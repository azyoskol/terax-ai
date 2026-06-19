import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "./store";

describe("DEFAULT_PREFERENCES", () => {
  it("has vimMode defaulting to false", () => {
    expect(DEFAULT_PREFERENCES.vimMode).toBe(false);
  });

  it("has vimNavigationEnabled defaulting to false", () => {
    expect(DEFAULT_PREFERENCES.vimNavigationEnabled).toBe(false);
  });

  it("vimMode and vimNavigationEnabled are independent defaults", () => {
    expect(DEFAULT_PREFERENCES.vimMode).toBe(false);
    expect(DEFAULT_PREFERENCES.vimNavigationEnabled).toBe(false);
    expect(typeof DEFAULT_PREFERENCES.vimMode).toBe("boolean");
    expect(typeof DEFAULT_PREFERENCES.vimNavigationEnabled).toBe("boolean");
  });

  it("has all required navigation-related preferences", () => {
    expect(typeof DEFAULT_PREFERENCES.showHidden).toBe("boolean");
    expect(typeof DEFAULT_PREFERENCES.explorerGitDecorations).toBe("boolean");
  });

  it("has terminal defaults", () => {
    expect(typeof DEFAULT_PREFERENCES.terminalWebglEnabled).toBe("boolean");
    expect(typeof DEFAULT_PREFERENCES.terminalCursorBlink).toBe("boolean");
    expect(typeof DEFAULT_PREFERENCES.terminalFontFamily).toBe("string");
    expect(typeof DEFAULT_PREFERENCES.terminalFontSize).toBe("number");
    expect(typeof DEFAULT_PREFERENCES.terminalScrollback).toBe("number");
  });

  it("has editor defaults", () => {
    expect(typeof DEFAULT_PREFERENCES.editorAutoSave).toBe("boolean");
    expect(typeof DEFAULT_PREFERENCES.editorAutoSaveDelay).toBe("number");
    expect(DEFAULT_PREFERENCES.editorAutoSaveDelay).toBeGreaterThan(0);
  });
});
