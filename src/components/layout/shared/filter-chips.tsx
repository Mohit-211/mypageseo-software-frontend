import { cn } from "@/lib/utils";

export type FilterChipOption<T extends string> = {
  id: T;
  label: string;
  /** Shown in a small pill; leave out while unknown. */
  count?: number | undefined;
  /** Colours the count when it is above zero and the chip isn't selected (zero always stays neutral). */
  attention?: "warning" | "critical" | undefined;
  /** Explains the view in a tooltip (e.g. what "Needs attention" counts). */
  title?: string | undefined;
};

/** On phones the row scrolls sideways: keep the selected chip visible in it (never scrolls the page). */
function showInRow(chip: HTMLElement | null) {
  const row = chip?.parentElement;
  if (!chip || !row || row.scrollWidth <= row.clientWidth) return;
  row.scrollLeft = Math.max(0, chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2);
}

/**
 * One-of-N filter chips with counts, for a list on the page ("All 16 · Published 8 · …"): Posts,
 * AI Posts, Reviews, AI Review Replies. They filter what the list shows; they are not navigation.
 * One look everywhere: the selected chip is solid teal (selection is interaction, so never violet,
 * even on AI pages); an unselected chip's count turns amber or red only when it needs attention.
 *
 * Each chip is a toggle button (`aria-pressed`) at least 36px tall with a visible focus ring. The
 * row wraps; on phones it scrolls sideways instead, bleeding into the 16px page gutter. Inside a
 * padded card, override the bleed through `className` (e.g. `max-sm:-mx-3 max-sm:w-[calc(100%+1.5rem)]
 * max-sm:px-3` for a `p-3` card). `value` may be null when no chip matches the list's filters.
 */
export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: readonly FilterChipOption<T>[];
  "aria-label": string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        // `relative` keeps the absolutely positioned sr-only text inside the scroll row (else it widens the page).
        "relative flex min-w-0 items-center gap-1.5 sm:flex-wrap",
        // Phones: one row that scrolls sideways inside the page gutter, instead of three rows of chips.
        "max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:py-1 max-sm:[scrollbar-width:none]",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.id === value;
        const hot = !active && option.attention && (option.count ?? 0) > 0;
        return (
          <button
            key={option.id}
            ref={active ? showInRow : undefined}
            type="button"
            aria-pressed={active}
            title={option.title}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-[color,background-color,border-color,box-shadow] outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                : "border-border-strong bg-card text-foreground hover:border-primary/40 hover:bg-accent",
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-xs font-semibold leading-5 tabular-nums",
                  // The darker teal keeps the white count >= 4.5:1 inside the selected chip.
                  active
                    ? "bg-primary-hover text-primary-foreground"
                    : hot && option.attention === "critical"
                      ? "bg-critical-surface text-critical"
                      : hot
                        ? "bg-warning-surface text-warning-foreground"
                        : "bg-muted text-muted-foreground",
                )}
              >
                {option.count.toLocaleString()}
                {hot ? <span className="sr-only"> need attention</span> : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
