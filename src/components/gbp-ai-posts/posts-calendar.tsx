import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AI_POST_STATUS_DOT,
  AI_POST_STATUS_LABEL,
  type AiGbpPost,
  type AiPostStatus,
} from "@/lib/gbp/ai-posts";
import { cn } from "@/lib/utils";
import { CalendarPostCard } from "./calendar-post-card";
import { useNow } from "@/hooks/use-now";

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE_PER_DAY = 2;
const LEGEND: AiPostStatus[] = ["draft", "pending_approval", "scheduled", "published", "failed"];

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function postDate(post: AiGbpPost): Date | null {
  const when = post.scheduledAt ?? post.publishedAt;
  return when ? new Date(when) : null;
}

export function PostsCalendar({
  posts,
  onSelectPost,
  onCreateOnDate,
}: {
  posts: AiGbpPost[];
  onSelectPost: (post: AiGbpPost) => void;
  onCreateOnDate: (date: Date) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const expanded = useMediaQuery("(min-width: 1024px)");
  const today = startOfDay(new Date(useNow()));

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const postsByDay = useMemo(() => {
    const map = new Map<string, AiGbpPost[]>();
    for (const post of posts) {
      const date = postDate(post);
      if (!date) continue;
      const key = format(date, "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    for (const list of map.values()) list.sort((a, b) => (postDate(a)?.getTime() ?? 0) - (postDate(b)?.getTime() ?? 0));
    return map;
  }, [posts]);

  const inMonth = posts.filter((p) => {
    const d = postDate(p);
    return d && isSameMonth(d, month);
  }).length;
  const undated = posts.filter((p) => !postDate(p)).length;
  const selectedPosts = postsByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? [];

  const goTo = (next: Date) => {
    setMonth(startOfMonth(next));
    setSelectedDay(isSameMonth(next, new Date()) ? today : startOfMonth(next));
  };

  return (
    <section aria-labelledby="ai-posts-calendar-title" className="rounded-lg border border-border bg-surface shadow-card">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="ai-posts-calendar-title" className="text-base font-semibold text-foreground">
            {format(month, "MMMM yyyy")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {inMonth === 0 ? "No posts this month" : `${inMonth} post${inMonth === 1 ? "" : "s"} this month`}
            {undated > 0 ? ` · ${undated} unscheduled draft${undated === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center rounded-md border border-border bg-brand-tint px-2.5 text-xs font-medium text-primary">
            Month
          </span>
          <Button variant="outline" size="sm" onClick={() => goTo(new Date())} disabled={isSameMonth(month, today)}>
            Today
          </Button>
          <div className="inline-flex">
            <Button variant="outline" size="icon" className="size-8 rounded-r-none" onClick={() => goTo(subMonths(month, 1))} aria-label="Previous month">
              <ChevronLeft aria-hidden />
            </Button>
            <Button variant="outline" size="icon" className="-ml-px size-8 rounded-l-none" onClick={() => goTo(addMonths(month, 1))} aria-label="Next month">
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-brand-tint">
        {WEEKDAY_HEADERS.map((day) => (
          <div key={day} className="px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:px-2 lg:text-left">
            <span className="lg:hidden">{day.charAt(0)}</span>
            <span className="hidden lg:inline">{day}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          const outside = !isSameMonth(day, month);
          const past = isBefore(day, today);
          const canCreate = !past;
          const selected = !expanded && isSameDay(day, selectedDay);
          const hidden = dayPosts.length - MAX_VISIBLE_PER_DAY;

          return (
            <div
              key={key}
              onClick={() => {
                if (!expanded) setSelectedDay(day);
                else if (canCreate) onCreateOnDate(day);
              }}
              className={cn(
                "group/day relative min-w-0 border-b border-r border-border p-1 [&:nth-child(7n)]:border-r-0 lg:min-h-36 lg:p-1.5",
                "min-h-14 cursor-pointer",
                outside && "bg-surface-strong/60",
                expanded && !canCreate && "cursor-default",
                expanded && canCreate && "hover:bg-brand-tint/50",
                selected && "bg-brand-tint ring-1 ring-inset ring-primary/40",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs tabular",
                    isToday(day) ? "bg-primary font-semibold text-primary-foreground" : outside ? "text-muted-foreground/60" : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                {expanded && canCreate ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCreateOnDate(day);
                    }}
                    aria-label={`Create post on ${format(day, "MMMM d")}`}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-surface hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 group-hover/day:opacity-100"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>

              {expanded ? (
                <div className="mt-1 space-y-1">
                  {dayPosts.slice(0, MAX_VISIBLE_PER_DAY).map((post) => (
                    <CalendarPostCard key={post.id} post={post} onSelect={onSelectPost} />
                  ))}
                  {hidden > 0 ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          className="w-full rounded px-1 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-surface hover:underline"
                        >
                          +{hidden} more
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-72 p-2" onClick={(event) => event.stopPropagation()}>
                        <p className="px-1 pb-2 text-xs font-semibold text-foreground">{format(day, "EEEE, MMMM d")}</p>
                        <div className="space-y-1.5">
                          {dayPosts.map((post) => (
                            <CalendarPostCard key={post.id} post={post} onSelect={onSelectPost} variant="row" />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </div>
              ) : dayPosts.length > 0 ? (
                <div className="mt-1 flex flex-wrap justify-center gap-0.5" aria-label={`${dayPosts.length} posts`}>
                  {dayPosts.slice(0, 4).map((post) => (
                    <span key={post.id} className={cn("size-1.5 rounded-full", AI_POST_STATUS_DOT[post.status])} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
        {LEGEND.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span aria-hidden className={cn("size-2 rounded-full", AI_POST_STATUS_DOT[status])} />
            {AI_POST_STATUS_LABEL[status]}
          </span>
        ))}
      </div>

      {!expanded ? (
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{format(selectedDay, "EEEE, MMM d")}</p>
            {!isBefore(selectedDay, today) ? (
              <Button variant="outline" size="sm" onClick={() => onCreateOnDate(selectedDay)}>
                <Plus aria-hidden /> Create post
              </Button>
            ) : null}
          </div>
          {selectedPosts.length === 0 ? (
            <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              No posts on this day.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedPosts.map((post) => (
                <CalendarPostCard key={post.id} post={post} onSelect={onSelectPost} variant="row" />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function PostsCalendarSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card" role="status" aria-label="Loading calendar">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-14 border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0 lg:min-h-36">
            <Skeleton className="size-5 rounded-full" />
            {i % 3 === 1 ? <Skeleton className="mt-2 hidden h-9 w-full lg:block" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
