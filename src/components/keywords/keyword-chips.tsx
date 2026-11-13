import { X } from "lucide-react";
import { KEYWORD_USAGE } from "@/lib/keywords/usage-rules";
import { cn } from "@/lib/utils";

/**
 * An editable keyword list as numbered chips (the setup wizard's draft). The number is the
 * keyword's place in the list, which is also the order AI uses them in; the first ones are marked.
 */
export function KeywordChipList({
  keywords,
  onRemove,
  disabled = false,
  className,
}: {
  keywords: readonly string[];
  onRemove: (keyword: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap gap-2", className)} aria-label="Your keywords">
      {keywords.map((keyword, index) => {
        const first = index < KEYWORD_USAGE.postDefaultCount;
        return (
          <li
            key={keyword}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1 text-sm font-medium text-foreground shadow-xs",
              first ? "border-chart-3/40 bg-chart-3/8" : "border-border bg-card",
            )}
          >
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                first ? "bg-chart-3 text-white" : "bg-muted text-muted-foreground",
              )}
              title={first ? "AI posts use your first 2 keywords by default" : `#${index + 1} in your order`}
            >
              {index + 1}
            </span>
            <span className="max-w-[16rem] truncate">{keyword}</span>
            <button
              type="button"
              aria-label={`Remove ${keyword}`}
              disabled={disabled}
              onClick={() => onRemove(keyword)}
              className="relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground outline-hidden transition-colors after:absolute after:-inset-1 after:content-[''] hover:bg-critical-surface hover:text-critical focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
