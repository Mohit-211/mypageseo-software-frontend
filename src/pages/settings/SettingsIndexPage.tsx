import { useState } from "react";
import { RequireAccess } from "@/components/mypageseo/access";
import { Link } from "react-router-dom";
import { Building2, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, SectionHeader } from "@/components/layout/shared/data-display";
import { SettingsNav } from "@/components/settings/settings-nav";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import {
  FormGrid,
  FormSaveBar,
  FormSelectField,
  FormTextField,
  RequiredFieldsNote,
} from "@/components/layout/shared/form-fields";
import { countries } from "@/lib/mock-data/countries";
import {
  ORGANIZATION_NAME_MAX_LENGTH,
  REPORT_COMPARISON_PERIODS,
  SUPPORTED_TIMEZONES,
  getOrganizationSettings,
  settingsAreEqual,
  validateOrganizationSettings,
  type OrganizationSettings,
  type OrganizationSettingsErrors,
} from "@/lib/mypageseo/organization-settings";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const SettingsIndexPage = () => (
    <RequireAccess permission="settings.manage">
      <SettingsPage />
    </RequireAccess>
  );

const DESCRIPTION = "Organization administrators manage the configuration of this Mypageseo organization here.";

function SettingsPage() {
  const workspace = useWorkspace();
  const organization = workspace.organization;
  const isAgency = organization?.accountType === "agency";

  if (workspace.status === "loading") {
    return (
      <AppShell>
        <PageHeader title="Settings" description={DESCRIPTION} />
        <SettingsNav active="general" isAgency={false} />
        <TableSkeleton rows={5} columns={2} />
      </AppShell>
    );
  }

  if (workspace.status === "unavailable" || !organization) {
    return (
      <AppShell>
        <PageHeader title="Settings" description={DESCRIPTION} />
        <SettingsNav active="general" isAgency={false} />
        <ErrorState
          description="We couldn't load your organization. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Settings" description={DESCRIPTION} />
      <SettingsNav active="general" isAgency={isAgency} />
      <GeneralSettings
        accountType={isAgency ? "agency" : "business"}
        locationCount={workspace.locations.length}
        clientCount={workspace.clients.length}
      />
    </AppShell>
  );
}

function GeneralSettings({
  accountType,
  locationCount,
  clientCount,
}: {
  accountType: "business" | "agency";
  locationCount: number;
  clientCount: number;
}) {
  const result = getOrganizationSettings(accountType);
  const saved = result.status === "ready" ? result.settings : null;

  const [values, setValues] = useState<OrganizationSettings | null>(saved);
  const [errors, setErrors] = useState<OrganizationSettingsErrors>({});
  const [baseline, setBaseline] = useState<OrganizationSettings | null>(saved);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (result.status === "loading") return <TableSkeleton rows={5} columns={2} />;

  if (result.status === "error") {
    return <ErrorState description={result.message} onRetry={() => window.location.reload()} />;
  }

  if (result.status === "unavailable") {
    return <EmptyState title="Organization settings are unavailable" description={result.reason} />;
  }

  if (!values || !baseline) return <TableSkeleton rows={5} columns={2} />;

  const capabilities = result.capabilities;
  const readOnly = !capabilities.canEdit;
  const dirty = !settingsAreEqual(values, baseline);
  const hasErrors = Object.keys(errors).length > 0;

  const update = <K extends keyof OrganizationSettings>(key: K, value: OrganizationSettings[K]) => {
    setValues((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSavedAt(null);
    setSaveError(null);
  };

  const handleSave = () => {
    if (saving || readOnly) return;
    const nextErrors = validateOrganizationSettings(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!capabilities.canSave) {
      setSaveError("Saving organization settings requires the settings service, which isn't connected yet.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    window.setTimeout(() => {
      const normalized = { ...values, organizationName: values.organizationName.trim() };
      setValues(normalized);
      setBaseline(normalized);
      setSaving(false);
      setSavedAt(new Date().toLocaleTimeString());
    }, 500);
  };

  const handleReset = () => {
    setValues(baseline);
    setErrors({});
    setSavedAt(null);
    setSaveError(null);
  };

  return (
    <div className="space-y-6">
      {readOnly ? (
        <Panel className="border-l-4 border-l-brand-soft">
          <p className="text-sm text-muted-foreground">
            You have read-only access to organization settings. Ask an organization administrator to make changes.
          </p>
        </Panel>
      ) : null}

      <section aria-labelledby="settings-organization">
        <SectionHeader title="Organization" description="Identity and locale used across this workspace" />
        <Panel>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
            noValidate
          >
            <RequiredFieldsNote />
            <FormGrid>
              <FormTextField
                id="organization-name"
                label="Organization name"
                required
                className="sm:col-span-2 sm:max-w-md"
                value={values.organizationName}
                maxLength={ORGANIZATION_NAME_MAX_LENGTH + 20}
                disabled={readOnly || saving}
                error={errors.organizationName}
                hint="Shown in the workspace switcher and on generated reports."
                onChange={(value) => update("organizationName", value)}
              />

              <FormSelectField
                id="organization-country"
                label="Country"
                required
                value={values.country}
                disabled={readOnly || saving}
                error={errors.country}
                hint="Primary country of the organization."
                options={countries.map((c) => ({ value: c.code, label: c.name }))}
                onChange={(value) => update("country", value)}
              />

              <FormSelectField
                id="organization-timezone"
                label="Timezone"
                required
                value={values.timezone}
                disabled={readOnly || saving}
                error={errors.timezone}
                hint="Used for dates, schedules and report delivery times."
                options={SUPPORTED_TIMEZONES.map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }))}
                onChange={(value) => update("timezone", value)}
              />
            </FormGrid>

            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        </Panel>
      </section>

      <section aria-labelledby="settings-defaults">
        <SectionHeader
          title="Defaults"
          description="Applied to new locations and reports only — existing records keep their current settings"
        />
        <Panel>
          <FormGrid>
            <FormSelectField
              id="default-location-country"
              label="Default country for new locations"
              required
              value={values.defaultLocationCountry}
              disabled={readOnly || saving}
              error={errors.defaultLocationCountry}
              hint="Pre-selected when adding a location. Existing locations are unchanged."
              options={countries.map((c) => ({ value: c.code, label: c.name }))}
              onChange={(value) => update("defaultLocationCountry", value)}
            />
            <FormSelectField
              id="default-comparison-period"
              label="Default report comparison period"
              required
              value={values.defaultReportComparisonPeriod}
              disabled={readOnly || saving}
              error={errors.defaultReportComparisonPeriod}
              hint="Pre-selected on new reports. Existing and scheduled reports are unchanged."
              options={REPORT_COMPARISON_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
              onChange={(value) => update("defaultReportComparisonPeriod", value)}
            />
          </FormGrid>
        </Panel>
      </section>

      <section aria-labelledby="settings-structure">
        <SectionHeader
          title="Account structure"
          description={
            accountType === "agency"
              ? "Agency-level overview. Client-specific configuration lives on each client."
              : "Locations managed under this business account."
          }
        />
        <Panel>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Field icon={Building2} label="Account type" value={accountType === "agency" ? "Agency" : "Business"} />
            <Field icon={MapPin} label="Locations" value={String(locationCount)} />
            {accountType === "agency" ? <Field icon={Users} label="Clients" value={String(clientCount)} /> : null}
          </dl>
          {accountType === "agency" ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Settings for an individual client are managed from that client&rsquo;s screens.{" "}
              <Link to="/clients" className="font-medium text-foreground underline underline-offset-2">
                Go to clients
              </Link>
            </p>
          ) : null}
        </Panel>
      </section>

      <FormSaveBar
        dirty={dirty}
        saving={saving}
        hasErrors={hasErrors}
        savedAt={savedAt}
        error={saveError}
        disabled={readOnly}
        onSave={handleSave}
        onDiscard={handleReset}
        savedLabel="Settings saved"
      />
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon?: typeof Building2; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default SettingsIndexPage;
