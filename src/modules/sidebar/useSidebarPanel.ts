import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import type { LastSidebarSurface, SidebarViewId } from "./types";

export const SIDEBAR_DEFAULT_WIDTH = 260;
export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_WIDTH_STORAGE_KEY = "terax.sidebar.width";
const SIDEBAR_VIEW_STORAGE_KEY = "terax.sidebar.view";

function clampSidebarWidth(width: number): number {
  return Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)),
  );
}

function readSidebarWidth(): number {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    const parsed = stored ? Number.parseInt(stored, 10) : NaN;
    return Number.isFinite(parsed)
      ? clampSidebarWidth(parsed)
      : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function readSidebarView(): SidebarViewId {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_VIEW_STORAGE_KEY);
    if (stored === "explorer" || stored === "source-control") return stored;
  } catch {
    // ignore
  }
  return "explorer";
}

type FocusableExplorer = {
  focus: () => void;
  focusBestSurface: () => void;
  isFocused: () => boolean;
};

export function useSidebarPanel(
  explorerRef: RefObject<FocusableExplorer | null>,
) {
  const sidebarRef = useRef<PanelImperativeHandle | null>(null);
  const sidebarWidthRef = useRef(readSidebarWidth());
  const sidebarWidthWriteTimerRef = useRef(0);
  const explorerReturnFocusRef = useRef<HTMLElement | null>(null);
  const lastSidebarSurfaceRef = useRef<LastSidebarSurface | null>(null);
  const [sidebarView, setSidebarViewState] =
    useState<SidebarViewId>(readSidebarView);

  const persistSidebarView = useCallback((view: SidebarViewId) => {
    setSidebarViewState(view);
    if (view === "source-control") {
      lastSidebarSurfaceRef.current = "sourceControlChanges";
    } else {
      lastSidebarSurfaceRef.current = "explorerTree";
    }
    try {
      window.localStorage.setItem(SIDEBAR_VIEW_STORAGE_KEY, view);
    } catch {
      // storage may fail in private mode
    }
  }, []);

  const setLastSidebarSurface = useCallback((surface: LastSidebarSurface) => {
    lastSidebarSurfaceRef.current = surface;
  }, []);

  const toggleSidebar = useCallback(() => {
    const p = sidebarRef.current;
    if (!p) return;
    if (p.getSize().asPercentage <= 0) p.expand();
    else p.collapse();
  }, []);

  const cycleSidebarView = useCallback(
    (view: SidebarViewId) => {
      const panel = sidebarRef.current;
      const collapsed = panel ? panel.getSize().asPercentage <= 0 : false;
      if (collapsed) {
        if (panel) panel.resize(`${sidebarWidthRef.current}px`);
        if (view !== sidebarView) persistSidebarView(view);
        return;
      }
      if (view === sidebarView) {
        panel?.collapse();
        return;
      }
      persistSidebarView(view);
    },
    [persistSidebarView, sidebarView],
  );

  const persistSidebarWidth = useCallback((next: number) => {
    sidebarWidthRef.current = next;
    if (sidebarWidthWriteTimerRef.current) {
      window.clearTimeout(sidebarWidthWriteTimerRef.current);
    }
    sidebarWidthWriteTimerRef.current = window.setTimeout(() => {
      sidebarWidthWriteTimerRef.current = 0;
      try {
        window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      if (sidebarWidthWriteTimerRef.current) {
        window.clearTimeout(sidebarWidthWriteTimerRef.current);
      }
    };
  }, []);

  const toggleExplorerFocus = useCallback(() => {
    const explorer = explorerRef.current;
    const panel = sidebarRef.current;
    const collapsed = panel ? panel.getSize().asPercentage <= 0 : false;
    if (sidebarView !== "explorer" || collapsed) {
      if (panel && collapsed) panel.resize(`${sidebarWidthRef.current}px`);
      if (sidebarView !== "explorer") persistSidebarView("explorer");
      const active = document.activeElement;
      explorerReturnFocusRef.current =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null;
      requestAnimationFrame(() => explorerRef.current?.focus());
      return;
    }
    if (!explorer) return;
    if (explorer.isFocused()) {
      const target = explorerReturnFocusRef.current;
      explorerReturnFocusRef.current = null;
      if (target && document.body.contains(target)) {
        target.focus();
      } else {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      return;
    }
    const active = document.activeElement;
    explorerReturnFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    explorer.focus();
  }, [explorerRef, persistSidebarView, sidebarView]);

  const focusExplorer = useCallback(() => {
    const panel = sidebarRef.current;
    const collapsed = panel ? panel.getSize().asPercentage <= 0 : false;
    const active = document.activeElement;
    explorerReturnFocusRef.current =
      active instanceof HTMLElement && active !== document.body
        ? active
        : null;
    if (collapsed) {
      panel?.resize(`${sidebarWidthRef.current}px`);
    }
    if (active instanceof HTMLElement) {
      if (active.closest?.("[data-source-control]")) {
        lastSidebarSurfaceRef.current = "sourceControlChanges";
      } else if (active.closest?.("[data-file-explorer-search-results]")) {
        lastSidebarSurfaceRef.current = "explorerSearchResults";
      } else if (active.closest?.("[data-file-explorer-search]")) {
        lastSidebarSurfaceRef.current = "explorerSearch";
      } else if (active.closest?.("[data-file-explorer]")) {
        lastSidebarSurfaceRef.current = "explorerTree";
      }
    }
    const last = lastSidebarSurfaceRef.current;
    if (last === "sourceControlChanges") {
      const scmContainer = document.querySelector<HTMLElement>(
        "[data-source-control]",
      );
      if (scmContainer) {
        if (sidebarView !== "source-control") {
          persistSidebarView("source-control");
        }
        requestAnimationFrame(() => {
          scmContainer.focus();
          const changesList = scmContainer.querySelector<HTMLElement>(
            "[data-source-control-changes]",
          );
          changesList?.focus();
        });
        return;
      }
    }
    if (last === "explorerSearchResults") {
      if (sidebarView !== "explorer") {
        persistSidebarView("explorer");
      }
      requestAnimationFrame(() => {
        const results = document.querySelector<HTMLElement>(
          "[data-file-explorer-search-results]",
        );
        if (results) {
          results.focus();
        } else {
          explorerRef.current?.focusBestSurface();
        }
      });
      return;
    }
    if (last === "explorerSearch") {
      if (sidebarView !== "explorer") {
        persistSidebarView("explorer");
      }
      requestAnimationFrame(() => {
        const searchInput = document.querySelector<HTMLElement>(
          "[data-file-explorer-search]",
        );
        if (searchInput) {
          searchInput.focus();
        } else {
          explorerRef.current?.focusBestSurface();
        }
      });
      return;
    }
    if (sidebarView !== "explorer") {
      persistSidebarView("explorer");
      requestAnimationFrame(() => explorerRef.current?.focusBestSurface());
      return;
    }
    explorerRef.current?.focusBestSurface();
  }, [explorerRef, persistSidebarView, sidebarView]);

  const restoreEditorFocus = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      if (active.closest?.("[data-source-control]")) {
        lastSidebarSurfaceRef.current = "sourceControlChanges";
      } else if (active.closest?.("[data-file-explorer-search-results]")) {
        lastSidebarSurfaceRef.current = "explorerSearchResults";
      } else if (active.closest?.("[data-file-explorer-search]")) {
        lastSidebarSurfaceRef.current = "explorerSearch";
      } else if (active.closest?.("[data-file-explorer]")) {
        lastSidebarSurfaceRef.current = "explorerTree";
      }
    }
    const target = explorerReturnFocusRef.current;
    explorerReturnFocusRef.current = null;
    if (target?.isConnected) {
      target.focus();
      return;
    }
    const workspace = document.getElementById("workspace");
    const diffView = workspace?.querySelector<HTMLElement>(
      "[data-source-control-diff]",
    );
    if (diffView) {
      diffView.focus();
      return;
    }
    const markdownPreview = workspace?.querySelector<HTMLElement>(
      "[data-markdown-preview]",
    );
    if (markdownPreview) {
      markdownPreview.focus();
      return;
    }
    const cmEditor = workspace?.querySelector<HTMLElement>(".cm-editor");
    if (cmEditor) {
      cmEditor.focus();
      return;
    }
    const focusable = workspace?.querySelector<HTMLElement>(
      "[data-editor], [tabindex]",
    );
    focusable?.focus();
  }, []);

  return {
    sidebarRef,
    sidebarWidthRef,
    sidebarView,
    persistSidebarView,
    setLastSidebarSurface,
    toggleSidebar,
    cycleSidebarView,
    persistSidebarWidth,
    toggleExplorerFocus,
    focusExplorer,
    restoreEditorFocus,
  };
}
