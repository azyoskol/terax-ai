import { useEffect, useRef, useState } from "react";

export type TerminalPrefixActions = {
  focusDirectionalPaneInTab: (
    tabId: number,
    direction: "left" | "right" | "up" | "down",
  ) => void;
  focusExplorer: () => void;
  setBufferPickerOpen: (open: boolean) => void;
  setSwitcherOpen: (open: boolean) => void;
  cycleSidebarView: (view: "explorer" | "source-control") => void;
  stepSwitcher: (delta: 1 | -1) => void;
};

export type TerminalPrefixOptions = {
  enabled: boolean;
  activeTabId: number;
} & TerminalPrefixActions;

export function useTerminalPrefix(options: TerminalPrefixOptions): {
  terminalPrefixActive: boolean;
} {
  const { enabled, activeTabId } = options;

  const [terminalPrefixActive, setTerminalPrefixActive] = useState(false);
  const terminalPrefixRef = useRef(false);

  const actionsRef = useRef(options);
  actionsRef.current = options;

  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      const target =
        (e.target as HTMLElement | null) ?? document.activeElement;
      const inTerminal = !!(
        target as HTMLElement | null
      )?.closest?.(".xterm");

      if (
        e.ctrlKey &&
        e.code === "Space" &&
        !e.shiftKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        if (!inTerminal) return;
        e.preventDefault();
        e.stopPropagation();
        terminalPrefixRef.current = true;
        setTerminalPrefixActive(true);
        return;
      }

      if (terminalPrefixRef.current) {
        terminalPrefixRef.current = false;
        setTerminalPrefixActive(false);
        let handled = true;
        switch (e.key) {
          case "h":
            actionsRef.current.focusDirectionalPaneInTab(activeTabId, "left");
            break;
          case "l":
            actionsRef.current.focusDirectionalPaneInTab(activeTabId, "right");
            break;
          case "j":
            actionsRef.current.focusDirectionalPaneInTab(activeTabId, "down");
            break;
          case "k":
            actionsRef.current.focusDirectionalPaneInTab(activeTabId, "up");
            break;
          case "e":
            actionsRef.current.focusExplorer();
            break;
          case "b":
            actionsRef.current.setBufferPickerOpen(true);
            break;
          case "s":
            actionsRef.current.setSwitcherOpen(true);
            break;
          case "g":
            actionsRef.current.cycleSidebarView("source-control");
            requestAnimationFrame(() => {
              const sc = document.querySelector<HTMLElement>(
                "[data-source-control]",
              );
              sc?.focus();
            });
            break;
          case "t":
            actionsRef.current.stepSwitcher(1);
            break;
          case "T":
            actionsRef.current.stepSwitcher(-1);
            break;
          case "q":
          case "Escape":
            break;
          default:
            handled = false;
            break;
        }
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
    };

    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [enabled, activeTabId]);

  return { terminalPrefixActive };
}
