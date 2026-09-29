import { BarChart3 } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { SectionSkeleton } from "@/components/layout/shared/feedback/states";

/** Factual observations computed from tracked results. Contains no advice. */
export function VisibilityInsights({ insights }: { insights: string[] }) {
  return (
    <Panel title="AI Visibility Insights" description="Observations from your latest tracked results">
      {insights.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Insights appear after the first prompt checks complete.</p>
      ) : (
        <ul className="space-y-3">
          {insights.map((insight) => (
            <li key={insight} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-tint text-primary">
                <BarChart3 className="size-3.5" aria-hidden />
              </span>
              <p className="text-sm leading-relaxed text-foreground">{insight}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function VisibilityInsightsSkeleton() {
  return <SectionSkeleton lines={4} />;
}
