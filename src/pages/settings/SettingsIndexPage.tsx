import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, Save } from "lucide-react";
import { isApiError, updateOrganization, type OrganizationInfo } from "@/api";
import { organizationInfoKey, useOrganizationInfo } from "@/lib/mypageseo/organization-info";
import { RequireAccess } from "@/components/mypageseo/access";
import { AppShell } from "@/components/layout/shared/app-shell";
import { MetricCard, PageHeader, Panel } from "@/components/layout/shared/data-display";
import { ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useOrganizationUsage } from "@/lib/billing/use-billing";

/** Organization settings (owner): name and country, plus what the organization uses. */
const SettingsIndexPage = () => (
  <RequireAccess permission="settings.manage">
    <OrganizationSettingsPage />
  </RequireAccess>
);

function OrganizationSettingsPage() {
  const workspace = useWorkspace();
  const organization = useOrganizationInfo();
  const usage = useOrganizationUsage();

  return (
    <AppShell>
      <PageHeader title="Organization" description="Your organization's name and country." />
      <SettingsNav active="general" isAgency={workspace.organization?.accountType === "agency"} />
      {organization.isPending ? (
        <PageSkeleton />
      ) : organization.isError ? (
        <ErrorState description="The organization couldn't be loaded." onRetry={() => void organization.refetch()} />
      ) : (
        <div className="space-y-6">
          <OrganizationForm info={organization.data} />
          {usage.data ? (
            <Panel title="Usage">
              <section className="-m-4 grid sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border">
                <MetricCard label="Locations" value={`${usage.data.locations.used} of ${usage.data.locations.limit}`} caption={`Up to ${usage.data.locations.max} on this plan`} />
                <MetricCard label="Users" value={`${usage.data.users.used} of ${usage.data.users.limit}`} caption="3 per paid location, owner included" />
                <MetricCard label="Keywords" value={usage.data.keywords.used} caption="Up to 20 per location" />
                {usage.data.clients ? <MetricCard label="Clients" value={usage.data.clients.used} caption="Optional grouping" /> : <MetricCard label="Tokens" value={usage.data.tokens.balance} caption="For manual refreshes and AI" />}
              </section>
            </Panel>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function OrganizationForm({ info }: { info: OrganizationInfo }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(info.organization.name);
  const [country, setCountry] = useState<"US" | "CA">(info.organization.country === "CA" ? "CA" : "US");
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== info.organization.name || country !== info.organization.country;

  const save = () => {
    setSaving(true);
    void updateOrganization({ name: name.trim(), country })
      .then((result) => {
        queryClient.setQueryData(organizationInfoKey(info.organization.id), result);
        void queryClient.invalidateQueries({ queryKey: ["profile"] });
        toast.success("Organization saved.");
      })
      .catch((err: unknown) => toast.error(isApiError(err) && err.reason === "owner_only" ? "Only the account owner can change this." : "The organization couldn't be saved."))
      .finally(() => setSaving(false));
  };

  return (
    <Panel title="Details" description={`${info.organization.type === "agency" ? "Agency" : "Business"} account. The account type can't be changed.`}>
      <fieldset disabled={saving} className="grid max-w-xl gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Name</Label>
          <Input id="org-name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={country} onValueChange={(value) => setCountry(value as "US" | "CA")}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Button disabled={!dirty || name.trim().length < 2 || saving} onClick={save}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <Save aria-hidden />} Save
          </Button>
        </div>
      </fieldset>
      <p className="mt-3 text-xs text-muted-foreground">The country sets the currency (US: USD, Canada: CAD) and where new locations are searched.</p>
    </Panel>
  );
}

export default SettingsIndexPage;
