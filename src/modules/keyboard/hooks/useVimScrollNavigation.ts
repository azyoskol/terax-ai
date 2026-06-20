import { useCallback, useEffect, useRef } from "react";
import { interpretVimListKey } from "@/modules/keyboard/core/vimList";
import { isEditableTarget } from "@/modules/keyboard/core/targets";

export type VimScrollNavigationOptions = {
  enabled: boolean;
  scrollRef: React.RefObject<HTMLElement | null>;
  step?: number;
  isEventTargetIgnored?: (target: EventTarget | null) => boolean;
};

export function useVimScrollNavigation(options: VimScrollNavigationOptions) {
  const { enabled, scrollRef, step = 60 } = options;

  const pendingGRef = useRef<number | null>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent) => {
      const target =
        (e.target as HTMLElement | null) ??
        (typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null);
      if (isEditableTarget(target)) return;
      if (options.isEventTargetIgnored?.(target)) return;

      const action = interpretVimListKey(
        "nativeEvent" in e ? (e as React.KeyboardEvent).nativeEvent : e,
        pendingGRef,
      );

      switch (action.kind) {
        case "next": {
          if (!enabled) break;
          e.preventDefault();
          e.stopPropagation();
          const el = scrollRef.current;
          if (el) el.scrollTop = Math.min(el.scrollTop + step, el.scrollHeight - el.clientHeight);
          return;
        }
        case "prev": {
          if (!enabled) break;
          e.preventDefault();
          e.stopPropagation();
          const el = scrollRef.current;
          if (el) el.scrollTop = Math.max(el.scrollTop - step, 0);
          return;
        }
        case "first": {
          if (!enabled) break;
          e.preventDefault();
          e.stopPropagation();
          const el = scrollRef.current;
          if (el) el.scrollTop = 0;
          return;
        }
        case "last": {
          if (!enabled) break;
          e.preventDefault();
          e.stopPropagation();
          const el = scrollRef.current;
          if (el) el.scrollTop = el.scrollHeight;
          return;
        }
        case "armG":
          break;
        case "none":
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          break;
        case "activate":
        case "escape":
          break;
      }
    },
    [enabled, scrollRef, step, options.isEventTargetIgnored],
  );

  const clearPendingG = useCallback(() => {
    if (pendingGRef.current) {
      window.clearTimeout(pendingGRef.current);
      pendingGRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearPendingG();
  }, [clearPendingG]);

  return { onKeyDown, clearPendingG };
}
