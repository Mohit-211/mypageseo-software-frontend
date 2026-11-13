import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Coins, MapPin, Tags, UserRound, Users } from "lucide-react";
import { isApiError, updateOrganization, type OrganizationInfo, type OrganizationUsage } from "@/api";
import { organizationInfoKey, useOrganizationInfo } from "@/lib/mypageseo/organization-info";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { ErrorState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { FormGrid, FormSaveBar, FormSelectField, FormTextField } from "@/components/layout/shared/form-fields";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { useOrganizationUsage } from "@/lib/billing/use-billing";
import { formatDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
];

/**
 * `/settings`: organization settings for the owner (name and country, plus what the organization
 * uses). The settings layout sends everyone else to their profile.
 */
function SettingsIndexPage() {
  const organization = useOrganizationInfo();
  const usage = useOrganizationUsage();

  if (organization.isPending) {
    return (
      <div className="space-y-6">
        <SectionSkeleton lines={4} />
        <SectionSkeleton lines={2} />
      </div>
    );
  }
  if (organization.isError) {
    return <ErrorState title="The organization couldn't be loaded" description="Check your connection and try again." onRetry={() => void organization.refetch()} />;
  }
  return (
    <div className="space-y-6">
      <OrganizationForm key={organization.data.organization.id} info={organization.data} />
      {usage.data ? <UsageSection usage={usage.data} /> : null}
    </div>
  );
}

type OrganizationValues = { name: string; country: "US" | "CA" };

function OrganizationForm({ info }: { info: OrganizationInfo }) {
  const queryClient = useQueryClient();
  const initial: OrganizationValues = { name: info.organization.name, country: info.organization.country === "CA" ? "CA" : "US" };
  const [saved, setSaved] = useState<OrganizationValues>(initial);
  const [values, setValues] = useState<OrganizationValues>(initial);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = values.name.trim() !== saved.name || values.country !== saved.country;
  const agency = info.organization.type === "agency";

  const update = (patch: Partial<OrganizationValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setNameError(null);
    setSavedAt(null);
    setSaveError(null);
  };

  const save = () => {
    if (saving) return;
    if (values.name.trim().length < 2) {
      setNameError("Enter at least 2 characters.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    void updateOrganization({ name: values.name.trim(), country: values.country })
      .then((result) => {
        queryClient.setQueryData(organizationInfoKey(info.organization.id), result);
        void queryClient.invalidateQueries({ queryKey: ["profile"] });
        const next = { name: values.name.trim(), country: values.country };
        setSaved(next);
        setValues(next);
        setSavedAt(new Date().toLocaleTimeString());
      })
      .catch((err: unknown) => setSaveError(isApiError(err) && err.reason === "owner_only" ? "Only the account owner can change this." : "The organization couldn't be saved. Try again."))
      .finally(() => setSaving(false));
  };

  return (
    <>
      <Panel title="Organization details" description="Shown on invoices, invitations and your team's screens." icon={Building2} tone="settings">
        <form
          noValidate
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <FormGrid>
            <FormTextField id="org-name" label="Name" required maxLength={100} value={values.name} error={nameError} disabled={saving} onChange={(name) => update({ name })} />
            <FormSelectField
              id="org-country"
              label="Country"
              value={values.country}
              options={COUNTRIES}
              disabled={saving}
              hint="Sets the currency (US: USD, Canada: CAD) and where new locations are searched."
              onChange={(country) => update({ country: country === "CA" ? "CA" : "US" })}
            />
          </FormGrid>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-surface-strong px-3.5 py-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Account type</span>
              <StatusBadge tone="brand">{agency ? "Agency" : "Business"}</StatusBadge>
            </span>
            <span className="text-muted-foreground">
              Created <span className="font-medium text-foreground">{formatDate(info.organization.created_at)}</span>
            </span>
            <span className="text-xs text-muted-foreground">The account type can't be changed.</span>
          </div>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Panel>
      {/* The save bar appears once there is something to save (or a result to report). */}
      {dirty || saving || savedAt || saveError || nameError ? (
        <FormSaveBar
          dirty={dirty}
          saving={saving}
          hasErrors={Boolean(nameError)}
          savedAt={savedAt}
          error={saveError}
          onSave={save}
          onDiscard={() => {
            setValues(saved);
            setNameError(null);
            setSaveError(null);
          }}
          savedLabel="Organization saved"
        />
      ) : null}
    </>
  );
}

/** A used-of-limit bar; amber once it's nearly full, so running out is never a surprise. */
function Meter({ used, limit, label }: { used: number; limit: number; label: string }) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={used}
      className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <span className={cn("block h-full rounded-full", ratio >= 0.9 ? "bg-warning" : "bg-primary")} style={{ width: `${ratio * 100}%` }} />
    </span>
  );
}

function UsageHint({ children, meter }: { children: ReactNode; meter?: ReactNode }) {
  return (
    <>
      {meter}
      <span className="mt-2 block">{children}</span>
    </>
  );
}

function UsageSection({ usage }: { usage: OrganizationUsage }) {
  return (
    <section aria-labelledby="org-usage-title" className="space-y-3">
      <div>
        <h2 id="org-usage-title" className="text-base font-semibold tracking-tight text-foreground">
          What you use
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{usage.plan?.name ? `${usage.plan.name} plan.` : "Your plan."} Limits grow with the locations you pay for.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Locations"
          icon={MapPin}
          tone="locations"
          value={`${usage.locations.used} of ${usage.locations.limit}`}
          to="/locations"
          hint={
            <UsageHint meter={<Meter used={usage.locations.used} limit={usage.locations.limit} label="Locations used" />}>
              Up to {usage.locations.max} on this plan
            </UsageHint>
          }
        />
        <KpiTile
          label="Users"
          // Not the Clients glyph (Users), which sits in the tile beside it for agencies.
          icon={UserRound}
          tone="clients"
          value={`${usage.users.used} of ${usage.users.limit}`}
          to="/settings/team"
          hint={
            <UsageHint meter={<Meter used={usage.users.used} limit={usage.users.limit} label="Users" />}>3 per paid location, owner included</UsageHint>
          }
        />
        <KpiTile
          label="Keywords"
          icon={Tags}
          tone="keywords"
          value={usage.keywords.limit ? `${usage.keywords.used} of ${usage.keywords.limit}` : usage.keywords.used}
          hint={<UsageHint>Up to 20 per location</UsageHint>}
        />
        {usage.clients ? (
          <KpiTile label="Clients" icon={Users} tone="clients" value={usage.clients.used} to="/clients" hint={<UsageHint>An optional way to group locations</UsageHint>} />
        ) : (
          <KpiTile label="Tokens" icon={Coins} tone="brand" value={usage.tokens.balance} to="/settings/billing#tokens" hint={<UsageHint>For manual refreshes and AI actions</UsageHint>} />
        )}
      </div>
    </section>
  );
}

export default SettingsIndexPage;
