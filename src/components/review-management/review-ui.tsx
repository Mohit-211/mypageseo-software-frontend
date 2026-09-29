import { AlertTriangle, Loader2, Star } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/data-display";
import {
  RESPONSE_STATUS_LABEL,
  RESPONSE_STATUS_TONE,
  SENTIMENT_COLOR,
  SENTIMENT_LABEL,
  SENTIMENT_TONE,
  TOPIC_LABEL,
  type ResponseStatus,
  type ReviewSentiment,
  type ReviewTopic,
} from "@/lib/reviews/review-management";
import { cn } from "@/lib/utils";

export function StarRating({ rating, size = "sm", className }: { rating: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const iconSize = size === "lg" ? "size-5" : size === "md" ? "size-4" : "size-3.5";
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(iconSize, i < Math.round(rating) ? "fill-warning text-warning" : "fill-muted text-border")}
        />
      ))}
    </span>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: ReviewSentiment | null }) {
  if (!sentiment) return <span className="text-xs text-muted-foreground">Not analyzed</span>;
  return <StatusBadge tone={SENTIMENT_TONE[sentiment]}>{SENTIMENT_LABEL[sentiment]}</StatusBadge>;
}

export function SentimentDot({ sentiment, className }: { sentiment: ReviewSentiment; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: SENTIMENT_COLOR[sentiment] }} />;
}

export function ResponseStatusBadge({ status, busy }: { status: ResponseStatus; busy?: boolean }) {
  return (
    <StatusBadge tone={RESPONSE_STATUS_TONE[status]} className="whitespace-nowrap">
      {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
      {RESPONSE_STATUS_LABEL[status]}
    </StatusBadge>
  );
}

export function TopicChips({ topics, max = 3, className }: { topics: ReviewTopic[]; max?: number; className?: string }) {
  if (topics.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = topics.slice(0, max);
  const hidden = topics.length - shown.length;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((topic) => (
        <span key={topic} className="rounded-md border border-border bg-surface-strong px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
          {TOPIC_LABEL[topic]}
        </span>
      ))}
      {hidden > 0 ? (
        <span className="px-1 py-0.5 text-[11px] text-muted-foreground" title={topics.slice(max).map((t) => TOPIC_LABEL[t]).join(", ")}>
          +{hidden}
        </span>
      ) : null}
    </span>
  );
}

export function CustomerAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-primary", className)}>
      {initials}
    </span>
  );
}

/** Marks replies that must be approved by a person before they are published. */
export function ApprovalRequiredBadge() {
  return (
    <StatusBadge tone="warning" className="whitespace-nowrap">
      <AlertTriangle className="size-3" aria-hidden />
      Approval Required
    </StatusBadge>
  );
}
