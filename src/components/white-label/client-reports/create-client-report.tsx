import { useState } from "react";
import { FormAlert, FormField, FormSelectField, SubmitButton } from "@/components/layout/shared/form-fields";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  REPORT_MODULES,
  REPORT_MODULE_LABEL,
  whiteLabelActions,
  type AgencyClient,
  type ClientReport,
  type CreateClientReportInput,
  type ReportBrandingMode,
  type ReportModule,
} from "@/lib/white-label/white-label";

const DEFAULT_MODULES: ReportModule[] = ["gbp", "ai_visibility", "reviews"];
const PASSWORD_MIN_LENGTH = 8;

type Errors = Partial<Record<"clientId" | "modules" | "password", string>>;

function OptionRow({ id, value, label, description, disabled }: { id: string; value: string; label: string; description?: string; disabled?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <RadioGroupItem id={id} value={value} disabled={disabled ?? false} className="mt-0.5" />
      <Label htmlFor={id} className={disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{description}</span> : null}
      </Label>
    </div>
  );
}

/**
 * Create Client Report. The parent remounts it (via `key`) for each open so
 * fields start fresh. New reports are saved as drafts, to preview then publish.
 */
export function CreateClientReport({
  open,
  onOpenChange,
  clients,
  reports,
  brandingConfigured,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: AgencyClient[];
  reports: ClientReport[];
  brandingConfigured: boolean;
  onCreated: (report: ClientReport) => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [modules, setModules] = useState<ReportModule[]>(DEFAULT_MODULES);
  const [visibility, setVisibility] = useState<CreateClientReportInput["visibility"]>("public");
  const [password, setPassword] = useState("");
  const [branding, setBranding] = useState<ReportBrandingMode>(brandingConfigured ? "agency" : "default");
  const [errors, setErrors] = useState<Errors>({});
  const { pending, run } = useSubmitGuard();

  const existing = reports.find((r) => r.clientId === clientId);

  const toggleModule = (module: ReportModule, checked: boolean) => {
    setModules((current) => (checked ? [...current, module] : current.filter((m) => m !== module)));
    setErrors((e) => ({ ...e, modules: undefined }));
  };

  const submit = () => {
    const next: Errors = {};
    if (!clientId) next.clientId = "Select a client.";
    if (modules.length === 0) next.modules = "Choose at least one report type.";
    if (visibility === "password" && password.length < PASSWORD_MIN_LENGTH) next.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void run(async () => {
      const report = await whiteLabelActions.createClientReport({
        clientId,
        modules,
        visibility,
        password: visibility === "password" ? password : null,
        branding,
      });
      onCreated(report);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Client Report</DialogTitle>
          <DialogDescription>Choose what the client sees. The report is saved as a draft so you can preview it before publishing.</DialogDescription>
        </DialogHeader>

        <form
          id="create-client-report"
          noValidate
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormSelectField
            id="report-client"
            label="Select Client"
            required
            value={clientId}
            onChange={(value) => {
              setClientId(value);
              setErrors((e) => ({ ...e, clientId: undefined }));
            }}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            error={errors.clientId}
            hint={existing ? "This client already has a report. Creating a new one replaces it and keeps the same link." : undefined}
          />

          <fieldset>
            <legend className="text-[13px] font-medium text-foreground">
              Report Type<span className="ml-0.5 text-critical" aria-hidden>*</span>
            </legend>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              {REPORT_MODULES.map((module) => (
                <div key={module} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`module-${module}`}
                    checked={modules.includes(module)}
                    onCheckedChange={(checked) => toggleModule(module, checked === true)}
                    aria-describedby="report-modules-message"
                  />
                  <Label htmlFor={`module-${module}`} className="cursor-pointer text-sm font-normal text-foreground">
                    {REPORT_MODULE_LABEL[module]}
                  </Label>
                </div>
              ))}
            </div>
            {errors.modules ? (
              <p id="report-modules-message" role="alert" className="mt-1.5 text-xs font-medium text-critical">
                {errors.modules}
              </p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="text-[13px] font-medium text-foreground">Report Visibility</legend>
            <RadioGroup
              className="mt-2 gap-2.5"
              value={visibility}
              onValueChange={(value) => {
                setVisibility(value as CreateClientReportInput["visibility"]);
                setErrors((e) => ({ ...e, password: undefined }));
              }}
            >
              <OptionRow id="visibility-public" value="public" label="Public Link" description="Anyone with the link can open the report." />
              <OptionRow id="visibility-password" value="password" label="Password Protected" description="Clients enter a password before viewing." />
            </RadioGroup>
            {visibility === "password" ? (
              <FormField label="Password" htmlFor="report-password" required error={errors.password} hint={`At least ${PASSWORD_MIN_LENGTH} characters. Share it with your client separately.`} className="mt-3">
                <Input
                  id="report-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby="report-password-message"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((er) => ({ ...er, password: undefined }));
                  }}
                />
              </FormField>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="text-[13px] font-medium text-foreground">Branding</legend>
            <RadioGroup className="mt-2 gap-2.5" value={branding} onValueChange={(value) => setBranding(value as ReportBrandingMode)}>
              <OptionRow
                id="branding-agency"
                value="agency"
                label="Use Agency Branding"
                description={brandingConfigured ? "Your logo, colours and agency details." : "Configure branding first to use it on reports."}
                disabled={!brandingConfigured}
              />
              <OptionRow id="branding-default" value="default" label="Use Default Branding" description="A neutral theme with your agency name only." />
            </RadioGroup>
          </fieldset>

          {!brandingConfigured ? <FormAlert tone="info">Set up agency branding to give reports your logo and colours.</FormAlert> : null}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <SubmitButton form="create-client-report" pending={pending} pendingLabel="Creating…">
            Create Report
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
