import { describe, expect, it, vi } from "vitest";
import { handleConfirmDialogKeyDown } from "./confirmDialog";

function makeEvent(
  key: string,
  target?: Partial<HTMLElement>,
): React.KeyboardEvent {
  return {
    key,
    target: target ?? null,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

describe("handleConfirmDialogKeyDown", () => {
  it("Enter confirms", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    handleConfirmDialogKeyDown(makeEvent("Enter"), { confirm, cancel });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("y confirms", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    handleConfirmDialogKeyDown(makeEvent("y"), { confirm, cancel });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("Y confirms", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    handleConfirmDialogKeyDown(makeEvent("Y"), { confirm, cancel });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("n cancels", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    handleConfirmDialogKeyDown(makeEvent("n"), { confirm, cancel });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("N cancels", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    handleConfirmDialogKeyDown(makeEvent("N"), { confirm, cancel });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("Escape cancels", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    handleConfirmDialogKeyDown(makeEvent("Escape"), { confirm, cancel });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("disabled prevents confirm on Enter", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    handleConfirmDialogKeyDown(makeEvent("Enter"), {
      confirm,
      cancel,
      disabled: true,
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("disabled prevents confirm on y", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    handleConfirmDialogKeyDown(makeEvent("y"), {
      confirm,
      cancel,
      disabled: true,
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("keys inside INPUT are ignored", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const target = { tagName: "INPUT", isContentEditable: false };
    handleConfirmDialogKeyDown(makeEvent("Enter", target), {
      confirm,
      cancel,
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("keys inside TEXTAREA are ignored", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const target = { tagName: "TEXTAREA", isContentEditable: false };
    handleConfirmDialogKeyDown(makeEvent("y", target), { confirm, cancel });
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("keys inside contentEditable are ignored", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const target = { tagName: "DIV", isContentEditable: true };
    handleConfirmDialogKeyDown(makeEvent("Escape", target), {
      confirm,
      cancel,
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("prevents default and stops propagation for handled keys", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const ev = makeEvent("Enter");
    handleConfirmDialogKeyDown(ev, { confirm, cancel });
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(ev.stopPropagation).toHaveBeenCalled();
  });

  it("prevents default and stops propagation for cancel keys", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const ev = makeEvent("Escape");
    handleConfirmDialogKeyDown(ev, { confirm, cancel });
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(ev.stopPropagation).toHaveBeenCalled();
  });

  it("unhandled keys do nothing", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const ev = makeEvent("a");
    handleConfirmDialogKeyDown(ev, { confirm, cancel });
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });

  it("disabled still allows cancel via Escape", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    handleConfirmDialogKeyDown(makeEvent("Escape"), {
      confirm,
      cancel,
      disabled: true,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("disabled still allows cancel via n", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    handleConfirmDialogKeyDown(makeEvent("n"), {
      confirm,
      cancel,
      disabled: true,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });
});
