import { useCallback, useEffect, useRef } from "react";
import {
  interpretVimListKey,
  isPlainVimKey,
} from "@/modules/keyboard/core/vimList";

export type VimListNavigationOptions = {
  enabled: boolean;
  itemCount: number;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;

  onActivate?: (index: number) => void;
  onEscape?: () => void;

  isEventTargetIgnored?: (target: EventTarget | null) => boolean;

  mode?: "clamp" | "wrap";

  alwaysHandleActivateEscape?: boolean;

  onUnhandledPlainKey?: (
    event: KeyboardEvent,
    selectedIndex: number,
  ) => boolean;
};

export function useVimListNavigation(options: VimListNavigationOptions) {
  const {
    enabled,
    itemCount,
    selectedIndex,
    setSelectedIndex,
    onActivate,
    onEscape,
    isEventTargetIgnored,
    mode = "clamp",
    alwaysHandleActivateEscape = false,
    onUnhandledPlainKey,
  } = options;

  const pendingGRef = useRef<number | null>(null);
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target =
        (e.target as HTMLElement | null) ??
        (typeof document !== "undefined" ? document.activeElement : null);
      if (isEventTargetIgnored?.(target)) return;

      const action = interpretVimListKey(e, pendingGRef);
      const currentIndex = selectedIndexRef.current;

      switch (action.kind) {
        case "next": {
          if (!enabled) return;
          e.preventDefault();
          e.stopPropagation();
          if (itemCount === 0) return;
          setSelectedIndex((prev) =>
            mode === "wrap"
              ? (prev + 1) % itemCount
              : Math.min(prev + 1, itemCount - 1),
          );
          return;
        }
        case "prev": {
          if (!enabled) return;
          e.preventDefault();
          e.stopPropagation();
          if (itemCount === 0) return;
          setSelectedIndex((prev) =>
            mode === "wrap"
              ? (prev - 1 + itemCount) % itemCount
              : Math.max(prev - 1, 0),
          );
          return;
        }
        case "first": {
          if (!enabled) return;
          e.preventDefault();
          e.stopPropagation();
          if (itemCount === 0) return;
          setSelectedIndex(0);
          return;
        }
        case "last": {
          if (!enabled) return;
          e.preventDefault();
          e.stopPropagation();
          if (itemCount === 0) return;
          setSelectedIndex(itemCount - 1);
          return;
        }
        case "activate": {
          if (!enabled && !alwaysHandleActivateEscape) return;
          e.preventDefault();
          e.stopPropagation();
          onActivate?.(currentIndex);
          return;
        }
        case "escape": {
          if (!enabled && !alwaysHandleActivateEscape) return;
          e.preventDefault();
          e.stopPropagation();
          onEscape?.();
          return;
        }
        case "armG":
        case "none": {
          if (action.kind === "none" && isPlainVimKey(e)) {
            if (
              enabled &&
              onUnhandledPlainKey?.(e, currentIndex)
            ) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }
          return;
        }
      }
    },
    [
      enabled,
      itemCount,
      mode,
      alwaysHandleActivateEscape,
      onActivate,
      onEscape,
      isEventTargetIgnored,
      onUnhandledPlainKey,
      setSelectedIndex,
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
