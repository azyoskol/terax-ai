import { describe, expect, it } from "vitest";
import {
  focusWithRetry,
  focusElementBySelectorWithRetry,
  focusEditorWithRetry,
} from "./focusHelpers";

describe("focusHelpers", () => {
  it("exports focusWithRetry", () => {
    expect(typeof focusWithRetry).toBe("function");
  });

  it("exports focusElementBySelectorWithRetry", () => {
    expect(typeof focusElementBySelectorWithRetry).toBe("function");
  });

  it("exports focusEditorWithRetry", () => {
    expect(typeof focusEditorWithRetry).toBe("function");
  });
});
