/**
 * Progress for AI reply work that answers in one go but can take a while: a drafts, "Draft all", Analyze request
 * ends its AI work within 75 s (2026-11-17), and a selection bigger than `ai.draft_all_max` goes in several
 * requests. The bar moves with the time spent on the request running now (it never claims to be done before the
 * answer comes) and with the requests already answered; the words say how many are done.
 */
import { LoaderCircle } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import type { ChunkProgress } from "@/lib/reviews/draft-results";
import { cn } from "@/lib/utils";

/** About how long one request takes; the bar slows down as it nears it, and never reaches the end on time alone. */
const TYPICAL_MS = 35_000;

/** How far the request running now probably is (0 to 0.9), from the time it has taken. */
function requestShare(elapsedMs: number): number {
  return 0.9 * (1 - Math.exp(-Math.max(0, elapsedMs) / TYPICAL_MS));
}

export function AiWorkProgress({
  progress,
  label,
  note = "Each batch can take up to a minute and a half. You can keep reading meanwhile.",
  className,
}: {
  progress: ChunkProgress;
  /** "Drafting replies", "Analyzing reviews". */
  label: string;
  note?: string | null;
  className?: string;
}) {
  const now = useNow(1000);
  const { done, total, current, startedAt } = progress;
  const share = total > 0 ? (done + current * requestShare(now - startedAt)) / total : 0;
  const percent = Math.round(Math.min(0.99, Math.max(0, share)) * 100);
  const words = total > 1 ? `${label}: ${done.toLocaleString()} of ${total.toLocaleString()} done` : `${label}…`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <LoaderCircle aria-hidden className="size-3.5 shrink-0 animate-spin text-ai motion-reduce:animate-none" />
        <span>
          {words}
          {note ? <span className="text-muted-foreground"> · {note}</span> : null}
        </span>
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={total > 1 ? `${done} of ${total} done` : undefined}
        className="h-1.5 w-full overflow-hidden rounded-full bg-ai/15"
      >
        <div className="h-full rounded-full bg-ai transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
