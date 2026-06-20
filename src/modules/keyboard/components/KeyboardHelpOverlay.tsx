/**
 * Shared keyboard help overlay component.
 *
 * Renders a modal overlay showing keyboard shortcuts for a panel.
 * Can be driven by a static help list or by the surface registry's getHelp().
 */
import { Kbd } from "@/components/ui/kbd";

export type HelpItem = {
  key: string;
  description: string;
};

type KeyboardHelpOverlayProps = {
  title: string;
  items: HelpItem[];
  onClose: () => void;
};

export function KeyboardHelpOverlay({
  title,
  items,
  onClose,
}: KeyboardHelpOverlayProps) {
  return (
    <div
      role="button"
      tabIndex={-1}
      className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[13px] font-semibold text-foreground">
          {title}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11.5px]">
          {items.map((item) => (
            <span key={item.key} className="contents">
              <span className="text-muted-foreground">{item.description}</span>
              <span>
                <Kbd>{item.key}</Kbd>
              </span>
            </span>
          ))}
        </div>
        <button
          type="button"
          className="mt-1 self-center text-[11px] text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close
        </button>
      </div>
    </div>
  );
}
