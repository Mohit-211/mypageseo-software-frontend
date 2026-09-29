import type { ComponentType } from "react";
import { CalendarClock, Send } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { FieldMessage, FormField } from "@/components/layout/shared/form-fields";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RECURRENCE_LABEL, type RecurrenceFrequency } from "@/lib/gbp/ai-posts";
import { cn } from "@/lib/utils";
import { DatePickerButton, WeekdayPicker } from "../post-ui";
import type { CreatePostForm, FormSectionProps } from "./form-model";

const MODES: { value: CreatePostForm["publishMode"]; label: string; description: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: "now", label: "Publish now", description: "Goes live as soon as it's saved", icon: Send },
  { value: "later", label: "Schedule for later", description: "Pick a date and time", icon: CalendarClock },
];

const RECURRENCES: RecurrenceFrequency[] = ["none", "daily", "twice_weekly", "weekly", "monthly", "custom"];

export function ScheduleSettings({ form, onChange, errors }: FormSectionProps) {
  const needsDays = form.recurrence === "twice_weekly" || form.recurrence === "custom";
  return (
    <Panel title="Scheduling" description="Choose when this post goes live and whether it repeats.">
      <div className="space-y-5">
        <div role="radiogroup" aria-label="Publish timing" className="grid gap-2 sm:grid-cols-2">
          {MODES.map(({ value, label, description, icon: Icon }) => {
            const selected = form.publishMode === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ publishMode: value })}
                className={cn(
                  "flex items-center gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                  selected ? "border-primary bg-brand-tint ring-1 ring-primary" : "border-border bg-surface hover:border-primary/40",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-primary" : "border-input",
                  )}
                >
                  {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{label}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
                <Icon className={cn("size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
              </button>
            );
          })}
        </div>

        {form.publishMode === "later" ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <FormField label="Publish date" htmlFor="post-date" required error={errors.date}>
              <DatePickerButton id="post-date" value={form.date} onChange={(date) => onChange({ date })} invalid={Boolean(errors.date)} />
            </FormField>
            <FormField label="Time" htmlFor="post-time" required>
              <Input id="post-time" type="time" value={form.time} onChange={(e) => e.target.value && onChange({ time: e.target.value })} />
            </FormField>
          </div>
        ) : null}

        <div className="grid gap-4 border-t border-border pt-4">
          <FormField label="Repeat" htmlFor="post-recurrence" hint={form.recurrence === "none" ? "Publish once." : "A fresh AI variation is drafted for each repeat."}>
            <Select
              value={form.recurrence}
              onValueChange={(value) => {
                const recurrence = value as RecurrenceFrequency;
                onChange({
                  recurrence,
                  recurrenceDays: recurrence === "twice_weekly" ? [1, 4] : recurrence === "custom" ? [0, 2, 4] : [],
                });
              }}
            >
              <SelectTrigger id="post-recurrence" className="w-full sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECURRENCES.map((value) => (
                  <SelectItem key={value} value={value}>{RECURRENCE_LABEL[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {needsDays ? (
            <div>
              <p className="text-[13px] font-medium text-foreground">Repeat on</p>
              <div className="mt-1.5">
                <WeekdayPicker
                  ariaLabel="Repeat on"
                  value={form.recurrenceDays}
                  max={form.recurrence === "twice_weekly" ? 2 : undefined}
                  onChange={(recurrenceDays) => onChange({ recurrenceDays })}
                />
              </div>
              <FieldMessage error={errors.recurrenceDays} hint={form.recurrence === "twice_weekly" ? "Pick two days." : undefined} />
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
