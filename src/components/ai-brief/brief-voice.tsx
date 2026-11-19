import { useId, useState } from "react";
import { Loader2, MessagesSquare, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { BriefFormality, BriefVoice, BriefWarmth } from "@/api";
import { FieldFoot } from "@/components/ai-settings/settings-parts";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FORMALITY_COPY,
  FORMALITY_OPTIONS,
  WARMTH_COPY,
  WARMTH_OPTIONS,
  briefChangeErrorText,
  termsOf,
  voiceChange,
  voiceChanged,
  voiceErrors,
  voiceForm,
  type VoiceForm,
} from "@/lib/ai-brief/brief";
import { useBriefMutations } from "@/lib/ai-brief/use-brief";

/**
 * The business's voice in the brief: how formal and how warm the AI writes, the words it likes to use and the ones
 * it avoids. Owners and members set it (it is then theirs: rebuilds keep it) or give it back to the website's
 * reading ("Use the website's voice").
 */
export function BriefVoiceCard({ locationId, voice, canEdit }: { locationId: string; voice: BriefVoice | null | undefined; canEdit: boolean }) {
  const { patch } = useBriefMutations(locationId);
  const [editing, setEditing] = useState(false);
  const formality = voice?.formality ? FORMALITY_COPY[voice.formality] : null;
  const warmth = voice?.warmth ? WARMTH_COPY[voice.warmth] : null;

  const reset = () =>
    patch.mutate(
      { voice: { reset: true } },
      {
        onSuccess: () => toast.success("The voice goes back to what your website says. The next build reads it afresh."),
        onError: (err) => toast.error(briefChangeErrorText(err).text),
      },
    );

  return (
    <section aria-labelledby="brief-voice-title" className="min-w-0 rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-[1_1_14rem] items-start gap-3">
          <IconChip icon={MessagesSquare} tone="ai" size="sm" className="-mt-0.5" />
          <div className="min-w-0">
            <h2 id="brief-voice-title" className="flex flex-wrap items-center gap-2 text-[15px] font-semibold leading-6 text-foreground">
              Your voice
              {voice?.locked ? (
                <StatusBadge tone="info" size="sm">
                  Set by you
                </StatusBadge>
              ) : null}
            </h2>
            <p className="text-[13px] text-muted-foreground">How the AI sounds when it writes for you.</p>
          </div>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {voice?.locked ? (
              <Button type="button" variant="ghost" size="sm" disabled={patch.isPending} onClick={reset}>
                <RotateCcw aria-hidden /> Use the website's voice
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden /> Edit
            </Button>
          </div>
        ) : null}
      </div>
      <dl className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">Tone</dt>
          <dd className="mt-1 text-sm text-foreground">{formality || warmth ? [formality, warmth].filter(Boolean).join(" · ") : "Not set"}</dd>
        </div>
        <TermsList label="Words it uses" terms={voice?.vocabulary ?? []} />
        <TermsList label="Words it avoids" terms={voice?.avoid ?? []} />
      </dl>
      {editing ? <VoiceDialog locationId={locationId} voice={voice} onClose={() => setEditing(false)} /> : null}
    </section>
  );
}

function TermsList({ label, terms }: { label: string; terms: readonly string[] }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        {terms.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {terms.map((term) => (
              <li key={term} className="rounded-full border border-border bg-surface-strong px-2.5 py-0.5 text-xs text-foreground">
                {term}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </dd>
    </div>
  );
}

function VoiceDialog({ locationId, voice, onClose }: { locationId: string; voice: BriefVoice | null | undefined; onClose: () => void }) {
  const { patch } = useBriefMutations(locationId);
  const [form, setForm] = useState<VoiceForm>(() => voiceForm(voice));
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formalityId = useId();
  const warmthId = useId();
  const vocabularyId = useId();
  const avoidId = useId();
  const errors = voiceErrors(form);
  const saving = patch.isPending;

  const set = (patchForm: Partial<VoiceForm>) => {
    setForm((current) => ({ ...current, ...patchForm }));
    setError(null);
  };

  const submit = () => {
    if (saving) return;
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    if (!voiceChanged(voice, form)) {
      onClose();
      return;
    }
    patch.mutate(
      { voice: voiceChange(form) },
      {
        onSuccess: () => {
          toast.success("Voice saved. The AI writes this way from now on, and rebuilds keep it.");
          onClose();
        },
        onError: (err) => setError(briefChangeErrorText(err).text),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your voice</DialogTitle>
          <DialogDescription>How the AI sounds when it writes for you. Your choice replaces what it read on your website.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <ChoiceRow<BriefFormality>
            id={formalityId}
            label="How formal"
            value={form.formality}
            options={FORMALITY_OPTIONS}
            copy={FORMALITY_COPY}
            disabled={saving}
            onChange={(value) => set({ formality: value })}
          />
          <ChoiceRow<BriefWarmth>
            id={warmthId}
            label="How warm"
            value={form.warmth}
            options={WARMTH_OPTIONS}
            copy={WARMTH_COPY}
            disabled={saving}
            onChange={(value) => set({ warmth: value })}
          />
          <div>
            <Label htmlFor={vocabularyId}>Words it uses</Label>
            <Input
              id={vocabularyId}
              className="mt-1.5"
              value={form.vocabulary}
              disabled={saving}
              placeholder="e.g. upfront, camera footage"
              aria-invalid={showErrors && errors.vocabulary ? true : undefined}
              aria-describedby={`${vocabularyId}-message`}
              onChange={(event) => set({ vocabulary: event.target.value })}
            />
            <FieldFoot id={`${vocabularyId}-message`} error={showErrors ? errors.vocabulary : undefined} hint={`Separate them with commas. ${termsOf(form.vocabulary).length} of 15.`} />
          </div>
          <div>
            <Label htmlFor={avoidId}>Words it avoids</Label>
            <Input
              id={avoidId}
              className="mt-1.5"
              value={form.avoid}
              disabled={saving}
              placeholder="e.g. cheapest, best in town"
              aria-invalid={showErrors && errors.avoid ? true : undefined}
              aria-describedby={`${avoidId}-message`}
              onChange={(event) => set({ avoid: event.target.value })}
            />
            <FieldFoot id={`${avoidId}-message`} error={showErrors ? errors.avoid : undefined} hint={`Separate them with commas. ${termsOf(form.avoid).length} of 10.`} />
          </div>
          {error ? <FormAlert>{error}</FormAlert> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
              {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A one-of-three choice that may start empty (the voice can have no tone yet). */
function ChoiceRow<T extends string>({
  id,
  label,
  value,
  options,
  copy,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: T | null;
  options: readonly T[];
  copy: Record<T, string>;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend id={`${id}-legend`} className="text-sm font-medium text-foreground">
        {label}
      </legend>
      <RadioGroup aria-labelledby={`${id}-legend`} value={value ?? ""} onValueChange={(next) => onChange(next as T)} className="mt-1.5 flex flex-wrap gap-2" disabled={disabled}>
        {options.map((option) => (
          <label
            key={option}
            htmlFor={`${id}-${option}`}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-card px-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-brand-tint/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <RadioGroupItem id={`${id}-${option}`} value={option} />
            {copy[option]}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
