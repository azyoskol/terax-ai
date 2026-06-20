import type { KeyboardEvent } from "react";

type ConfirmDialogOptions = {
  confirm: () => void;
  cancel: () => void;
  disabled?: boolean;
};

export function handleConfirmDialogKeyDown(
  event: KeyboardEvent,
  { confirm, cancel, disabled }: ConfirmDialogOptions,
) {
  const target = event.target as HTMLElement | null;

  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  ) {
    return;
  }

  if (
    event.key === "Escape" ||
    event.key === "n" ||
    event.key === "N"
  ) {
    event.preventDefault();
    event.stopPropagation();
    cancel();
    return;
  }

  if (
    !disabled &&
    (event.key === "Enter" || event.key === "y" || event.key === "Y")
  ) {
    event.preventDefault();
    event.stopPropagation();
    confirm();
  }
}
