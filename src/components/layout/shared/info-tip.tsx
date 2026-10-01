import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** A small "i" that explains a term on hover or keyboard focus. */
export function InfoTip({ children, label = "What does this mean?", className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", className)}
        >
          <Info aria-hidden className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed font-normal normal-case tracking-normal">{children}</TooltipContent>
    </Tooltip>
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
