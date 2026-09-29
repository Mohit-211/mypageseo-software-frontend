import { ArrowRight } from "lucide-react";
import { SectionHeader } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AI_PLATFORM_LABEL, type AiPlatform, type PlatformStat } from "@/lib/ai-visibility/ai-visibility";
import { ChangeIndicator, PlatformIcon, VisibilityMeter } from "./visibility-ui";

export function PlatformVisibilityCard({ stat, onViewDetails }: { stat: PlatformStat; onViewDetails: () => void }) {
  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <PlatformIcon platform={stat.platform} />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{AI_PLATFORM_LABEL[stat.platform]}</h3>
          <p className="text-xs text-muted-foreground">{stat.prompts} prompts tracked</p>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">Visibility</p>
          <p className="text-2xl font-semibold tabular text-foreground">{stat.visibility}%</p>
        </div>
        <ChangeIndicator value={stat.change} />
      </div>
      <VisibilityMeter value={stat.visibility} className="mt-2" />

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Mentions</span>
        <span className="font-medium tabular text-foreground">{stat.mentions.toLocaleString()}</span>
      </div>

      <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onViewDetails}>
        View Details <ArrowRight aria-hidden />
      </Button>
    </article>
  );
}

export function PlatformVisibility({
  platforms,
  onViewDetails,
}: {
  platforms: PlatformStat[];
  onViewDetails: (platform: AiPlatform) => void;
}) {
  return (
    <section aria-label="AI Platform Visibility">
      <SectionHeader title="AI Platform Visibility" description="Latest visibility and mentions per assistant for the selected period." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {platforms.map((stat) => (
          <PlatformVisibilityCard key={stat.platform} stat={stat} onViewDetails={() => onViewDetails(stat.platform)} />
        ))}
      </div>
    </section>
  );
}

export function PlatformVisibilitySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="mt-4 h-7 w-16" />
          <Skeleton className="mt-2 h-1.5 w-full" />
          <Skeleton className="mt-4 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}
