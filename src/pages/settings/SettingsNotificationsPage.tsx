import { useState } from "react";
import { CheckCircle2, Loader2, Lock, Save } from "lucide-react";
import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader, Panel, SectionHeader, StatusBadge } from "@/components/mypageseo/data-display";
import { SettingsNav } from "@/components/mypageseo/settings-nav";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHANNEL_LABEL,
  EMAIL_FREQUENCY_LABEL,
  GROUP_DESCRIPTION,
  GROUP_TITLE,
  emailAlertsEnabled,
  getNotificationSettings,
  preferencesAreEqual,
  toggleChannel,
  type EmailFrequency,
  type NotificationCapabilities,
  type NotificationChannel,
  type NotificationPreferences,
  type PreferenceGroup,
} from "@/lib/mypageseo/notification-settings";
import { useWorkspace } from "@/lib/mypageseo/workspace";



const DESCRIPTION = "Control which Mypageseo updates and alerts you receive.";

const GROUP_ORDER: PreferenceGroup[] = ["activity", "delivery", "account"];

function NotificationSettingsPage() {
  const workspace = useWorkspace();
  const accountType = workspace.organization?.accountType ?? "business";
  const result = getNotificationSettings(accountType);

  return (
    <AppShell>
      <PageHeader title="Notifications" description={DESCRIPTION} />
      <SettingsNav active="notifications" isAgency={accountType === "agency"} />

      {result.status === "loading" ? (
        <TableSkeleton rows={6} columns={3} />
      ) : result.status === "error" ? (
        <ErrorState description={result.message} onRetry={() => window.location.reload()} />
      ) : result.status === "unavailable" ? (
        <EmptyState title="Notification preferences are unavailable" description={result.reason} />
      ) : (
        <PreferenceSections
          initial={result.preferences}
          capabilities={result.capabilities}
        />
      )}
    </AppShell>
  );
}

function PreferenceSections({
  initial,
  capabilities,
}: {
  initial: NotificationPreferences;
  capabilities: NotificationCapabilities;
}) {
  const [saved, setSaved] = useState<NotificationPreferences>(initial);
  const [values, setValues] = useState<NotificationPreferences>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const readOnly = !capabilities.canEdit;
  const dirty = !preferencesAreEqual(values, saved);

  const update = (next: NotificationPreferences) => {
    setValues(next);
    setSavedAt(null);
    setSaveError(null);
  };

  const handleToggle = (preferenceId: string, channel: NotificationChannel) => {
    if (readOnly) return;
    update(toggleChannel(values, preferenceId, channel));
  };

  const handleSave = () => {
    if (saving || readOnly || !dirty) return;
    if (!capabilities.canSave) {
      setSaveError("Saving notification preferences needs the account service, which isn't connected yet.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    window.setTimeout(() => {
      setSaved(values);
      setSaving(false);
      setSavedAt(new Date().toLocaleTimeString());
    }, 500);
  };

  const handleDiscard = () => {
    setValues(saved);
    setSavedAt(null);
    setSaveError(null);
  };

  const showFrequency = emailAlertsEnabled(values);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
    >
      {readOnly ? (
        <Panel className="border-l-4 border-l-brand-soft">
          <p className="text-sm text-muted-foreground">
            Notification preferences are read-only for this account. Contact an organization
            administrator to make changes.
          </p>
        </Panel>
      ) : null}

      <Panel className="border-l-4 border-l-brand-soft">
        <p className="text-sm text-muted-foreground">{values.scopeNote}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Email alerts go to{" "}
          <span className="font-medium text-foreground">{values.deliveryEmail}</span>.
        </p>
      </Panel>

      {GROUP_ORDER.map((group) => {
        const items = values.preferences.filter((preference) => preference.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`group-${group}`}>
            <SectionHeader title={GROUP_TITLE[group]} description={GROUP_DESCRIPTION[group]} />
            <Panel className="p-0">
              <ul className="divide-y divide-border">
                {items.map((preference) => (
                  <li
                    key={preference.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 sm:max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <p id={`group-${group}`} className="text-sm font-medium text-foreground">
                          {preference.label}
                        </p>
                        {preference.required ? (
                          <StatusBadge tone="neutral">
                            <Lock aria-hidden className="mr-1 inline size-3" />
                            Always on
                          </StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{preference.description}</p>
                      {preference.required ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Required for account security and cannot be turned off.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-4 sm:pl-4">
                      {(["email", "in_app"] as NotificationChannel[]).map((channel) => {
                        const supported = preference.supportedChannels.includes(channel);
                        const inputId = `${preference.id}-${channel}`;
                        if (!supported) {
                          return (
                            <span
                              key={channel}
                              className="w-20 text-xs text-muted-foreground/60"
                              title={`${CHANNEL_LABEL[channel]} delivery is not available for this alert.`}
                            >
                              {CHANNEL_LABEL[channel]} —
                            </span>
                          );
                        }
                        return (
                          <div key={channel} className="flex w-20 items-center gap-2">
                            <Checkbox
                              id={inputId}
                              checked={preference.channels.includes(channel)}
                              disabled={readOnly || preference.required}
                              onCheckedChange={() => handleToggle(preference.id, channel)}
                            />
                            <Label htmlFor={inputId} className="text-xs font-normal text-muted-foreground">
                              {CHANNEL_LABEL[channel]}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </section>
        );
      })}

      <section aria-labelledby="email-delivery">
        <SectionHeader
          title="Email delivery"
          description="How often enabled email alerts are sent"
        />
        <Panel>
          <div className="max-w-sm">
            <Label htmlFor="email-frequency">Email frequency</Label>
            <Select
              value={values.emailFrequency}
              disabled={readOnly || !showFrequency}
              onValueChange={(value) => update({ ...values, emailFrequency: value as EmailFrequency })}
            >
              <SelectTrigger id="email-frequency" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EMAIL_FREQUENCY_LABEL) as EmailFrequency[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {EMAIL_FREQUENCY_LABEL[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {showFrequency
                ? "Applies to every alert you receive by email. Security notices are always sent immediately."
                : "No email alerts are enabled, so frequency has no effect."}
            </p>
          </div>
        </Panel>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={readOnly || !dirty || saving}>
          {saving ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
          {saving ? "Saving…" : "Save preferences"}
        </Button>
        <Button type="button" variant="outline" onClick={handleDiscard} disabled={!dirty || saving}>
          Discard changes
        </Button>
        {savedAt ? (
          <span role="status" className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 aria-hidden className="size-4" /> Saved at {savedAt}
          </span>
        ) : null}
        {saveError ? (
          <span role="status" className="text-sm text-warning-foreground">
            {saveError}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export default NotificationSettingsPage;
