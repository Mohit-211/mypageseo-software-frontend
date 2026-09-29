import { CheckCircle2, Loader2, MessageSquareText, RefreshCw, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";

export function NoReviewsEmpty({ onSync, syncing, className }: { onSync: () => void; syncing: boolean; className?: string }) {
  return (
    <EmptyState
      icon={MessageSquareText}
      title="Your reviews will appear here"
      description="Sync your Google Business Profile reviews to start analyzing and responding."
      action={
        <Button onClick={onSync} disabled={syncing}>
          {syncing ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
          {syncing ? "Syncing reviews…" : "Sync Reviews"}
        </Button>
      }
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function AllCaughtUpEmpty({ className }: { className?: string }) {
  return (
    <EmptyState
      compact
      icon={CheckCircle2}
      title="You're all caught up"
      description="No reviews currently need a response."
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function NoAnalysisEmpty({ onAnalyze, analyzing, className }: { onAnalyze: () => void; analyzing: boolean; className?: string }) {
  return (
    <EmptyState
      compact
      icon={Sparkles}
      title="No AI analysis yet"
      description="Analyze your reviews to discover sentiment, topics and trends."
      action={
        <Button onClick={onAnalyze} disabled={analyzing}>
          {analyzing ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {analyzing ? "Analyzing reviews…" : "Analyze Reviews"}
        </Button>
      }
      {...(className === undefined ? {} : { className })}
    />
  );
}
