import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PartialDataNotice } from "@/components/layout/shared/feedback/states";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  aiVisibilityActions,
  describeRange,
  rangeBounds,
  summarize,
  topicStats,
  useAiVisibilityStore,
  visibilityInsights,
  type AiPlatform,
  type DateRangeValue,
  type PlatformFilter,
  type TopicId,
} from "@/lib/ai-visibility/ai-visibility";
import { AIVisibilityHeader } from "./ai-visibility-header";
import { CompetitorComparison, CompetitorComparisonSkeleton } from "./competitor-comparison/competitor-comparison";
import { PlatformVisibility, PlatformVisibilitySkeleton } from "./platform-visibility";
import { DEFAULT_PROMPT_FILTERS, type PromptFilterState } from "./prompt-monitoring/prompt-filter-model";
import { PromptMonitoring, PromptMonitoringSkeleton } from "./prompt-monitoring/prompt-monitoring";
import { TopicVisibility, TopicVisibilitySkeleton } from "./topic-visibility";
import { VisibilityInsights, VisibilityInsightsSkeleton } from "./visibility-insights";
import { VisibilitySummaryCards, VisibilitySummaryCardsSkeleton } from "./visibility-summary-cards";
import { VisibilityTrend, VisibilityTrendSkeleton } from "./visibility-trend";

function scrollToPrompts() {
  // Wait a frame so filtered rows render before scrolling.
  requestAnimationFrame(() => document.getElementById("tracked-ai-prompts")?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

/** AI Visibility dashboard: overview → platforms → trend → prompts → competitors → topics → insights. */
export function AIVisibilityPage() {
  const { status, profiles, profile, dataset, analysisRunning } = useAiVisibilityStore();
  const [range, setRange] = useState<DateRangeValue>({ preset: "30d" });
  const [trendPlatform, setTrendPlatform] = useState<PlatformFilter>("all");
  const [promptFilters, setPromptFilters] = useState<PromptFilterState>(DEFAULT_PROMPT_FILTERS);

  const bounds = useMemo(() => rangeBounds(range), [range]);
  const summary = useMemo(() => (dataset ? summarize(dataset, bounds) : null), [dataset, bounds]);
  const topics = useMemo(() => (dataset ? topicStats(dataset) : []), [dataset]);
  const insights = useMemo(() => (dataset ? visibilityInsights(dataset, summary) : []), [dataset, summary]);

  const runAnalysis = async () => {
    toast.info("Analysis started", { description: "Re-checking every tracked prompt across all platforms." });
    const count = await aiVisibilityActions.runAnalysis();
    toast.success("Analysis complete", { description: `${count} prompt results were updated.` });
  };

  const showPlatformPrompts = (platform: AiPlatform) => {
    setPromptFilters({ ...DEFAULT_PROMPT_FILTERS, platform });
    scrollToPrompts();
  };

  const showTopicPrompts = (topic: TopicId) => {
    setPromptFilters({ ...DEFAULT_PROMPT_FILTERS, topic });
    scrollToPrompts();
  };

  const header = (
    <AIVisibilityHeader
      profiles={profiles}
      profileId={profile?.id ?? ""}
      onProfileChange={(id) => {
        aiVisibilityActions.setProfile(id);
        setPromptFilters(DEFAULT_PROMPT_FILTERS);
      }}
      range={range}
      onRangeChange={setRange}
      onRunAnalysis={() => void runAnalysis()}
      running={analysisRunning}
      disabled={status !== "ready" || (dataset?.prompts.length ?? 0) === 0}
    />
  );

  if (status === "loading" || !dataset || !profile) {
    return (
      <div className="space-y-6">
        {header}
        <div role="status" aria-live="polite" aria-label="Loading AI visibility" className="space-y-6">
          <VisibilitySummaryCardsSkeleton />
          <PlatformVisibilitySkeleton />
          <VisibilityTrendSkeleton />
          <PromptMonitoringSkeleton />
          <CompetitorComparisonSkeleton />
          <div className="grid gap-6 lg:grid-cols-2">
            <TopicVisibilitySkeleton />
            <VisibilityInsightsSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {header}

        <PartialDataNotice description="AI provider data isn't connected yet. Scores, prompts and AI responses on this page are sample data for preview." />

        {summary ? (
          <>
            <VisibilitySummaryCards summary={summary} rangeLabel={describeRange(range)} />
            <PlatformVisibility platforms={summary.platforms} onViewDetails={showPlatformPrompts} />
          </>
        ) : null}

        <VisibilityTrend
          history={dataset.history}
          bounds={bounds}
          range={range}
          onRangeChange={setRange}
          platform={trendPlatform}
          onPlatformChange={setTrendPlatform}
        />

        <PromptMonitoring dataset={dataset} businessName={profile.businessName} filters={promptFilters} onFiltersChange={setPromptFilters} />

        {summary ? <CompetitorComparison profile={profile} summary={summary} competitors={dataset.competitors} /> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <TopicVisibility topics={topics} onViewPrompts={showTopicPrompts} />
          <VisibilityInsights insights={insights} />
        </div>
      </div>
    </TooltipProvider>
  );
}
