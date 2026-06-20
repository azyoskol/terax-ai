export function normalizeVimKey(key: string): string {
  switch (key) {
    case "h":
      return "ArrowLeft";
    case "j":
      return "ArrowDown";
    case "k":
      return "ArrowUp";
    case "l":
      return "ArrowRight";
    default:
      return key;
  }
}

export const GG_TIMEOUT_MS = 800;

type KeyLike = { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean };

export function isPlainVimKey(e: KeyLike): boolean {
  return !e.ctrlKey && !e.altKey && !e.metaKey;
}

export function isPendingGKey(e: KeyLike): boolean {
  return isPlainVimKey(e) && e.key === "g";
}

export function isCapitalGKey(e: KeyLike): boolean {
  return !e.ctrlKey && !e.altKey && !e.metaKey && e.key === "G";
}

/** Check if a DOM target is an editable input/textarea/contentEditable. */
export function isEditableTarget(
  target: EventTarget | HTMLElement | null,
): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

/** Check if a DOM target is inside an xterm terminal. */
export function isTerminalTarget(
  target: EventTarget | HTMLElement | null,
): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return !!target.closest?.(".xterm");
}

export type VimListAction =
  | { kind: "next" }
  | { kind: "prev" }
  | { kind: "first" }
  | { kind: "last" }
  | { kind: "activate" }
  | { kind: "escape" }
  | { kind: "armG" }
  | { kind: "none" };

/**
 * Interpret a keyboard event as a vim list navigation action.
 *
 * Returns an action kind. The caller is responsible for:
 *  - calling `preventDefault()` / `stopPropagation()` if needed
 *  - clamping / applying the movement
 *
 * Manages the pending‑g ref internally — pass the same ref across calls.
 * Any non-`g` key clears the pending-g timeout before evaluating the action.
 */
export function interpretVimListKey(
  e: KeyboardEvent | React.KeyboardEvent,
  pendingGRef: React.MutableRefObject<number | null>,
): VimListAction {
  if (isPlainVimKey(e) && e.key === "g") {
    if (pendingGRef.current) {
      clearTimeout(pendingGRef.current);
      pendingGRef.current = null;
      return { kind: "first" };
    }
    pendingGRef.current = setTimeout(() => {
      pendingGRef.current = null;
    }, GG_TIMEOUT_MS) as unknown as number;
    return { kind: "armG" };
  }

  if (pendingGRef.current) {
    clearTimeout(pendingGRef.current);
    pendingGRef.current = null;
  }

  if (e.ctrlKey || e.altKey || e.metaKey) return { kind: "none" };

  if (isCapitalGKey(e)) return { kind: "last" };

  if (e.key === "Enter") return { kind: "activate" };
  if (e.key === "Escape") return { kind: "escape" };
  if (e.key === "j") return { kind: "next" };
  if (e.key === "k") return { kind: "prev" };

  return { kind: "none" };
}
