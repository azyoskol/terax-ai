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
