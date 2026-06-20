import { focusElementBySelectorWithRetry } from "./focusHelpers";

/** Check if a DOM target is an editable input/textarea/contentEditable. */
export function isEditableTarget(
  target: EventTarget | HTMLElement | null,
): boolean {
  if (
    !target ||
    typeof HTMLElement === "undefined" ||
    !(target instanceof HTMLElement)
  )
    return false;
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
  if (
    !target ||
    typeof HTMLElement === "undefined" ||
    !(target instanceof HTMLElement)
  )
    return false;
  return !!target.closest?.(".xterm");
}

/** Check if a DOM target is inside the file explorer tree. */
export function isInExplorer(
  target: EventTarget | HTMLElement | null,
): boolean {
  return !!(target as HTMLElement | null)?.closest?.("[data-file-explorer]");
}

/** Check if a DOM target is inside the explorer search input. */
export function isInExplorerSearch(
  target: EventTarget | HTMLElement | null,
): boolean {
  return !!(target as HTMLElement | null)?.closest?.(
    "[data-file-explorer-search]",
  );
}

/** Check if a DOM target is inside explorer search results. */
export function isInExplorerSearchResults(
  target: EventTarget | HTMLElement | null,
): boolean {
  return !!(target as HTMLElement | null)?.closest?.(
    "[data-file-explorer-search-results]",
  );
}

/** Check if a DOM target is inside the source control panel. */
export function isInSourceControl(
  target: EventTarget | HTMLElement | null,
): boolean {
  return !!(target as HTMLElement | null)?.closest?.("[data-source-control]");
}

/**
 * Focus the source control panel after opening it from a keyboard shortcut.
 * Retries across several animation frames in case the panel isn't mounted yet.
 */
export function focusSourceControlPanel(): void {
  focusElementBySelectorWithRetry("[data-source-control]");
}
