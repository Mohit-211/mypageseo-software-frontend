import { useState } from "react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PostCalendarItem } from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { POST_STATUS_LABEL, POST_STATUS_TONE, POST_TYPE_LABEL, postErrorMessage } from "@/lib/posts/posts";
import { usePostsCalendar } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Published and scheduled posts by day for one month (drafts without a date aren't shown). */
export function PostsCalendar({ locationId }: { locationId: string }) {
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => startOfMonth(today));
  const gridStart = startOfWeek(month, WEEK_OPTIONS);
  const gridEnd = endOfWeek(endOfMonth(month), WEEK_OPTIONS);
  const calendar = usePostsCalendar(locationId, gridStart.toISOString(), addDays(gridEnd, 1).toISOString());

  const days: Date[] = [];
  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) days.push(day);
  const itemsOn = (day: Date) => (calendar.data?.items ?? []).filter((item) => isSameDay(new Date(item.date), day));

  return (
    <Panel
      title={format(month, "MMMM yyyy")}
      description="Published and scheduled posts. Drafts without a date aren't shown."
      actions={
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" aria-label="Previous month" onClick={() => setMonth((current) => addMonths(current, -1))}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(today))}>Today</Button>
          <Button variant="outline" size="sm" aria-label="Next month" onClick={() => setMonth((current) => addMonths(current, 1))}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      }
    >
      {calendar.isError ? (
        <ErrorState description={postErrorMessage(calendar.error, "The calendar couldn't be loaded.")} onRetry={() => void calendar.refetch()} />
      ) : (
        <>
          {/* Month grid from tablet width up; a day list on phones. */}
          <div className={cn("hidden md:block", calendar.isPending && "opacity-60")}>
            <div className="grid grid-cols-7 border-b border-border pb-1 text-center text-xs font-medium text-muted-foreground">
              {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn("min-h-24 border-b border-r border-border p-1.5 [&:nth-child(7n+1)]:border-l", !isSameMonth(day, month) && "bg-muted/30")}
                >
                  <span className={cn("text-xs tabular", isSameDay(day, today) ? "rounded bg-primary px-1 font-semibold text-primary-foreground" : "text-muted-foreground")}>
                    {format(day, "d")}
                  </span>
                  <ul className="mt-1 space-y-1">
                    {itemsOn(day).map((item) => <CalendarChip key={item.post_id} item={item} />)}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <ul className="divide-y divide-border md:hidden">
            {days.filter((day) => isSameMonth(day, month) && itemsOn(day).length > 0).map((day) => (
              <li key={day.toISOString()} className="py-2.5">
                <p className="text-xs font-medium text-muted-foreground">{format(day, "EEE d MMM")}</p>
                <ul className="mt-1.5 space-y-1.5">{itemsOn(day).map((item) => <CalendarChip key={item.post_id} item={item} />)}</ul>
              </li>
            ))}
            {!calendar.isPending && (calendar.data?.items.length ?? 0) === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">No posts this month.</li>
            ) : null}
          </ul>
        </>
      )}
    </Panel>
  );
}

function CalendarChip({ item }: { item: PostCalendarItem }) {
  const title = item.event?.title ?? item.summary ?? POST_TYPE_LABEL[item.type];
  return (
    <li title={`${POST_STATUS_LABEL[item.status]} · ${format(new Date(item.date), "HH:mm")} · ${title}`}>
      <StatusBadge tone={POST_STATUS_TONE[item.status]} className="block w-full truncate text-left">
        {format(new Date(item.date), "HH:mm")} {item.source === "ai" ? "AI · " : ""}{title}
      </StatusBadge>
    </li>
  );
}
