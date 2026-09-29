import { Lightbulb } from "lucide-react";

/** Neutral, factual observations from the analysis. */
export function ReviewInsights({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Lightbulb className="size-4 text-primary" aria-hidden />
        Key observations
      </h3>
      <ul className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2">
        {insights.map((insight) => (
          <li key={insight} className="flex gap-2 text-sm text-foreground">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
            {insight}
          </li>
        ))}
      </ul>
    </div>
  );
}
