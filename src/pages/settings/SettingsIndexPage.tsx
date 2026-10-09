import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrganization, getOrganizationUsage, updateOrganization } from "@/api";
import { classifyError } from "@/lib/mypageseo/errors";
import { RequireAccess } from "@/components/mypageseo/access";
import { Link } from "react-router-dom";
import { Building2, CreditCard, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, SectionHeader } from "@/components/layout/shared/data-display";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import {
  FormGrid,
  FormSaveBar,
  FormSelectField,
  FormTextField,
  RequiredFieldsNote,
} from "@/components/layout/shared/form-fields";
import {
  ORGANIZATION_COUNTRIES,
  ORGANIZATION_NAME_MAX_LENGTH,
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

const ORGANIZATION_KEY = ["organization"] as const;

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
      <GeneralSettings accountType={isAgency ? "agency" : "business"} />
    </AppShell>
  );
}

function GeneralSettings({ accountType }: { accountType: "business" | "agency" }) {
  const organization = useQuery({ queryKey: ORGANIZATION_KEY, queryFn: ({ signal }) => getOrganization(signal) });
  const usage = useQuery({ queryKey: [...ORGANIZATION_KEY, "usage"], queryFn: ({ signal }) => getOrganizationUsage(signal) });

  if (organization.isPending) return <TableSkeleton rows={5} columns={2} />;
  if (organization.isError) {
    return <ErrorState description={classifyError(organization.error).description} onRetry={() => void organization.refetch()} />;
  }

  const data = organization.data;
  const saved: OrganizationSettings = {
    organizationName: data.organization.name,
    country: data.organization.country === "US" || data.organization.country === "CA" ? data.organization.country : "",
  };

  return (
    <div className="space-y-6">
      <OrganizationForm key={`${saved.organizationName}|${saved.country}`} saved={saved} readOnly={data.role !== "owner"} />

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
          {usage.isPending ? (
            <TableSkeleton rows={1} columns={4} />
          ) : usage.isError ? (
            <ErrorState description="We couldn't load your plan and usage." onRetry={() => void usage.refetch()} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-4">
              <Field icon={Building2} label="Account type" value={accountType === "agency" ? "Agency" : "Business"} />
              <Field icon={CreditCard} label="Plan" value={usage.data.plan?.name ?? "No plan yet"} />
              <Field icon={MapPin} label="Locations" value={usedOf(usage.data.locations.used, usage.data.locations.limit)} />
              {usage.data.users ? <Field icon={Users} label="Users" value={usedOf(usage.data.users.used, usage.data.users.limit)} /> : null}
              {usage.data.clients ? <Field icon={Users} label="Clients" value={String(usage.data.clients.used)} /> : null}
            </dl>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Plan, location slots and invoices are managed on{" "}
            <Link to="/settings/billing" className="font-medium text-foreground underline underline-offset-2">Billing</Link>.
            {accountType === "agency" ? (
              <>
                {" "}Settings for an individual client are managed from that client&rsquo;s screens.{" "}
                <Link to="/clients" className="font-medium text-foreground underline underline-offset-2">Go to clients</Link>
              </>
            ) : null}
          </p>
        </Panel>
      </section>
    </div>
  );
}

function usedOf(used: number, limit: number | null) {
  return limit == null ? String(used) : `${used} of ${limit}`;
}

function OrganizationForm({ saved, readOnly }: { saved: OrganizationSettings; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<OrganizationSettings>(saved);
  const [errors, setErrors] = useState<OrganizationSettingsErrors>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = !settingsAreEqual(values, saved);
  const hasErrors = Object.keys(errors).length > 0;

  const update = <K extends keyof OrganizationSettings>(key: K, value: OrganizationSettings[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSavedAt(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (saving || readOnly) return;
    const nextErrors = validateOrganizationSettings(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !values.country) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await updateOrganization({ name: values.organizationName.trim(), country: values.country });
      queryClient.setQueryData(ORGANIZATION_KEY, result);
      // The workspace switcher reads organization names from the profile.
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setSaveError(classifyError(err).description);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {readOnly ? (
        <Panel className="border-l-4 border-l-brand-soft">
          <p className="text-sm text-muted-foreground">
            Only the organization owner can change these settings.
          </p>
        </Panel>
      ) : null}

      <section aria-labelledby="settings-organization">
        <SectionHeader title="Organization" description="Identity used across this workspace and on reports" />
        <Panel>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
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
                hint="Used for pricing and as the default when searching for new locations."
                options={ORGANIZATION_COUNTRIES}
                onChange={(value) => update("country", value as OrganizationSettings["country"])}
              />
            </FormGrid>

            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        </Panel>
      </section>

      <FormSaveBar
        dirty={dirty}
        saving={saving}
        hasErrors={hasErrors}
        savedAt={savedAt}
        error={saveError}
        disabled={readOnly}
        onSave={() => void handleSave()}
        onDiscard={() => {
          setValues(saved);
          setErrors({});
          setSavedAt(null);
          setSaveError(null);
        }}
        savedLabel="Settings saved"
      />
    </>
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
