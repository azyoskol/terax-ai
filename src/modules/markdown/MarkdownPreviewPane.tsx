import { MarkdownCode } from "@/components/ai-elements/markdown-code";
import { cn } from "@/lib/utils";
import { currentWorkspaceEnv } from "@/modules/workspace";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { MarkdownViewToggle } from "./MarkdownViewToggle";
import { useVimScrollNavigation } from "@/modules/keyboard/hooks/useVimScrollNavigation";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { isEditableTarget } from "@/modules/keyboard/core/targets";

type ReadResult =
  | { kind: "text"; content: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "toolarge"; size: number; limit: number };

type Status =
  | { kind: "loading" }
  | { kind: "ready"; content: string }
  | { kind: "binary" }
  | { kind: "toolarge"; size: number; limit: number }
  | { kind: "error"; message: string };

type Props = {
  path: string;
  visible: boolean;
  tabId: number;
  onSetView: (mode: "rendered" | "raw") => void;
};

const components = { code: MarkdownCode };

export function MarkdownPreviewPane({ path, visible, tabId, onSetView }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const scrollRef = useRef<HTMLDivElement>(null);
  const vimNavigationEnabled = usePreferencesStore((s) => s.vimNavigationEnabled);

  const { onKeyDown } = useVimScrollNavigation({
    enabled: vimNavigationEnabled,
    scrollRef,
    step: 60,
  });

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });
    invoke<ReadResult>("fs_read_file", {
      path,
      workspace: currentWorkspaceEnv(),
    })
      .then((res) => {
        if (cancelled) return;
        if (res.kind === "text") {
          setStatus({ kind: "ready", content: res.content });
        } else if (res.kind === "binary") {
          setStatus({ kind: "binary" });
        } else {
          setStatus({ kind: "toolarge", size: res.size, limit: res.limit });
        }
      })
      .catch((e) => {
        if (!cancelled) setStatus({ kind: "error", message: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => scrollRef.current?.focus());
    }
  }, [visible]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown(e.nativeEvent);

    if (e.key === "e" || e.key === "i" || e.key === "Enter") {
      if (!isEditableTarget(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        onSetView("raw");
      }
    }
  };

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-md border border-border/60 bg-background",
        !visible && "pointer-events-none",
      )}
    >
      <MarkdownViewToggle mode="rendered" onChange={onSetView} />
      <div
        ref={scrollRef}
        tabIndex={0}
        className="flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
        data-markdown-preview
        data-tab-id={tabId}
        onKeyDown={handleKeyDown}
      >
        <div className="px-8 py-6">
          {status.kind === "loading" && (
            <p className="text-[12px] text-muted-foreground">Loading…</p>
          )}
          {status.kind === "error" && (
            <p className="text-[12px] text-destructive">
              Failed to read file: {status.message}
            </p>
          )}
          {status.kind === "binary" && (
            <p className="text-[12px] text-muted-foreground">
              Binary file — cannot render as markdown.
            </p>
          )}
          {status.kind === "toolarge" && (
            <p className="text-[12px] text-muted-foreground">
              File is {status.size} bytes; limit {status.limit}.
            </p>
          )}
          {status.kind === "ready" && (
            <Streamdown
              className="select-text [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              components={components}
            >
              {status.content}
            </Streamdown>
          )}
        </div>
      </div>
    </div>
  );
}
