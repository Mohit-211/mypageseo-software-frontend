import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { ErrorState } from "@/components/layout/shared/feedback/states";
import {
  FieldMessage,
  FormGrid,
  FormSelectField,
  FormTextField,
  RequiredFieldsNote,
} from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { getReportCreationOptions, type ReportType } from "@/lib/reports/reports";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";

const description =
  "Choose the report type, business context, reporting period and supported options, then review the configuration before generating.";



type FieldErrors = Partial<Record<"type" | "clientId" | "locationId" | "startDate" | "endDate", string>>;

const configSchema = z.object({
  type: z.string().trim().nonempty({ message: "Select a report type." }),
  clientId: z.string().trim(),
  locationId: z.string().trim().nonempty({ message: "Select a location." }),
  startDate: z.string().trim(),
  endDate: z.string().trim(),
});

function CreateReportPage() {
  const workspace = useWorkspace();
  const options = getReportCreationOptions();
  const isAgency = workspace.organization?.accountType === "agency";

  const [type, setType] = useState<ReportType | "">("");
  const [clientId, setClientId] = useState(workspace.activeClient?.id ?? "");
  const [locationId, setLocationId] = useState(workspace.activeLocation?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});



  const selectedType = options.types.find((option) => option.value === type) ?? null;

  const availableLocations = useMemo(() => {
    if (!isAgency || !clientId) return workspace.locations;
    return workspace.locations.filter((location) => location.clientId === clientId);
  }, [workspace.locations, isAgency, clientId]);

  const selectedLocation = availableLocations.find((location) => location.id === locationId) ?? null;
  const selectedClient = workspace.clients.find((client) => client.id === clientId) ?? null;

  if (workspace.status === "loading") {
    return (
      <AppShell>
        <div role="status" aria-live="polite" className="h-64 animate-pulse rounded-lg bg-muted" aria-label="Loading report configuration" />
      </AppShell>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <AppShell>
        <ErrorState
          description="We couldn't load your organisation, clients and locations, so a report can't be configured right now."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  const validate = () => {
    const result = configSchema.safeParse({ type, clientId, locationId, startDate, endDate });
    const next: FieldErrors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]) as keyof FieldErrors;
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (isAgency && !clientId) next.clientId = "Select a client.";
    if (selectedType?.supportsDateRange) {
      if (!startDate) next.startDate = "Select a start date.";
      if (!endDate) next.endDate = "Select an end date.";
      if (startDate && endDate && startDate > endDate) next.endDate = "End date must be after the start date.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    validate();
  };

  const generationBlocked = !options.canGenerate || !selectedType?.available;

  return (
    <AppShell>
      <PageHeader
        title="Create Report"
        description={description}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/reports">Back to reports</Link>
          </Button>
        }
      />

      <form className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={handleSubmit} noValidate>
        <div className="space-y-6">
          <Panel title="Report type" description="Choose what the report should contain.">
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Report type</legend>
              {options.types.map((option) => {
                const active = option.value === type;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-md border p-3 transition-colors",
                      active ? "border-primary bg-brand-tint" : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <input
                          type="radio"
                          name="report-type"
                          value={option.value}
                          checked={active}
                          onChange={() => { setType(option.value); setErrors({}); }}
                          className="accent-[color:var(--color-primary,#27424A)]"
                        />
                        {option.label}
                      </span>
                      {!option.available ? <StatusBadge tone="neutral">Unavailable</StatusBadge> : null}
                    </span>
                    <span className="pl-6 text-xs text-muted-foreground">{option.description}</span>
                    {!option.available && option.unavailableReason ? (
                      <span className="pl-6 text-xs text-muted-foreground">{option.unavailableReason}</span>
                    ) : null}
                  </label>
                );
              })}
            </fieldset>
            <FieldMessage error={errors.type} />
          </Panel>

          <Panel title="Business context" description={isAgency ? "Select the client and location this report covers." : "Select the location this report covers."}>
            <RequiredFieldsNote className="mb-4" />
            <FormGrid>
              {isAgency ? (
                <FormSelectField
                  id="client"
                  label="Client"
                  required
                  value={clientId}
                  placeholder="Select a client"
                  options={workspace.clients.map((client) => ({ value: client.id, label: client.name }))}
                  error={errors.clientId}
                  onChange={(value) => {
                    setClientId(value);
                    setLocationId("");
                  }}
                />
              ) : null}
              <FormSelectField
                id="location"
                label="Location"
                required
                value={locationId}
                disabled={availableLocations.length === 0}
                placeholder={availableLocations.length === 0 ? "No locations available" : "Select a location"}
                options={availableLocations.map((location) => ({
                  value: location.id,
                  label: `${location.businessName} — ${location.area}`,
                }))}
                error={errors.locationId}
                hint={
                  availableLocations.length === 0 ? (
                    <>
                      No locations are connected yet.{" "}
                      <Link to="/locations/add" className="text-primary underline">
                        Add a location
                      </Link>{" "}
                      first.
                    </>
                  ) : undefined
                }
                onChange={setLocationId}
              />
            </FormGrid>
          </Panel>

          {selectedType?.supportsDateRange ? (
            <Panel title="Reporting period" description="The period the report data should cover.">
              <FormGrid>
                <FormTextField
                  id="start-date"
                  label="Start date"
                  required
                  type="date"
                  value={startDate}
                  error={errors.startDate}
                  onChange={setStartDate}
                />
                <FormTextField
                  id="end-date"
                  label="End date"
                  required
                  type="date"
                  value={endDate}
                  error={errors.endDate}
                  onChange={setEndDate}
                />
              </FormGrid>
              {options.comparisonPeriods.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Comparison periods, keyword groups and report branding are not configurable until the reporting backend exposes them.
                </p>
              ) : null}
            </Panel>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Panel title="Summary" description="Check the configuration before generating.">
            <dl className="space-y-3 text-sm">
              <SummaryRow label="Report type" value={selectedType?.label ?? "Not selected"} />
              {isAgency ? <SummaryRow label="Client" value={selectedClient?.name ?? "Not selected"} /> : null}
              <SummaryRow
                label="Location"
                value={selectedLocation ? `${selectedLocation.businessName} — ${selectedLocation.area}` : "Not selected"}
              />
              {selectedType?.supportsDateRange ? (
                <SummaryRow label="Reporting period" value={startDate && endDate ? `${startDate} to ${endDate}` : "Not selected"} />
              ) : null}
            </dl>

            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <Button type="submit" className="w-full" disabled={generationBlocked}>
                Generate report
              </Button>
              {generationBlocked ? (
                <p className="text-xs text-muted-foreground">
                  {selectedType?.unavailableReason ??
                    "Report generation is not available in the current product integration, so this configuration cannot be submitted yet."}
                </p>
              ) : null}
            </div>
          </Panel>
        </aside>
      </form>
    </AppShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm text-foreground">{value}</dd>
    </div>
  );
}

export default CreateReportPage;
