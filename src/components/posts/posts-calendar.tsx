import { useMemo } from "react";
import { useNow } from "@/hooks/use-now";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarItem } from "@/api";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { ListSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/datetime";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * Month grid of dated posts (published or scheduled; drafts aren't on the calendar).
 * Coloured by status; AI posts are tagged. `showLocation` for the organization calendar.
 */
export function PostsCalendar({
  month,
  onShift,
  items,
  loading,
  showLocation = false,
  onOpen,
}: {
  month: Date;
  onShift: (delta: number) => void;
  items: CalendarItem[] | undefined;
  loading: boolean;
  showLocation?: boolean;
  onOpen?: (item: CalendarItem) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items ?? []) {
      const key = dayKey(new Date(item.date));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  // Weeks start on Monday.
  const lead = (first.getDay() + 6) % 7;
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))];
  const now = useNow();
  const todayKey = dayKey(new Date(now));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" className="size-8" aria-label="Previous month" onClick={() => onShift(-1)}><ChevronLeft aria-hidden /></Button>
        <p className="min-w-40 text-center text-sm font-semibold text-foreground">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        <Button size="icon" variant="outline" className="size-8" aria-label="Next month" onClick={() => onShift(1)}><ChevronRight aria-hidden /></Button>
      </div>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="bg-surface-strong px-2 py-1.5 text-xs font-medium text-muted-foreground">{day}</div>
            ))}
            {cells.map((date, index) => {
              const dayItems = date ? (byDay.get(dayKey(date)) ?? []) : [];
              return (
                <div key={index} className={cn("min-h-24 bg-surface p-1.5", !date && "bg-muted/30")}>
                  {date ? (
                    <>
                      <p className={cn("text-xs tabular", dayKey(date) === todayKey ? "font-bold text-primary" : "text-muted-foreground")}>{date.getDate()}</p>
                      <ul className="mt-1 space-y-1">
                        {dayItems.map((item) => (
                          <li key={item.post_id}>
                            <CalendarEntry item={item} showLocation={showLocation} onOpen={onOpen} compact />
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
          {/* Phones: a list of the days that have posts. */}
          <ul className="space-y-2 md:hidden">
            {cells.filter((date): date is Date => Boolean(date && byDay.get(dayKey(date))?.length)).map((date) => (
              <li key={dayKey(date)} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-xs font-semibold text-muted-foreground">{date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {(byDay.get(dayKey(date)) ?? []).map((item) => (
                    <li key={item.post_id}><CalendarEntry item={item} showLocation={showLocation} onOpen={onOpen} /></li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {items && items.length === 0 ? <p className="text-sm text-muted-foreground">No scheduled or published posts this month.</p> : null}
        </>
      )}
    </div>
  );
}

function CalendarEntry({ item, showLocation, onOpen, compact = false }: { item: CalendarItem; showLocation: boolean; onOpen?: ((item: CalendarItem) => void) | undefined; compact?: boolean }) {
  const content = (
    <>
      <span className="flex flex-wrap items-center gap-1">
        <StatusBadge tone={STATUS_TONE[item.status]} className="px-1 py-0 text-[10px]">{STATUS_LABEL[item.status]}</StatusBadge>
        {item.source === "ai" ? <StatusBadge tone="brand" className="px-1 py-0 text-[10px]">AI</StatusBadge> : null}
        <span className="text-[10px] text-muted-foreground">{formatTime(item.date)}</span>
      </span>
      {showLocation && item.location_name ? <span className="block truncate text-[11px] font-medium text-foreground">{item.location_name}</span> : null}
      <span className={cn("block text-foreground", compact ? "line-clamp-2 text-[11px]" : "text-sm")}>{item.event?.title ?? item.summary ?? "Untitled post"}</span>
    </>
  );
  return onOpen ? (
    <button type="button" className="block w-full rounded px-1 py-0.5 text-left hover:bg-muted" onClick={() => onOpen(item)}>{content}</button>
  ) : (
    <div className="px-1 py-0.5">{content}</div>
  );
}
