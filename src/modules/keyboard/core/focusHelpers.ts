/**
 * Shared focus helpers to eliminate duplicated requestAnimationFrame retry
 * patterns across the codebase.
 */

type FocusRetryOptions = {
  maxAttempts?: number;
  attemptInterval?: "frame" | number;
};

/**
 * Generic focus retry: calls `fn` on each frame until it returns true
 * or maxAttempts is reached. Replaces the inline `retryAnimationFrames`
 * pattern used in App.tsx.
 */
export function focusWithRetry(
  fn: () => boolean,
  options?: FocusRetryOptions,
): void {
  const maxAttempts = options?.maxAttempts ?? 30;
  let attempts = 0;
  const tick = () => {
    if (fn()) return;
    if (++attempts < maxAttempts) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Query a DOM element by selector, call .focus() on it, and retry
 * across animation frames if the element isn't mounted yet.
 * Replaces `focusSourceControlPanel` in targets.ts.
 */
export function focusElementBySelectorWithRetry(
  selector: string,
  options?: FocusRetryOptions & { verify?: boolean },
): void {
  const maxAttempts = options?.maxAttempts ?? 10;
  let attempts = 0;
  const tryFocus = () => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      el.focus();
      if (options?.verify !== false && document.activeElement === el) return;
      if (options?.verify === false) return;
    }
    if (++attempts < maxAttempts) requestAnimationFrame(tryFocus);
  };
  requestAnimationFrame(tryFocus);
}

/**
 * Focus the active editor by calling its handle's .focus() method,
 * then verify focus landed in a CodeMirror or data-editor element.
 * Replaces the 3 identical retry loops in App.tsx (setSwitcherOpen,
 * handleFileOpened, handleBufferActivate).
 */
export function focusEditorWithRetry(
  editorHandle: { focus: () => void } | null,
  options?: FocusRetryOptions,
): void {
  const maxAttempts = options?.maxAttempts ?? 15;
  let attempts = 0;
  const tryFocus = () => {
    editorHandle?.focus();
    const el = document.activeElement;
    if (
      el instanceof HTMLElement &&
      (el.closest(".cm-editor") || el.closest("[data-editor]"))
    )
      return;
    if (++attempts < maxAttempts) requestAnimationFrame(tryFocus);
  };
  requestAnimationFrame(tryFocus);
}
