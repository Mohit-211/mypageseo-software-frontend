import { useState } from "react";
import { format, isAfter } from "date-fns";
import { toast } from "sonner";
import { FormField } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { aiPostsActions, combineDateTime, type AiGbpPost } from "@/lib/gbp/ai-posts";
import { DatePickerButton } from "./post-ui";

export function RescheduleDialog({
  post,
  open,
  onOpenChange,
}: {
  post: AiGbpPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const initial = post.scheduledAt ? new Date(post.scheduledAt) : null;
  const [date, setDate] = useState<Date | null>(initial);
  const [time, setTime] = useState(initial ? format(initial, "HH:mm") : "10:00");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!date) return setError("Choose a date.");
    const when = combineDateTime(date, time);
    if (!isAfter(when, new Date())) return setError("Choose a time in the future.");
    aiPostsActions.reschedule(post.id, when);
    toast.success("Post rescheduled", { description: `Now goes live ${format(when, "EEE, MMM d 'at' h:mm a")}.` });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDate(initial);
          setTime(initial ? format(initial, "HH:mm") : "10:00");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule post</DialogTitle>
          <DialogDescription>Choose when “{post.title}” should go live on Google.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <FormField label="Date" htmlFor="reschedule-date" required>
            <DatePickerButton id="reschedule-date" value={date} onChange={(d) => { setDate(d); setError(null); }} />
          </FormField>
          <FormField label="Time" htmlFor="reschedule-time" required>
            <Input id="reschedule-time" type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(null); }} />
          </FormField>
        </div>
        {error ? <p role="alert" className="text-xs font-medium text-critical">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Reschedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
