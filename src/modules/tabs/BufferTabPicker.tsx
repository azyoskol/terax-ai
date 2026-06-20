import { cn } from "@/lib/utils";
import { isEditableTarget } from "@/modules/keyboard/core/vimList";
import { useVimListNavigation } from "@/modules/keyboard/hooks/useVimListNavigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { labelFor } from "./lib/tabLabel";
import type { Tab } from "./lib/useTabs";
import { TabIcon } from "./TabBar";

type Props = {
  open: boolean;
  tabs: Tab[];
  activeId: number;
  onActivate: (tabId: number) => void;
  onClose: () => void;
};

function subtitleFor(tab: Tab): string | null {
  if (tab.kind === "terminal") {
    if (!tab.cwd) return null;
    const segs = tab.cwd.split(/[\\/]/).filter(Boolean);
    return segs.slice(-2).join("/") || tab.cwd;
  }
  if (tab.kind === "editor" || tab.kind === "markdown") {
    const segs = tab.path.split(/[\\/]/).filter(Boolean);
    return segs.slice(-2, -1)[0] ?? null;
  }
  return null;
}

export function BufferTabPicker({
  open,
  tabs,
  activeId,
  onActivate,
  onClose,
}: Props) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const idx = tabs.findIndex((t) => t.id === activeId);
      setIndex(idx >= 0 ? idx : 0);
    }
  }, [open, tabs, activeId]);

  const { onKeyDown, clearPendingG } = useVimListNavigation({
    enabled: true,
    itemCount: tabs.length,
    selectedIndex: index,
    setSelectedIndex: setIndex,
    onActivate: (i) => {
      const t = tabs[i];
      if (t) onActivate(t.id);
    },
    onEscape: onClose,
    isEventTargetIgnored: (target) => isEditableTarget(target),
  });

  useEffect(() => {
    if (!open || tabs.length === 0) return;
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      clearPendingG();
    };
  }, [open, tabs.length, onKeyDown, clearPendingG]);

  useEffect(() => {
    if (!open || tabs.length === 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-picker-index="${index}"]`,
    );
    if (el) {
      el.scrollIntoView({ block: "nearest" });
      el.focus({ preventScroll: true });
    } else {
      listRef.current?.focus();
    }
  }, [open, index, tabs.length]);

  const handleClick = useCallback(
    (tabId: number) => {
      onActivate(tabId);
    },
    [onActivate],
  );

  if (!open) return null;

  return (
    <div
      data-buffer-picker=""
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[50vh] w-80 flex-col rounded-2xl border border-border bg-popover/95 p-1.5 shadow-2xl ring-1 ring-foreground/5 backdrop-blur-md">
        <div
          ref={listRef}
          data-buffer-picker-list=""
          tabIndex={-1}
          className="-mx-0.5 max-h-[45vh] overflow-y-auto px-0.5 outline-none"
        >
          {tabs.map((t, i) => {
            const subtitle = subtitleFor(t);
            const isActive = t.id === activeId;
            const isSelected = i === index;
            return (
              <div
                key={t.id}
                data-picker-index={i}
                data-buffer-picker-item=""
                role="button"
                tabIndex={0}
                onClick={() => handleClick(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleClick(t.id);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs outline-none transition-colors",
                  isSelected && isActive
                    ? "bg-accent text-foreground ring-1 ring-inset ring-primary/30"
                    : isSelected
                      ? "bg-accent text-foreground"
                      : isActive
                        ? "bg-accent/50 text-foreground"
                        : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                )}
              >
                <TabIcon tab={t} />
                <span className="min-w-0 flex-1 truncate">
                  {labelFor(t)}
                </span>
                {subtitle && (
                  <span className="shrink-0 truncate text-[10px] text-muted-foreground/55">
                    {subtitle}
                  </span>
                )}
              </div>
            );
          })}
          {tabs.length === 0 && (
            <div className="px-2.5 py-3 text-center text-xs text-muted-foreground/50">
              No tabs
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
