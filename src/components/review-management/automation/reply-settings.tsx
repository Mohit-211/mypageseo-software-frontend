import { useState, type ReactNode } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/shared/data-display";
import { ConfirmDialog, FormField, SubmitButton } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  REPLY_LENGTH_LIMITS,
  REPLY_TONES,
  REPLY_TONE_LABEL,
  reviewActions,
  type ReplySettings as ReplySettingsValue,
  type ReplyTone,
} from "@/lib/reviews/review-management";

function ToggleRow({ id, label, description, checked, onChange }: { id: string; label: string; description: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  );
}

/** Reply defaults used by AI suggestions and automation. The parent remounts it (via `key`) per profile. */
export function ReplySettings({ locationId, settings }: { locationId: string; settings: ReplySettingsValue }) {
  const [draft, setDraft] = useState<ReplySettingsValue>(settings);
  const [lengthText, setLengthText] = useState(String(settings.maxLength));
  const [saving, setSaving] = useState(false);
  const [confirmApprovalOff, setConfirmApprovalOff] = useState(false);

  const length = Number(lengthText);
  const lengthError =
    !Number.isInteger(length) || length < REPLY_LENGTH_LIMITS.min || length > REPLY_LENGTH_LIMITS.max
      ? `Enter a whole number between ${REPLY_LENGTH_LIMITS.min} and ${REPLY_LENGTH_LIMITS.max}.`
      : null;
  const next: ReplySettingsValue = { ...draft, maxLength: lengthError ? settings.maxLength : length };
  const dirty = JSON.stringify(next) !== JSON.stringify(settings) || (lengthError !== null && lengthText !== String(settings.maxLength));

  const set = <K extends keyof ReplySettingsValue>(key: K, value: ReplySettingsValue[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (lengthError) return;
    setSaving(true);
    try {
      await reviewActions.saveReplySettings(locationId, next);
      toast.success("Reply settings saved", { description: "New AI replies will use these settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Reply Settings" description="Defaults for AI reply suggestions and automated replies">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Default Reply Tone" htmlFor="reply-default-tone">
            <Select value={draft.defaultTone} onValueChange={(v) => set("defaultTone", v as ReplyTone)}>
              <SelectTrigger id="reply-default-tone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPLY_TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REPLY_TONE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Maximum Reply Length" htmlFor="reply-max-length" error={lengthError} hint="Characters. Google allows up to 4,096.">
            <div className="relative">
              <Input
                id="reply-max-length"
                inputMode="numeric"
                value={lengthText}
                onChange={(e) => setLengthText(e.target.value.replace(/[^\d]/g, ""))}
                aria-invalid={lengthError ? true : undefined}
                aria-describedby="reply-max-length-message"
                className="pr-24"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">characters</span>
            </div>
          </FormField>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border p-4">
          <ToggleRow
            id="reply-include-business"
            label="Include Business Name"
            description="Sign replies with your business name."
            checked={draft.includeBusinessName}
            onChange={(v) => set("includeBusinessName", v)}
          />
          <ToggleRow
            id="reply-include-customer"
            label="Include Customer Name"
            description="Greet the reviewer by first name."
            checked={draft.includeCustomerName}
            onChange={(v) => set("includeCustomerName", v)}
          />
          <ToggleRow
            id="reply-require-approval"
            label="Require Approval"
            description="Hold every automated reply for approval, even for rules set to publish automatically. Replies to negative reviews always need approval."
            checked={draft.requireApproval}
            onChange={(v) => (v ? set("requireApproval", true) : setConfirmApprovalOff(true))}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || saving}
            onClick={() => {
              setDraft(settings);
              setLengthText(String(settings.maxLength));
            }}
          >
            Discard changes
          </Button>
          <SubmitButton pending={saving} disabled={!dirty || lengthError !== null} icon={<Save className="size-4" aria-hidden />}>
            Save Settings
          </SubmitButton>
        </div>
      </form>

      <ConfirmDialog
        open={confirmApprovalOff}
        onOpenChange={setConfirmApprovalOff}
        title="Turn off approval for automated replies?"
        description="Rules set to publish automatically will post AI replies to Google without review. Replies to negative reviews will still wait for approval. This takes effect when you save."
        confirmLabel="Turn Off Approval"
        destructive={false}
        onConfirm={() => {
          set("requireApproval", false);
          setConfirmApprovalOff(false);
        }}
      />
    </Panel>
  );
}
