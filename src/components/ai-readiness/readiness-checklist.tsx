import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, ChevronDown, CircleCheck, CircleDashed, ListChecks } from "lucide-react";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { readinessCount, readinessRows, type ReadinessRow } from "@/lib/ai-readiness/readiness";
import { useAiReadiness } from "@/lib/ai-readiness/use-readiness";
import { cn } from "@/lib/utils";

/**
 * "Get the AI ready · N of M done" (`GET …/ai/readiness`): what the location still lacks for the AI to write
 * specifically (the business brief, the owner's facts, the reply signature, the logo, library photos), at the top of
 * AI Studio and on AI Settings. Only the available checks show; what to do next comes first, each row linking to its
 * screen. Once every check is done it folds into one line ("The AI is ready"), with the list a click away. Nothing
 * shows when the checklist can't be read.
 */
export function ReadinessChecklist({
  locationId,
  locationName,
  canEdit,
  className,
}: {
  locationId: string;
  /** The location's name, for the signature's example ("The team at Harbor Dental"). */
  locationName?: string;
  canEdit: boolean;
  className?: string;
}) {
  const readiness = useAiReadiness(locationId);
  const titleId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);

  if (readiness.isPending) {
    return (
      <div role="status" aria-label="Loading the AI checklist" className={cn("rounded-xl border border-border bg-card p-4 shadow-card sm:p-5", className)}>
        <Skeleton className="h-5 w-56" />
        <Skeleton className="mt-3 h-2 w-full max-w-sm" />
      </div>
    );
  }
  const data = readiness.data;
  if (!data) return null;
  const { done, total } = readinessCount(data);
  if (total === 0) return null;
  const rows = readinessRows(data, locationId, canEdit, locationName);
  const ready = data.ready || done >= total;
  const showRows = !ready || open;
  const percent = Math.round((done / total) * 100);

  return (
    <section aria-labelledby={titleId} className={cn("min-w-0 rounded-xl border border-border bg-card shadow-card", className)}>
      <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3.5 sm:px-5", showRows && "border-b border-border")}>
        <div className="flex min-w-0 flex-[1_1_20rem] items-start gap-3">
          <IconChip icon={ready ? BadgeCheck : ListChecks} tone="ai" size="sm" className="-mt-0.5" />
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-semibold leading-6 text-foreground">
              {ready ? "The AI is ready" : "Get the AI ready"}
              <span className="font-medium text-muted-foreground"> · {ready ? `all ${total} done` : `${done} of ${total} done`}</span>
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {ready
                ? "It knows your business well enough to write specific posts and replies."
                : "The more the AI knows about your business, the more specific its posts and replies."}
            </p>
          </div>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <Progress value={percent} aria-label={`${done} of ${total} done`} className="h-2 w-full bg-ai/15 sm:w-40 [&>div]:bg-ai" />
          {ready ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((value) => !value)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              {open ? "Hide" : "Show"} <ChevronDown aria-hidden className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")} />
            </Button>
          ) : null}
        </div>
      </div>
      {showRows ? (
        <ol id={listId} className="divide-y divide-border">
          {rows.map((row) => (
            <ReadinessItem key={row.key} row={row} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ReadinessItem({ row }: { row: ReadinessRow }) {
  const Icon = row.done ? CircleCheck : CircleDashed;
  return (
    <li className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5", row.next && "bg-ai-surface/50")}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", row.done ? "text-success" : "text-muted-foreground")} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
            {row.title}
            <span className="sr-only">{row.done ? " (done)" : " (not done yet)"}</span>
            {row.next ? (
              <StatusBadge tone="ai" size="sm">
                Up next
              </StatusBadge>
            ) : null}
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{row.detail}</p>
        </div>
      </div>
      <div className="pl-8 sm:pl-0">
        {row.next ? (
          <Button asChild variant="outline" size="sm">
            <Link to={row.to}>
              {row.action} <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Link
            to={row.to}
            className="inline-flex min-h-9 items-center gap-1 rounded-md text-sm font-semibold text-primary underline-offset-4 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {row.action}
            <span className="sr-only">: {row.title}</span>
          </Link>
        )}
      </div>
    </li>
  );
}
