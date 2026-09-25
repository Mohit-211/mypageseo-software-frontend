import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel, StatusBadge } from "@/components/mypageseo/data-display";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  FieldMessage,
  FormSelectField,
  FormTextField,
  FormTextareaField,
  RequiredFieldsNote,
  SubmitButton,
} from "@/components/mypageseo/form";
import {
  AUTOMATION_FREQUENCY_LABEL,
  AUTOMATION_REPORT_TYPES,
  AUTOMATION_RUN_LABEL,
  AUTOMATION_RUN_TONE,
  AUTOMATION_STATUS_LABEL,
  AUTOMATION_STATUS_TONE,
  AUTOMATION_TYPE_CONFIG,
  AUTOMATION_TYPE_DESCRIPTION,
  AUTOMATION_TYPE_LABEL,
  DAYS_OF_WEEK,
  REVIEW_RATING_THRESHOLDS,
  buildAutomationSummary,
  describeSchedule,
  formatAutomationDate,
  validateAutomationForm,
  type Automation,
  type AutomationFormErrors,
  type AutomationFormValues,
  type AutomationFrequency,
  type AutomationType,
  type AutomationsCapabilities,
} from "@/lib/mypageseo/automations";
import type { Client, LocationSummary } from "@/lib/mypageseo/workspace";

function FieldError({ message }: { message?: string | undefined }) {
  return <FieldMessage error={message} />;
}

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border px-4 py-5 first:border-t-0 sm:px-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

export function AutomationForm({
  mode,
  initialValues,
  automation,
  capabilities,
  accountType,
  clients,
  locations,
}: {
  mode: "create" | "edit";
  initialValues: AutomationFormValues;
  automation?: Automation | null;
  capabilities: AutomationsCapabilities;
  accountType: "business" | "agency";
  clients: Client[];
  locations: LocationSummary[];
}) {
  const navigate = useNavigate();
  const isAgency = accountType === "agency";

  const [values, setValues] = useState<AutomationFormValues>(initialValues);
  const [errors, setErrors] = useState<AutomationFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(automation?.status ?? "active");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [values, initialValues],
  );

  const config = values.type ? AUTOMATION_TYPE_CONFIG[values.type] : null;

  const availableLocations = useMemo(() => {
    if (!isAgency) return locations;
    if (!values.clientId) return [];
    return locations.filter((location) => location.clientId === values.clientId);
  }, [isAgency, locations, values.clientId]);

  const selectedLocation = locations.find((location) => location.id === values.locationId) ?? null;
  const selectedClient = clients.find((client) => client.id === values.clientId) ?? null;

  const summary = useMemo(
    () =>
      buildAutomationSummary(values, {
        locationName: selectedLocation ? `${selectedLocation.businessName} — ${selectedLocation.area}` : null,
        clientName: isAgency ? selectedClient?.name ?? null : null,
      }),
    [values, selectedLocation, selectedClient, isAgency],
  );

  const validation = validateAutomationForm(values, { requireClient: isAgency });
  const valid = Object.keys(validation).length === 0;
  const canSubmit = valid && !saving && (mode === "create" ? capabilities.canCreate : capabilities.canEdit && dirty);

  function update<K extends keyof AutomationFormValues>(key: K, value: AutomationFormValues[K]) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "type") {
        const typeConfig = value ? AUTOMATION_TYPE_CONFIG[value as AutomationType] : null;
        next.frequency = typeConfig?.frequencies[0] ?? "";
      }
      if (key === "clientId") next.locationId = "";
      return next;
    });
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateAutomationForm(values, { requireClient: isAgency });
    setErrors(found);
    if (Object.keys(found).length > 0 || saving) return;
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSaving(false);
    if (mode === "create") {
      toast.success("Automation created", { description: `${values.name} is now ${AUTOMATION_STATUS_LABEL.active.toLowerCase()}.` });
      void navigate("/automations");
    } else {
      toast.success("Automation updated", { description: "Configuration changes were saved." });
      void navigate("/automations");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <form onSubmit={handleSubmit} className="grid gap-5">
        <Panel className="p-0">
          <div className="divide-y divide-border">
            {mode === "create" ? (
              <Group
                title="Automation type"
                description="Only tasks Mypageseo can actually execute are listed."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {capabilities.availableTypes.map((type) => {
                    const selected = values.type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => update("type", type)}
                        className={`rounded-md border px-3 py-3 text-left transition-colors ${
                          selected
                            ? "border-primary bg-brand-tint"
                            : "border-border bg-surface hover:border-primary/40"
                        }`}
                      >
                        <span className="block text-sm font-medium text-foreground">
                          {AUTOMATION_TYPE_LABEL[type]}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {AUTOMATION_TYPE_DESCRIPTION[type]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <FieldError message={errors.type} />
              </Group>
            ) : null}

            {config ? (
              <>
                <Group title="Details">
                  <RequiredFieldsNote className="mb-3" />
                  <FormTextField
                    id="automation-name"
                    label="Automation name"
                    required
                    value={values.name}
                    maxLength={80}
                    disabled={saving}
                    placeholder={`${AUTOMATION_TYPE_LABEL[values.type as AutomationType]}`}
                    error={errors.name}
                    onChange={(value) => update("name", value)}
                  />
                </Group>

                <Group
                  title="Where it runs"
                  description={
                    isAgency
                      ? "Select the client and one of its locations."
                      : "Select the location this automation operates on."
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    {isAgency ? (
                      <FormSelectField
                        id="automation-client"
                        label="Client"
                        required
                        value={values.clientId}
                        disabled={saving}
                        placeholder="Select client"
                        options={clients.map((client) => ({ value: client.id, label: client.name }))}
                        error={errors.clientId}
                        onChange={(value) => update("clientId", value)}
                      />
                    ) : null}
                    <FormSelectField
                      id="automation-location"
                      label="Location"
                      required
                      value={values.locationId}
                      disabled={saving || (isAgency && !values.clientId)}
                      placeholder={isAgency && !values.clientId ? "Select a client first" : "Select location"}
                      options={availableLocations.map((location) => ({
                        value: location.id,
                        label: `${location.businessName} — ${location.area}`,
                      }))}
                      error={errors.locationId}
                      onChange={(value) => update("locationId", value)}
                    />
                  </div>
                </Group>

                <Group
                  title={config.trigger === "event" ? "Trigger" : "Schedule"}
                  description={config.trigger === "event" ? config.eventDescription ?? undefined : undefined}
                >
                  {config.trigger === "recurring" ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <FormSelectField
                        id="automation-frequency"
                        label="Frequency"
                        required
                        value={values.frequency}
                        disabled={saving}
                        placeholder="Select frequency"
                        options={config.frequencies.map((frequency) => ({
                          value: frequency,
                          label: AUTOMATION_FREQUENCY_LABEL[frequency],
                        }))}
                        error={errors.frequency}
                        onChange={(value) => update("frequency", value as AutomationFrequency)}
                      />
                      {values.frequency === "weekly" ? (
                        <FormSelectField
                          id="automation-day"
                          label="Day of week"
                          required
                          value={values.dayOfWeek}
                          disabled={saving}
                          options={DAYS_OF_WEEK.map((day) => ({ value: day.value, label: day.label }))}
                          onChange={(value) => update("dayOfWeek", value)}
                        />
                      ) : null}
                      {values.frequency === "monthly" ? (
                        <FormTextField
                          id="automation-month-day"
                          label="Day of month"
                          required
                          type="number"
                          min={1}
                          max={28}
                          disabled={saving}
                          value={values.dayOfMonth}
                          error={errors.dayOfMonth}
                          onChange={(value) => update("dayOfMonth", value)}
                        />
                      ) : null}
                      {config.supportsTimeOfDay ? (
                        <FormTextField
                          id="automation-time"
                          label="Time"
                          required
                          type="time"
                          disabled={saving}
                          value={values.timeOfDay}
                          error={errors.timeOfDay}
                          onChange={(value) => update("timeOfDay", value)}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This automation has no schedule. It runs each time the event above occurs.
                    </p>
                  )}
                </Group>

                {config.parameters.length > 0 ? (
                  <Group title="Settings" description="Parameters this automation accepts.">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {config.parameters.includes("rank_change_threshold") ? (
                        <FormTextField
                          id="automation-threshold"
                          label="Alert threshold (positions)"
                          required
                          type="number"
                          min={1}
                          max={50}
                          disabled={saving}
                          value={values.rankChangeThreshold}
                          error={errors.rankChangeThreshold}
                          hint="Alert when a tracked keyword moves at least this many positions."
                          onChange={(value) => update("rankChangeThreshold", value)}
                        />
                      ) : null}
                      {config.parameters.includes("review_rating_threshold") ? (
                        <FormSelectField
                          id="automation-rating"
                          label="Alert on"
                          required
                          value={values.reviewRatingThreshold}
                          disabled={saving}
                          options={REVIEW_RATING_THRESHOLDS.map((option) => ({
                            value: option.value,
                            label: option.label,
                          }))}
                          onChange={(value) => update("reviewRatingThreshold", value)}
                        />
                      ) : null}
                      {config.parameters.includes("report_type") ? (
                        <FormSelectField
                          id="automation-report"
                          label="Report"
                          required
                          value={values.reportType}
                          disabled={saving}
                          placeholder="Select report"
                          options={AUTOMATION_REPORT_TYPES.map((option) => ({
                            value: option.value,
                            label: option.label,
                          }))}
                          error={errors.reportType}
                          onChange={(value) => update("reportType", value)}
                        />
                      ) : null}
                      {config.parameters.includes("recipients") ? (
                        <FormTextareaField
                          id="automation-recipients"
                          label="Recipients"
                          required
                          className="sm:col-span-2"
                          rows={2}
                          disabled={saving}
                          value={values.recipients}
                          placeholder="name@example.com, team@example.com"
                          error={errors.recipients}
                          hint="Separate addresses with a comma or new line."
                          onChange={(value) => update("recipients", value)}
                        />
                      ) : null}
                    </div>
                  </Group>
                ) : null}
              </>
            ) : (
              <div className="px-4 py-5 text-sm text-muted-foreground sm:px-5">
                Select an automation type to configure it.
              </div>
            )}
          </div>
        </Panel>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/automations">Cancel</Link>
          </Button>
          <div className="flex items-center gap-2">
            {dirty && mode === "edit" ? (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            ) : null}
            <SubmitButton
              type="submit"
              pending={saving}
              disabled={!canSubmit}
              pendingLabel={mode === "create" ? "Creating…" : "Saving…"}
            >
              {mode === "create" ? "Create automation" : "Save changes"}
            </SubmitButton>
          </div>
        </div>
      </form>

      <aside className="grid gap-4">
        <Panel title="Automation summary" description="What this automation will do once saved.">
          {summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Choose an automation type to see a plain-language summary here.
            </p>
          ) : (
            <ul className="grid gap-2 text-sm text-foreground">
              {summary.map((line) => (
                <li key={line} className="leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-4 grid gap-2 border-t border-border pt-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Schedule</dt>
              <dd className="text-right font-medium text-foreground">{describeSchedule(values)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-right font-medium text-foreground">
                {selectedLocation ? selectedLocation.businessName : "—"}
              </dd>
            </div>
          </dl>
        </Panel>

        {mode === "edit" && automation ? (
          <>
            <Panel title="Status">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge tone={AUTOMATION_STATUS_TONE[status]}>
                  {AUTOMATION_STATUS_LABEL[status]}
                </StatusBadge>
                <div className="flex gap-2">
                  {capabilities.canPause ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = status === "paused" ? "active" : "paused";
                        setStatus(next);
                        toast.success(next === "paused" ? "Automation paused" : "Automation resumed");
                      }}
                    >
                      {status === "paused" ? "Resume" : "Pause"}
                    </Button>
                  ) : null}
                  {capabilities.canRunNow ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={running}
                      onClick={async () => {
                        setRunning(true);
                        await new Promise((resolve) => setTimeout(resolve, 800));
                        setRunning(false);
                        toast.success("Run started", { description: `${automation.name} is running now.` });
                      }}
                    >
                      {running ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                      {running ? "Starting…" : "Run now"}
                    </Button>
                  ) : null}
                </div>
              </div>
              {automation.failureReason ? (
                <p className="mt-3 rounded-md border border-critical/30 bg-critical-surface/50 px-3 py-2 text-xs text-foreground">
                  {automation.failureReason}
                </p>
              ) : null}
              <dl className="mt-4 grid gap-2 border-t border-border pt-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Last run</dt>
                  <dd className="font-medium text-foreground">{formatAutomationDate(automation.lastRunAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Next run</dt>
                  <dd className="font-medium text-foreground">{formatAutomationDate(automation.nextRunAt)}</dd>
                </div>
              </dl>
            </Panel>

            {capabilities.canViewHistory ? (
              <Panel title="Execution history">
                {automation.recentRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">This automation has not run yet.</p>
                ) : (
                  <ul className="grid gap-3">
                    {automation.recentRuns.map((run) => (
                      <li key={run.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {formatAutomationDate(run.startedAt)}
                          </span>
                          <StatusBadge tone={AUTOMATION_RUN_TONE[run.status]}>
                            {AUTOMATION_RUN_LABEL[run.status]}
                          </StatusBadge>
                        </div>
                        {run.summary ? (
                          <p className="mt-1 text-xs text-muted-foreground">{run.summary}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            ) : null}

            {capabilities.canDelete ? (
              <Panel title="Danger zone">
                <p className="text-xs text-muted-foreground">
                  Deleting an automation removes its configuration and stops all future runs.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete automation
                </Button>
              </Panel>
            ) : null}
          </>
        ) : null}
      </aside>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this automation?"
        description={`${automation?.name ?? "This automation"} will be removed and will no longer run. This cannot be undone.`}
        confirmLabel="Delete automation"
        onConfirm={() => {
          toast.success("Automation deleted");
          void navigate("/automations");
        }}
      />
    </div>
  );
}

export function AutomationBackLink() {
  return (
    <Link
      to="/automations"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden /> Back to automations
    </Link>
  );
}
