import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarRange, Loader2, Play } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DATE_RANGE_LABEL,
  describeRange,
  type AiVisibilityProfile,
  type DateRangePreset,
  type DateRangeValue,
} from "@/lib/ai-visibility/ai-visibility";

const PRESETS: DateRangePreset[] = ["7d", "30d", "3m", "6m", "custom"];

export function DateRangeSelect({
  value,
  onChange,
  className,
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  const today = new Date();

  const openCustom = () => {
    setDraft(value.from && value.to ? { from: new Date(value.from), to: new Date(value.to) } : undefined);
    setCustomOpen(true);
  };

  return (
    <Popover open={customOpen} onOpenChange={setCustomOpen}>
      <PopoverAnchor asChild>
        {/* Anchor for the custom range calendar; the Select below is the visible control. */}
        <span className={className}>
          <Select
            value={value.preset}
            onValueChange={(preset) => {
              if (preset === "custom") openCustom();
              else onChange({ preset: preset as DateRangePreset });
            }}
          >
            <SelectTrigger className="h-9 w-full bg-surface text-sm sm:w-48" aria-label="Date range">
              <CalendarRange className="size-4 text-muted-foreground" aria-hidden />
              <SelectValue>{describeRange(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((preset) => (
                <SelectItem
                  key={preset}
                  value={preset}
                  // Re-selecting "Custom Range" reopens the calendar.
                  {...(preset === "custom" && value.preset === "custom" ? { onPointerUp: openCustom } : {})}
                >
                  {DATE_RANGE_LABEL[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-auto p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Calendar
          mode="range"
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={1}
          disabled={{ after: today }}
          defaultMonth={draft?.from ?? today}
        />
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {draft?.from ? `${format(draft.from, "MMM d")}${draft.to ? ` – ${format(draft.to, "MMM d")}` : ""}` : "Pick a start and end date"}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setCustomOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!draft?.from || !draft.to}
              onClick={() => {
                if (!draft?.from || !draft.to) return;
                onChange({ preset: "custom", from: draft.from.toISOString(), to: draft.to.toISOString() });
                setCustomOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AIVisibilityHeader({
  profiles,
  profileId,
  onProfileChange,
  range,
  onRangeChange,
  onRunAnalysis,
  running,
  disabled,
}: {
  profiles: AiVisibilityProfile[];
  profileId: string;
  onProfileChange: (id: string) => void;
  range: DateRangeValue;
  onRangeChange: (range: DateRangeValue) => void;
  onRunAnalysis: () => void;
  running: boolean;
  disabled: boolean;
}) {
  return (
    <PageHeader
      title="AI Visibility"
      description="Monitor how your business appears in AI-generated answers across major AI assistants."
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Select value={profileId} onValueChange={onProfileChange}>
            <SelectTrigger className="h-9 w-full bg-surface text-sm sm:w-60" aria-label="Business profile">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.businessName} · {p.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeSelect value={range} onChange={onRangeChange} className="block w-full sm:w-auto" />
          <Button onClick={onRunAnalysis} disabled={running || disabled} className="w-full sm:w-auto">
            {running ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
            {running ? "Running…" : "Run Analysis"}
          </Button>
        </div>
      }
    />
  );
}
