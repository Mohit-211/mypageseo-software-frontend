import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { ListSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { TOPIC_LABEL, type TopicId, type TopicStat } from "@/lib/ai-visibility/ai-visibility";
import { ChangeIndicator, VisibilityMeter } from "./visibility-ui";

export function TopicVisibility({ topics, onViewPrompts }: { topics: TopicStat[]; onViewPrompts: (topic: TopicId) => void }) {
  return (
    <Panel title="Visibility by Topic" description="Average visibility of the latest checks, grouped by prompt category">
      {topics.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Topics appear once prompts are tracked.</p>
      ) : (
        <ul className="-my-2 divide-y divide-border">
          {topics.map((t) => (
            <li key={t.topic} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{TOPIC_LABEL[t.topic]}</p>
                <p className="text-xs text-muted-foreground">
                  {t.prompts} prompt{t.prompts === 1 ? "" : "s"} · {t.mentions} mention{t.mentions === 1 ? "" : "s"}
                </p>
              </div>
              <div className="order-last col-span-2 flex items-center gap-3 sm:order-none sm:col-span-1">
                <span className="w-10 text-sm font-semibold tabular text-foreground">{t.visibility === null ? "—" : `${t.visibility}%`}</span>
                <VisibilityMeter value={t.visibility ?? 0} className="flex-1" />
                <ChangeIndicator value={t.change} className="w-14 justify-end" />
              </div>
              <Button variant="ghost" size="sm" className="justify-self-end text-xs" onClick={() => onViewPrompts(t.topic)}>
                View Prompts <ArrowRight aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function TopicVisibilitySkeleton() {
  return <ListSkeleton rows={5} />;
}
