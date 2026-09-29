import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, Repeat } from "lucide-react";
import { ComparisonControl, Panel } from "@/components/layout/shared/data-display";
import { FormField } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  aiPostsActions,
  describeSchedule,
  nextScheduleSlot,
  RECURRENCE_LABEL,
  type PublishingScheduleFrequency,
  type PublishingScheduleSetting,
} from "@/lib/gbp/ai-posts";
import { WeekdayPicker } from "./post-ui";

const FREQUENCIES: PublishingScheduleFrequency[] = ["daily", "twice_weekly", "weekly", "monthly", "custom"];

function scheduleError(setting: PublishingScheduleSetting): string | null {
  if (setting.frequency === "twice_weekly" && setting.days.length !== 2) return "Choose exactly two days.";
  if (setting.frequency === "weekly" && setting.days.length !== 1) return "Choose one day.";
  if (setting.frequency === "custom" && setting.days.length === 0) return "Choose at least one day.";
  return null;
}

/** Sensible day defaults when switching frequency, so the draft is always valid-ish. */
function withFrequency(setting: PublishingScheduleSetting, frequency: PublishingScheduleFrequency): PublishingScheduleSetting {
  if (frequency === "twice_weekly") return { ...setting, frequency, days: setting.days.length === 2 ? setting.days : [1, 4] };
  if (frequency === "weekly") return { ...setting, frequency, days: [setting.days[0] ?? 1] };
  if (frequency === "custom") return { ...setting, frequency, days: setting.days.length ? setting.days : [0, 2, 4] };
  return { ...setting, frequency };
}

export function PublishingSchedule({ schedule }: { schedule: PublishingScheduleSetting }) {
  const [draft, setDraft] = useState(schedule);
  const dirty = JSON.stringify(draft) !== JSON.stringify(schedule);
  const error = scheduleError(draft);
  const next = nextScheduleSlot(schedule);
  const showDays = draft.frequency === "twice_weekly" || draft.frequency === "weekly" || draft.frequency === "custom";

  return (
    <Panel
      title="Publishing Schedule"
      description="How often new AI posts are queued for your profiles."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-md border border-primary/20 bg-brand-tint px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Repeat className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Current schedule · {RECURRENCE_LABEL[schedule.frequency]}</p>
              <p className="truncate text-sm font-semibold text-foreground">{describeSchedule(schedule)}</p>
            </div>
          </div>
          {next ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" aria-hidden />
              Next slot {format(next, "EEE, MMM d 'at' h:mm a")}
            </p>
          ) : null}
        </div>

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <ComparisonControl
            ariaLabel="Publishing frequency"
            value={draft.frequency}
            onChange={(frequency) => setDraft(withFrequency(draft, frequency))}
            options={FREQUENCIES.map((value) => ({ value, label: RECURRENCE_LABEL[value] }))}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
          {showDays ? (
            <FormField
              label={draft.frequency === "weekly" ? "Day" : "Days"}
              htmlFor="schedule-days"
              error={error}
              hint={draft.frequency === "twice_weekly" ? "Pick two days." : undefined}
            >
              <WeekdayPicker
                value={draft.days}
                max={draft.frequency === "twice_weekly" ? 2 : draft.frequency === "weekly" ? 1 : undefined}
                onChange={(days) => setDraft({ ...draft, days })}
              />
            </FormField>
          ) : null}
          {draft.frequency === "monthly" ? (
            <FormField label="Day of month" htmlFor="schedule-day-of-month">
              <Select value={String(draft.dayOfMonth)} onValueChange={(v) => setDraft({ ...draft, dayOfMonth: Number(v) })}>
                <SelectTrigger id="schedule-day-of-month" className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}
          <FormField label="Publish time" htmlFor="schedule-time">
            <Input
              id="schedule-time"
              type="time"
              value={draft.time}
              onChange={(e) => e.target.value && setDraft({ ...draft, time: e.target.value })}
              className="w-36"
            />
          </FormField>
        </div>

        {dirty ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">New: {describeSchedule(draft)}</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDraft(schedule)}>Cancel</Button>
              <Button
                size="sm"
                disabled={error !== null}
                onClick={() => {
                  aiPostsActions.setSchedule(draft);
                  toast.success("Publishing schedule updated", { description: describeSchedule(draft) });
                }}
              >
                Save schedule
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
