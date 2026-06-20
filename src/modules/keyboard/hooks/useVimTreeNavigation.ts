import { useCallback, useEffect, useRef } from "react";
import {
  interpretVimListKey,
  normalizeVimKey,
} from "@/modules/keyboard/core/vimList";

export type VimTreeNavigationOptions = {
  enabled: boolean;

  itemIds: string[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;

  isDirectory: (id: string) => boolean;
  isExpanded: (id: string) => boolean;
  expand: (id: string) => void;
  collapse: (id: string) => void;
  parentOf: (id: string, rootPath: string) => string;
  rootPath: string;

  onActivate?: (id: string) => void;
  onSearch?: () => void;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  onRefresh?: () => void;

  isEventTargetIgnored?: (target: EventTarget | null) => boolean;
  scrollToId?: (id: string) => void;
};

function nativeEvent(e: KeyboardEvent | React.KeyboardEvent): KeyboardEvent {
  if (typeof KeyboardEvent !== "undefined" && e instanceof KeyboardEvent) {
    return e;
  }
  const ne = (e as React.KeyboardEvent).nativeEvent;
  return (ne ?? e) as unknown as KeyboardEvent;
}

function getTarget(e: KeyboardEvent | React.KeyboardEvent): HTMLElement | null {
  return (
    (e.target as HTMLElement | null) ??
    (typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null)
  );
}

export function useVimTreeNavigation(options: VimTreeNavigationOptions) {
  const {
    enabled,
    itemIds,
    selectedId,
    setSelectedId,
    isDirectory,
    isExpanded,
    expand,
    collapse,
    parentOf,
    rootPath,
    onActivate,
    onSearch,
    onCreateFile,
    onCreateFolder,
    onRefresh,
    isEventTargetIgnored,
    scrollToId,
  } = options;

  const pendingGRef = useRef<number | null>(null);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const onKeyDown = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent) => {
      if (isEventTargetIgnored?.(getTarget(e))) return;
      if (itemIds.length === 0) return;

      const currentIdx = selectedId ? itemIds.indexOf(selectedId) : -1;

      const move = (next: number) => {
        const clamped = Math.max(0, Math.min(itemIds.length - 1, next));
        setSelectedId(itemIds[clamped]);
        scrollToId?.(itemIds[clamped]);
      };

      if (enabled) {
        if (e.key === "/") {
          e.preventDefault();
          e.stopPropagation();
          onSearch?.();
          return;
        }

        if (e.key === "a") {
          e.preventDefault();
          e.stopPropagation();
          onCreateFile?.();
          return;
        }
        if (e.key === "A") {
          e.preventDefault();
          e.stopPropagation();
          onCreateFolder?.();
          return;
        }
        if (e.key === "R") {
          e.preventDefault();
          e.stopPropagation();
          onRefresh?.();
          return;
        }

        const action = interpretVimListKey(nativeEvent(e), pendingGRef);
        switch (action.kind) {
          case "next":
            e.preventDefault();
            e.stopPropagation();
            move(currentIdx < 0 ? 0 : currentIdx + 1);
            return;
          case "prev":
            e.preventDefault();
            e.stopPropagation();
            move(currentIdx < 0 ? itemIds.length - 1 : currentIdx - 1);
            return;
          case "first":
            e.preventDefault();
            e.stopPropagation();
            move(0);
            return;
          case "last":
            e.preventDefault();
            e.stopPropagation();
            move(itemIds.length - 1);
            return;
          case "activate": {
            if (!selectedId) return;
            e.preventDefault();
            e.stopPropagation();
            onActivate?.(selectedId);
            return;
          }
          case "escape":
          case "armG":
            break;
          case "none":
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            break;
        }
      }

      const key = enabled ? normalizeVimKey(e.key) : e.key;
      if (e.key === "/" || e.key === "a" || e.key === "A" || e.key === "R") {
        return;
      }
      switch (key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          move(currentIdx < 0 ? 0 : currentIdx + 1);
          return;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          move(currentIdx < 0 ? itemIds.length - 1 : currentIdx - 1);
          return;
        case "ArrowRight": {
          if (!selectedId) return;
          if (isDirectory(selectedId)) {
            e.preventDefault();
            e.stopPropagation();
            if (isExpanded(selectedId)) {
              move(currentIdx + 1);
            } else {
              expand(selectedId);
            }
          }
          return;
        }
        case "ArrowLeft": {
          if (!selectedId) return;
          if (isDirectory(selectedId) && isExpanded(selectedId)) {
            e.preventDefault();
            e.stopPropagation();
            collapse(selectedId);
          } else {
            const parent = parentOf(selectedId, rootPath);
            if (parent && parent !== selectedId) {
              e.preventDefault();
              e.stopPropagation();
              setSelectedId(parent);
              scrollToId?.(parent);
            }
          }
          return;
        }
        case "Enter": {
          if (!selectedId) return;
          e.preventDefault();
          e.stopPropagation();
          onActivate?.(selectedId);
          return;
        }
      }
    },
    [
      enabled,
      itemIds,
      selectedId,
      setSelectedId,
      isDirectory,
      isExpanded,
      expand,
      collapse,
      parentOf,
      rootPath,
      onActivate,
      onSearch,
      onCreateFile,
      onCreateFolder,
      onRefresh,
      isEventTargetIgnored,
      scrollToId,
    ],
  );

  const clearPendingG = useCallback(() => {
    if (pendingGRef.current) {
      window.clearTimeout(pendingGRef.current);
      pendingGRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPendingG();
    };
  }, [clearPendingG]);

  return { onKeyDown, clearPendingG };
}
