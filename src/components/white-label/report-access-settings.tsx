import { useState } from "react";
import { format, addDays } from "date-fns";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/shared/data-display";
import { SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { FormField, FormGrid, SubmitButton } from "@/components/layout/shared/form-fields";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  REPORT_EXPIRATION_LABEL,
  whiteLabelActions,
  type ReportAccessSettings as ReportAccessSettingsModel,
  type ReportExpiration,
  type ReportVisibility,
} from "@/lib/white-label/white-label";
import { useNow } from "@/hooks/use-now";

const PASSWORD_MIN_LENGTH = 8;

const VISIBILITY_OPTIONS: { value: ReportVisibility; label: string; description: string }[] = [
  { value: "public", label: "Public", description: "Anyone with the link can view the report." },
  { value: "password", label: "Password Protected", description: "Clients enter a password before viewing." },
  { value: "private", label: "Private", description: "Only your team can open the report. Links shared with clients stop working." },
];

type Errors = Partial<Record<"password" | "confirm" | "customExpiresOn", string>>;

function ToggleRow({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Report Access: agency defaults for how clients reach their reports. */
export function ReportAccessSettings({ settings }: { settings: ReportAccessSettingsModel }) {
  const [draft, setDraft] = useState(settings);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const { pending, run } = useSubmitGuard();
  const now = useNow();
  const minExpiry = format(addDays(new Date(now), 1), "yyyy-MM-dd");

  // A saved password protection doesn't require re-entering the password.
  const passwordRequired = draft.visibility === "password" && settings.visibility !== "password";

  const update = <K extends keyof ReportAccessSettingsModel>(key: K, value: ReportAccessSettingsModel[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    const next: Errors = {};
    if (draft.visibility === "password" && (passwordRequired || password || confirm)) {
      if (password.length < PASSWORD_MIN_LENGTH) next.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
      else if (password !== confirm) next.confirm = "Passwords don't match.";
    }
    if (draft.expiration === "custom" && !draft.customExpiresOn) next.customExpiresOn = "Choose an expiration date.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void run(async () => {
      await whiteLabelActions.updateReportAccess({
        ...draft,
        customExpiresOn: draft.expiration === "custom" ? draft.customExpiresOn : null,
        password: draft.visibility === "password" && password ? password : null,
      });
      setPassword("");
      setConfirm("");
      toast.success("Report access settings saved.");
    });
  };

  return (
    <Panel title="Report Access" description="Default access for client reports. Applies to new and existing report links.">
      <form
        noValidate
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset>
          <legend className="text-[13px] font-medium text-foreground">Visibility</legend>
          <RadioGroup className="mt-2 gap-2" value={draft.visibility} onValueChange={(value) => update("visibility", value as ReportVisibility)}>
            {VISIBILITY_OPTIONS.map((option) => (
              <Label
                key={option.value}
                htmlFor={`access-${option.value}`}
                className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-brand-tint"
              >
                <RadioGroupItem id={`access-${option.value}`} value={option.value} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>

        {draft.visibility === "password" ? (
          <FormGrid>
            <FormField
              label="Password"
              htmlFor="access-password"
              required={passwordRequired}
              error={errors.password}
              hint={passwordRequired ? `At least ${PASSWORD_MIN_LENGTH} characters.` : "Leave blank to keep the current password."}
            >
              <Input
                id="access-password"
                type="password"
                autoComplete="new-password"
                value={password}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby="access-password-message"
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <FormField label="Confirm Password" htmlFor="access-confirm" required={passwordRequired} error={errors.confirm}>
              <Input
                id="access-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                aria-invalid={errors.confirm ? true : undefined}
                aria-describedby="access-confirm-message"
                onChange={(e) => setConfirm(e.target.value)}
              />
            </FormField>
          </FormGrid>
        ) : null}

        <fieldset>
          <legend className="text-[13px] font-medium text-foreground">Expiration</legend>
          <RadioGroup className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" value={draft.expiration} onValueChange={(value) => update("expiration", value as ReportExpiration)}>
            {(Object.keys(REPORT_EXPIRATION_LABEL) as ReportExpiration[]).map((value) => (
              <Label
                key={value}
                htmlFor={`expires-${value}`}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-normal text-foreground has-data-[state=checked]:border-primary has-data-[state=checked]:bg-brand-tint"
              >
                <RadioGroupItem id={`expires-${value}`} value={value} />
                {REPORT_EXPIRATION_LABEL[value]}
              </Label>
            ))}
          </RadioGroup>
          {draft.expiration === "custom" ? (
            <FormField label="Expires on" htmlFor="access-expires-on" required error={errors.customExpiresOn} className="mt-3 sm:max-w-xs">
              <Input
                id="access-expires-on"
                type="date"
                min={minExpiry}
                value={draft.customExpiresOn ?? ""}
                aria-invalid={errors.customExpiresOn ? true : undefined}
                aria-describedby="access-expires-on-message"
                onChange={(e) => update("customExpiresOn", e.target.value || null)}
              />
            </FormField>
          ) : null}
        </fieldset>

        <div className="divide-y divide-border border-y border-border">
          <ToggleRow
            id="allow-download"
            label="Allow Download"
            description="Clients can download the report as a PDF."
            checked={draft.allowDownload}
            onChange={(checked) => update("allowDownload", checked)}
          />
          <ToggleRow
            id="allow-sharing"
            label="Allow Client Sharing"
            description="Clients can forward the report link to their own team."
            checked={draft.allowClientSharing}
            onChange={(checked) => update("allowClientSharing", checked)}
          />
        </div>

        <div className="flex justify-end">
          <SubmitButton pending={pending} icon={<Save aria-hidden />} className="w-full sm:w-auto">
            Save Settings
          </SubmitButton>
        </div>
      </form>
    </Panel>
  );
}

export function ReportAccessSkeleton() {
  return <SectionSkeleton lines={8} />;
}
