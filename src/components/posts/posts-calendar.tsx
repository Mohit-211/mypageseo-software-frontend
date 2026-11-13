import { useMemo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Sparkles, type LucideIcon } from "lucide-react";
import type { CalendarItem, PostStatus } from "@/api";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { STATUS_TONE_CLASSES } from "@/components/layout/shared/module-tone";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { formatTime } from "@/lib/datetime";
import { sortCalendarItems } from "@/lib/posts/post-order";
import { STATUS_ICON, STATUS_LABEL, STATUS_TONE } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A coloured edge and wash per status. Colour is never the only sign: each entry also starts with
// the status icon (the legend maps icon to status) and says its status to screen readers.
const ENTRY_CLASS: Record<PostStatus, string> = {
  published: "border-l-success bg-success-surface",
  scheduled: "border-l-info bg-info-surface",
  publishing: "border-l-info bg-info-surface",
  pending_approval: "border-l-warning bg-warning-surface",
  failed: "border-l-critical bg-critical-surface",
  rejected: "border-l-critical bg-critical-surface",
  draft: "border-l-border-strong bg-muted",
};

// A post being published shows as scheduled (the legend has no separate "Publishing" entry).
const ENTRY_ICON: Record<PostStatus, LucideIcon> = { ...STATUS_ICON, publishing: STATUS_ICON.scheduled };

const statusIconClass = (status: PostStatus) => STATUS_TONE_CLASSES[STATUS_TONE[status]].text;

const LEGEND: { label: string; status: PostStatus }[] = [
  { label: "Published", status: "published" },
  { label: "Scheduled", status: "scheduled" },
  { label: "Waiting for approval", status: "pending_approval" },
  { label: "Didn't publish", status: "failed" },
];

const MONTH_LABEL = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const PHONE_DAY = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short" });

/**
 * Month grid of dated posts (published, scheduled, waiting, failed; drafts have no date). Each day
 * lists its posts in time order. Phones get a list of the days that have posts instead of a grid.
 * `showLocation` for the organization calendar.
 */
export function PostsCalendar({
  month,
  onShift,
  onToday,
  items,
  loading,
  showLocation = false,
  onOpen,
  emptyAction,
}: {
  month: Date;
  onShift: (delta: number) => void;
  /** Back to the current month (shown when another month is open). */
  onToday?: () => void;
  items: CalendarItem[] | undefined;
  loading: boolean;
  showLocation?: boolean;
  onOpen?: (item: CalendarItem) => void;
  /** Offered when the month has no posts (e.g. "New post"). */
  emptyAction?: ReactNode;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of sortCalendarItems(items ?? [])) {
      const key = dayKey(new Date(item.date));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  // Weeks start on Monday; the last row is padded so the grid stays rectangular.
  const lead = (first.getDay() + 6) % 7;
  const trail = (7 - ((lead + daysInMonth) % 7)) % 7;
  const cells: (Date | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
    ...Array<null>(trail).fill(null),
  ];
  const now = useNow();
  const today = new Date(now);
  const todayKey = dayKey(today);
  const isCurrentMonth = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();
  const daysWithPosts = cells.filter((date): date is Date => Boolean(date && byDay.get(dayKey(date))?.length));
  const empty = !loading && (items?.length ?? 0) === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="size-9" aria-label="Previous month" onClick={() => onShift(-1)}>
            <ChevronLeft aria-hidden />
          </Button>
          <p className="min-w-36 text-center text-base font-semibold text-foreground" aria-live="polite">
            {MONTH_LABEL.format(month)}
          </p>
          <Button size="icon" variant="outline" className="size-9" aria-label="Next month" onClick={() => onShift(1)}>
            <ChevronRight aria-hidden />
          </Button>
          {onToday && !isCurrentMonth ? (
            <Button size="sm" variant="ghost" onClick={onToday}>
              This month
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Calendar key">
          {LEGEND.map((entry) => {
            const Icon = ENTRY_ICON[entry.status];
            return (
              <li key={entry.label} className="inline-flex items-center gap-1.5">
                <Icon aria-hidden className={cn("size-3.5 shrink-0", statusIconClass(entry.status))} />
                {entry.label}
              </li>
            );
          })}
          <li className="inline-flex items-center gap-1.5">
            <Sparkles aria-hidden className="size-3.5 text-ai" />
            Written with AI
          </li>
        </ul>
      </div>

      {loading ? (
        <div role="status" aria-label="Loading the calendar" className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
          {Array.from({ length: 35 }).map((_, index) => (
            <div key={index} className="h-20 bg-card p-2 md:h-28">
              <Skeleton className="h-3 w-5" />
              {index % 4 === 1 ? <Skeleton className="mt-3 hidden h-8 w-full md:block" /> : null}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border md:block">
            <div className="grid grid-cols-7 border-b border-border-strong bg-surface-strong">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-border">
              {cells.map((date, index) => {
                if (!date) return <div key={`pad-${index}`} aria-hidden className="min-h-28 bg-surface-strong" />;
                const key = dayKey(date);
                const dayItems = byDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <div key={key} className={cn("min-h-28 bg-card p-1.5", isToday && "ring-2 ring-inset ring-primary/45")}>
                    <p className="mb-1 flex items-center justify-between px-0.5">
                      <span
                        className={cn(
                          "grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums",
                          isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        {date.getDate()}
                        {isToday ? <span className="sr-only"> (today)</span> : null}
                      </span>
                      {dayItems.length > 1 ? <span className="text-xs text-muted-foreground">{dayItems.length} posts</span> : null}
                    </p>
                    <ul className="space-y-1">
                      {dayItems.map((item) => (
                        <li key={item.post_id}>
                          <CalendarEntry item={item} showLocation={showLocation} onOpen={onOpen} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phones: the days that have posts, as a list. */}
          {daysWithPosts.length > 0 ? (
            <ul className="space-y-3 md:hidden">
              {daysWithPosts.map((date) => (
                <li key={dayKey(date)} className="rounded-xl border border-border bg-card p-3">
                  <p className={cn("text-sm font-semibold", dayKey(date) === todayKey ? "text-primary" : "text-foreground")}>
                    {PHONE_DAY.format(date)}
                    {dayKey(date) === todayKey ? " · Today" : ""}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {(byDay.get(dayKey(date)) ?? []).map((item) => (
                      <li key={item.post_id}>
                        <PhoneEntry item={item} showLocation={showLocation} onOpen={onOpen} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}

          {empty ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong bg-card px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No scheduled or published posts in {MONTH_LABEL.format(month)}.</p>
              {emptyAction}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function entryTitle(item: CalendarItem): string {
  return item.event?.title ?? item.summary ?? "Untitled post";
}

/**
 * A compact entry in a day cell: the status icon, the time, an AI mark, the location (organization
 * view) and the title. Its name starts with the day, which the grid only shows visually.
 */
function CalendarEntry({ item, showLocation, onOpen }: { item: CalendarItem; showLocation: boolean; onOpen?: ((item: CalendarItem) => void) | undefined }) {
  const StatusIcon = ENTRY_ICON[item.status];
  const content = (
    <>
      <span className="flex items-center gap-1 text-xs font-semibold tabular-nums text-foreground">
        <StatusIcon aria-hidden className={cn("size-3 shrink-0", statusIconClass(item.status))} />
        <span className="sr-only">{PHONE_DAY.format(new Date(item.date))}, </span>
        {formatTime(item.date)}
        {item.source === "ai" ? <Sparkles aria-label="Written with AI" className="size-3 shrink-0 text-ai" /> : null}
        <span className="sr-only">, {STATUS_LABEL[item.status]}</span>
      </span>
      {showLocation && item.location_name ? <span className="block truncate text-xs font-medium text-muted-foreground">{item.location_name}</span> : null}
      <span className="line-clamp-2 text-xs leading-snug text-foreground">{entryTitle(item)}</span>
    </>
  );
  const className = cn("block w-full rounded-md border-l-[3px] px-1.5 py-1 text-left", ENTRY_CLASS[item.status]);
  return onOpen ? (
    <button
      type="button"
      title={`${STATUS_LABEL[item.status]}: ${entryTitle(item)}`}
      className={cn(
        className,
        "cursor-pointer transition-[box-shadow,filter] outline-hidden hover:shadow-sm hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={() => onOpen(item)}
    >
      {content}
    </button>
  ) : (
    <div className={className} title={`${STATUS_LABEL[item.status]}: ${entryTitle(item)}`}>
      {content}
    </div>
  );
}

/** A roomier entry for the phone list: status in words, time, AI mark, location and title. */
function PhoneEntry({ item, showLocation, onOpen }: { item: CalendarItem; showLocation: boolean; onOpen?: ((item: CalendarItem) => void) | undefined }) {
  const content = (
    <>
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={STATUS_TONE[item.status]} icon={STATUS_ICON[item.status]} size="sm">
          {STATUS_LABEL[item.status]}
        </StatusBadge>
        {item.source === "ai" ? (
          <StatusBadge tone="ai" icon={Sparkles} size="sm">
            AI
          </StatusBadge>
        ) : null}
        <span className="text-xs font-medium tabular-nums text-muted-foreground">{formatTime(item.date)}</span>
      </span>
      {showLocation && item.location_name ? <span className="mt-1 block truncate text-xs font-medium text-muted-foreground">{item.location_name}</span> : null}
      <span className="mt-0.5 line-clamp-2 block text-sm text-foreground">{entryTitle(item)}</span>
    </>
  );
  const className = cn("block w-full rounded-lg border-l-[3px] px-2.5 py-2 text-left", ENTRY_CLASS[item.status]);
  return onOpen ? (
    <button type="button" className={cn(className, "cursor-pointer outline-hidden focus-visible:ring-2 focus-visible:ring-ring")} onClick={() => onOpen(item)}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
