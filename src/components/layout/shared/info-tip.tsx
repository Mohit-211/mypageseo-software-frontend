import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** How the explanation opened: a preview (mouse hover, keyboard focus) or a press (click, tap, Enter, Space). */
type OpenedBy = "hover" | "focus" | "press";

/** Delay before a hover preview opens or closes, so passing over the icon doesn't flash it. */
const HOVER_DELAY = 150;

/**
 * A small "i" that explains a term. Tap or click it (or press Enter or Space) to open the
 * explanation; tap outside it, press Escape or press it again to close it, and focus goes back to
 * the icon. It works the same on phones and tablets, where a hover tooltip never opens. With a mouse
 * it also previews on hover, and with the keyboard on focus. The icon stays 14px so it sits in a
 * line of text; its hit area is 36px.
 */
export function InfoTip({ children, label = "What does this mean?", className }: { children: ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const openedBy = useRef<OpenedBy | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Focus goes back to the icon only when it was in the bubble (Escape), never after a preview.
  const restoreFocus = useRef(false);
  const returning = useRef(false);

  useEffect(() => {
    const pending = timer;
    return () => window.clearTimeout(pending.current);
  }, []);

  const show = (by: OpenedBy) => {
    window.clearTimeout(timer.current);
    openedBy.current = by;
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    restoreFocus.current = Boolean(content.current?.contains(document.activeElement));
    openedBy.current = null;
    setOpen(false);
  };
  const later = (action: () => void) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(action, HOVER_DELAY);
  };
  const leave = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && openedBy.current === "hover") later(hide);
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? show("press") : hide())}>
      <PopoverTrigger asChild>
        <button
          ref={trigger}
          type="button"
          aria-label={label}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            if (openedBy.current) window.clearTimeout(timer.current);
            else
              later(() => {
                if (!openedBy.current) show("hover");
              });
          }}
          onPointerLeave={leave}
          onFocus={(event) => {
            if (!returning.current && !openedBy.current && event.currentTarget.matches(":focus-visible")) show("focus");
          }}
          onClick={(event) => {
            // A preview is already showing: the press keeps it open and moves focus into it, so a
            // screen reader reads it (instead of toggling it shut).
            if (openedBy.current === "hover" || openedBy.current === "focus") {
              event.preventDefault();
              openedBy.current = "press";
              content.current?.focus();
            }
          }}
          className={cn(
            "relative inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-muted-foreground outline-hidden after:absolute after:-inset-2.5 after:content-[''] hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-[state=open]:text-primary",
            className,
          )}
        >
          <Info aria-hidden className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={content}
        aria-label={label}
        side="top"
        sideOffset={6}
        collisionPadding={12}
        onOpenAutoFocus={(event) => {
          // Previews leave focus where it is; a press moves it into the bubble.
          if (openedBy.current !== "press") event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!restoreFocus.current) return;
          restoreFocus.current = false;
          // Back on the icon without reopening the preview that keyboard focus would show.
          returning.current = true;
          trigger.current?.focus();
          returning.current = false;
        }}
        onPointerEnter={() => window.clearTimeout(timer.current)}
        onPointerLeave={leave}
        onKeyDown={(event) => {
          // Tab carries on from the icon's place in the page (the bubble has nothing to tab to).
          if (event.key === "Tab") trigger.current?.focus();
        }}
        className="w-auto max-w-[min(20rem,calc(100vw-2rem))] px-3 py-2.5 text-[13px] font-normal normal-case leading-relaxed tracking-normal text-popover-foreground"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** A label followed by its explanation tooltip. */
export function TermWithTip({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {term}
      <InfoTip label={`About ${typeof term === "string" ? term : "this"}`}>{children}</InfoTip>
    </span>
  );
}
