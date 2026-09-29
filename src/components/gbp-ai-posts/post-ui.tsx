import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon, ImageIcon, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AI_POST_STATUS_DOT,
  AI_POST_STATUS_LABEL,
  AI_POST_STATUS_SHORT_LABEL,
  AI_POST_STATUS_TONE,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type AiPostStatus,
  type Weekday,
} from "@/lib/gbp/ai-posts";
import { cn } from "@/lib/utils";

export const AI_POSTS_PATH = "/gbp/ai-posts";

/** Status badge for AI posts. `compact` uses short labels for dense layouts. */
export function PostStatusBadge({
  status,
  compact = false,
  className,
}: {
  status: AiPostStatus;
  compact?: boolean;
  className?: string;
}) {
  return (
    <StatusBadge
      tone={AI_POST_STATUS_TONE[status]}
      className={cn(compact && "gap-1 px-1.5 py-0 text-[10px] leading-4", className)}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", AI_POST_STATUS_DOT[status])} />
      {compact ? (
        <>
          <span aria-hidden>{AI_POST_STATUS_SHORT_LABEL[status]}</span>
          <span className="sr-only">{AI_POST_STATUS_LABEL[status]}</span>
        </>
      ) : (
        AI_POST_STATUS_LABEL[status]
      )}
    </StatusBadge>
  );
}

/** Subtle marker for AI-generated content and AI actions. */
export function AiIndicator({ label = "AI", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-primary/20 bg-brand-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/** Post image with a neutral placeholder when there is no image or it fails to load. */
export function PostThumbnail({
  src,
  alt = "",
  className,
  iconClassName,
}: {
  src: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const broken = !src || failed === src;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-md border border-border bg-brand-tint", className)}>
      {broken ? (
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-tint to-brand-tint-strong">
          <ImageIcon className={cn("size-4 text-brand-soft", iconClassName)} aria-hidden />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(src)}
          className="size-full object-cover"
        />
      )}
    </div>
  );
}

export function BackToPostsLink() {
  return (
    <Link to={AI_POSTS_PATH} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
      <ArrowLeft className="size-4" aria-hidden /> Back to AI GBP Posts
    </Link>
  );
}

/** Button + popover calendar for picking a single date. */
export function DatePickerButton({
  id,
  value,
  onChange,
  disablePast = true,
  invalid,
}: {
  id: string;
  value: Date | null;
  onChange: (date: Date) => void;
  disablePast?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid ? true : undefined}
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-muted-foreground",
            invalid && "border-critical",
          )}
        >
          <CalendarIcon aria-hidden />
          {value ? format(value, "EEE, MMM d, yyyy") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          defaultMonth={value ?? undefined}
          weekStartsOn={1}
          disabled={disablePast ? { before: today } : undefined}
          onSelect={(date) => {
            if (date) {
              onChange(date);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Toggle row of weekdays. `max` caps the selection (e.g. 2 for twice a week). */
export function WeekdayPicker({
  value,
  onChange,
  max,
  ariaLabel = "Publishing days",
}: {
  value: Weekday[];
  onChange: (days: Weekday[]) => void;
  max?: number;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((day) => {
        const selected = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              if (selected) onChange(value.filter((d) => d !== day));
              else if (max && value.length >= max) onChange([...value.slice(1), day]);
              else onChange([...value, day]);
            }}
            className={cn(
              "inline-flex h-8 min-w-11 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {WEEKDAY_SHORT[day]}
          </button>
        );
      })}
    </div>
  );
}
