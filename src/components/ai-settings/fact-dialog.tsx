import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AiFact, AiFactKind } from "@/api";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { factErrorText, factIssuesByField, factIssuesFromError } from "@/lib/ai-settings/errors";
import {
  FACT_KIND_COPY,
  FACT_KIND_FIELDS,
  FACT_LIMITS,
  datesChanged,
  emptyFactForm,
  factFormErrors,
  factFormFrom,
  factInput,
  factPatch,
  type FactField,
  type FactForm,
} from "@/lib/ai-settings/fact-form";
import { useAiFactMutations } from "@/lib/ai-settings/use-ai-settings";
import { CharCount, FieldFoot } from "./settings-parts";

const TITLE_LABEL: Record<Exclude<AiFactKind, "fact">, string> = { offer: "Offer title", event: "Event title", contest: "Contest title" };

const TITLE_PLACEHOLDER: Record<Exclude<AiFactKind, "fact">, string> = {
  offer: "e.g. 20% off winter tires",
  event: "e.g. Holiday open house",
  contest: "e.g. Win a family dinner for four",
};

/**
 * Adds or edits one fact, offer, event or contest, with exactly the fields of its kind. The backend's
 * field problems (400 `invalid_fact`) show next to their fields; a refused offer (a regulated product,
 * lodging) or the limit of 100 shows above the buttons.
 */
export function FactDialog({
  locationId,
  kind,
  fact,
  today,
  nowTime = null,
  onClose,
}: {
  locationId: string;
  kind: AiFactKind;
  /** The fact to edit; null to add one. */
  fact: AiFact | null;
  /** The location's local date (YYYY-MM-DD): new dated facts start today. */
  today: string | null;
  /** The location's local time (HH:mm) when the list was read: an end before it has passed. */
  nowTime?: string | null;
  onClose: () => void;
}) {
  const { create, update } = useAiFactMutations(locationId);
  const [form, setForm] = useState<FactForm>(() => (fact ? factFormFrom(fact) : emptyFactForm(kind, today)));
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<FactField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const saving = create.isPending || update.isPending;
  const copy = FACT_KIND_COPY[kind];
  const fields = FACT_KIND_FIELDS[kind];
  const errors = factFormErrors(kind, form, { today, nowTime, checkEnd: !fact || datesChanged(fact, form) });
  // The backend's words for a field win until that field changes.
  const shown: Partial<Record<FactField, string>> = { ...(showErrors ? errors : {}), ...serverErrors };

  const set = (key: keyof FactForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    const field: FactField = key === "startDate" || key === "startTime" ? "start" : key === "endDate" || key === "endTime" ? "end" : key;
    setServerErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  };

  const submit = async () => {
    if (saving) return;
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    try {
      if (fact) {
        const patch = factPatch(fact, form);
        if (Object.keys(patch).length > 0) {
          await update.mutateAsync({ factId: fact.fact_id, patch });
          toast.success(`${copy.label} saved.`);
        }
      } else {
        const added = await create.mutateAsync(factInput(kind, form));
        toast.success(`${copy.label} added.`, {
          description: added.in_fact_sheet ? "The AI may use it from now on." : "It's saved, but the AI won't use it while it's switched off or over.",
        });
      }
      onClose();
    } catch (err) {
      const { fields: byField, other } = factIssuesByField(factIssuesFromError(err));
      setServerErrors(byField);
      setShowErrors(true);
      setFormError(other.length > 0 ? other.join(" ") : factErrorText(err));
    }
  };

  const title = fact ? `Edit ${copy.label.toLowerCase()}` : `Add ${copy.article}`;
  const has = (field: FactField) => fields.includes(field);

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {kind === "fact" ? (
            <>
              <TextField
                id="fact-text"
                label="Fact"
                required
                multiline
                rows={3}
                value={form.text}
                max={FACT_LIMITS.text}
                placeholder="e.g. Free parking behind the shop."
                hint="One short statement the AI may repeat as written."
                error={shown.text}
                onChange={(value) => set("text", value)}
                autoFocus
              />
              <TextField
                id="fact-topic"
                label="Topic"
                value={form.topic}
                max={FACT_LIMITS.topic}
                placeholder="e.g. Parking"
                hint="A word or two to group it, like Parking or Team."
                error={shown.topic}
                onChange={(value) => set("topic", value)}
              />
            </>
          ) : (
            <>
              <TextField
                id="fact-title"
                label={TITLE_LABEL[kind]}
                required
                value={form.title}
                max={FACT_LIMITS.title}
                placeholder={TITLE_PLACEHOLDER[kind]}
                error={shown.title}
                onChange={(value) => set("title", value)}
                autoFocus
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField
                  id="fact-start"
                  label="Starts"
                  date={form.startDate}
                  time={form.startTime}
                  error={shown.start}
                  onDate={(value) => set("startDate", value)}
                  onTime={(value) => set("startTime", value)}
                />
                <DateField
                  id="fact-end"
                  label="Ends"
                  date={form.endDate}
                  time={form.endTime}
                  error={shown.end}
                  onDate={(value) => set("endDate", value)}
                  onTime={(value) => set("endTime", value)}
                />
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">Times are optional and in the business's own time. Without a time, the whole day counts.</p>
              {has("terms_url") ? (
                <TextField
                  id="fact-terms-url"
                  label="Link to the rules"
                  required
                  type="url"
                  value={form.terms_url}
                  max={FACT_LIMITS.url}
                  placeholder="https://"
                  hint="Where people read the contest's rules. Google asks for them."
                  error={shown.terms_url}
                  onChange={(value) => set("terms_url", value)}
                  showCount={false}
                />
              ) : null}
              {has("coupon_code") ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="fact-coupon"
                    label="Coupon code"
                    value={form.coupon_code}
                    max={FACT_LIMITS.coupon_code}
                    placeholder="e.g. WINTER20"
                    error={shown.coupon_code}
                    onChange={(value) => set("coupon_code", value)}
                  />
                  <TextField
                    id="fact-redeem"
                    label="Link to redeem it"
                    type="url"
                    value={form.redeem_url}
                    max={FACT_LIMITS.url}
                    placeholder="https://"
                    error={shown.redeem_url}
                    onChange={(value) => set("redeem_url", value)}
                    showCount={false}
                  />
                </div>
              ) : null}
              <TextField
                id="fact-details"
                label="Details"
                multiline
                rows={2}
                value={form.text}
                max={FACT_LIMITS.text}
                placeholder={kind === "offer" ? "e.g. Installation included." : "e.g. Free coffee and a tour of the new space."}
                error={shown.text}
                onChange={(value) => set("text", value)}
              />
              {has("terms") ? (
                <TextField
                  id="fact-terms"
                  label="Terms"
                  multiline
                  rows={3}
                  value={form.terms}
                  max={FACT_LIMITS.terms}
                  placeholder="e.g. One per customer. Can't be combined with other offers."
                  error={shown.terms}
                  onChange={(value) => set("terms", value)}
                />
              ) : null}
            </>
          )}

          {formError ? <FormAlert>{formError}</FormAlert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
              {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {fact ? "Save changes" : `Add ${copy.label.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldLabel({ htmlFor, label, required }: { htmlFor: string; label: string; required?: boolean | undefined }) {
  return (
    <Label htmlFor={htmlFor} className="leading-5">
      {label}
      {required ? null : <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
    </Label>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  max,
  required,
  multiline = false,
  rows,
  type = "text",
  placeholder,
  hint,
  error,
  autoFocus,
  showCount = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  type?: "text" | "url";
  placeholder?: string;
  hint?: ReactNode;
  error?: string | undefined;
  autoFocus?: boolean;
  showCount?: boolean;
}) {
  const messageId = `${id}-message`;
  const shared = {
    id,
    value,
    placeholder,
    maxLength: max,
    autoFocus,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": messageId,
    "aria-required": required || undefined,
  } as const;
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} label={label} required={required} />
      <div className="mt-1.5">
        {multiline ? (
          <Textarea {...shared} rows={rows} className="min-h-0" onChange={(event) => onChange(event.target.value)} />
        ) : (
          <Input {...shared} type={type} inputMode={type === "url" ? "url" : undefined} onChange={(event) => onChange(event.target.value)} />
        )}
      </div>
      <FieldFoot id={messageId} error={error} hint={hint} count={showCount ? <CharCount count={value.length} max={max} /> : undefined} />
    </div>
  );
}

/** A required date with an optional time, both in the location's own time. */
function DateField({
  id,
  label,
  date,
  time,
  error,
  onDate,
  onTime,
}: {
  id: string;
  label: string;
  date: string;
  time: string;
  error?: string | undefined;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
}) {
  const messageId = `${id}-message`;
  return (
    <div className="min-w-0">
      <FieldLabel htmlFor={id} label={label} required />
      <div className="mt-1.5 flex gap-2">
        <Input
          id={id}
          type="date"
          value={date}
          aria-required
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className="min-w-0 flex-[3_1_0%]"
          onChange={(event) => onDate(event.target.value)}
        />
        <Input
          type="time"
          value={time}
          aria-label={`${label} at (optional time)`}
          aria-describedby={messageId}
          className="min-w-0 flex-[2_1_0%]"
          onChange={(event) => onTime(event.target.value)}
        />
      </div>
      <FieldFoot id={messageId} error={error} />
    </div>
  );
}
