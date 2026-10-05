import type { ComponentType } from "react";
import { format, isAfter, isSameMonth } from "date-fns";
import { CalendarCheck2, CalendarRange, CheckCircle2, Hourglass } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiGbpPost } from "@/lib/gbp/ai-posts";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";

type SummaryCard = {
  label: string;
  value: number;
  caption: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  iconClassName: string;
};

export function PostsSummaryCards({ posts }: { posts: AiGbpPost[] }) {
  const now = new Date(useNow());
  const scheduled = posts
    .filter((p) => p.status === "scheduled" && p.scheduledAt && isAfter(new Date(p.scheduledAt), now))
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  const pending = posts.filter((p) => p.status === "pending_approval");
  const published = posts.filter((p) => p.status === "published");
  const thisMonth = posts.filter((p) => p.scheduledAt && isSameMonth(new Date(p.scheduledAt), now));
  const aiThisMonth = thisMonth.filter((p) => p.aiGenerated).length;

  const cards: SummaryCard[] = [
    {
      label: "Scheduled Posts",
      value: scheduled.length,
      caption: scheduled[0]?.scheduledAt
        ? `Next: ${format(new Date(scheduled[0].scheduledAt), "MMM d, h:mm a")}`
        : "Nothing queued yet",
      icon: CalendarCheck2,
      iconClassName: "bg-info-surface text-info",
    },
    {
      label: "Pending Approval",
      value: pending.length,
      caption: pending.length > 0 ? "Waiting for your review" : "You're all caught up",
      icon: Hourglass,
      iconClassName: "bg-warning-surface text-warning-foreground",
    },
    {
      label: "Published Posts",
      value: published.length,
      caption: "Live on Google Business Profile",
      icon: CheckCircle2,
      iconClassName: "bg-success-surface text-success",
    },
    {
      label: "Posts This Month",
      value: thisMonth.length,
      caption: `${aiThisMonth} AI-generated in ${format(now, "MMMM")}`,
      icon: CalendarRange,
      iconClassName: "bg-brand-tint text-primary",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", card.iconClassName)}>
              <card.icon className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-1 text-2xl font-semibold tabular text-foreground">{card.value.toLocaleString()}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{card.caption}</p>
        </div>
      ))}
    </div>
  );
}

export function PostsSummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="size-8 rounded-md" />
          </div>
          <Skeleton className="mt-1 h-7 w-12" />
          <Skeleton className="mt-2 h-3 w-36" />
        </div>
      ))}
    </div>
  );
}
