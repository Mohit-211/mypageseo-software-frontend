import { useState } from "react";
import { RequireAccess } from "@/components/mypageseo/access";
import { Link } from "react-router-dom";
import { ArrowLeft, ImageUp, Save } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { SettingsNav } from "@/components/mypageseo/settings-nav";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import {
  FormAlert,
  FormTextField,
  SubmitButton,
  useSubmitGuard,
} from "@/components/layout/shared/form-fields";
import {
  COMPANY_NAME_MAX_LENGTH,
  getWhiteLabelSettings,
} from "@/lib/mypageseo/white-label";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const SettingsWhiteLabelPage = () => (
    <RequireAccess permission="white_label.manage">
      <WhiteLabelPage />
    </RequireAccess>
  );

function WhiteLabelPage() {
  const workspace = useWorkspace();
  const result = getWhiteLabelSettings();
  const initialName = result.status === "ready" ? (result.branding.companyName ?? "") : "";
  const [companyName, setCompanyName] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const [baseline, setBaseline] = useState(initialName);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { pending: saving, run } = useSubmitGuard();

  const capabilities = result.status === "loading" || result.status === "error" ? null : result.capabilities;
  const logoUrl = result.status === "ready" ? result.branding.logoUrl : null;
  const dirty = touched && companyName !== baseline;
  const nameError =
    touched && companyName.trim().length > COMPANY_NAME_MAX_LENGTH
      ? `Use ${COMPANY_NAME_MAX_LENGTH} characters or fewer.`
      : null;

  const handleSave = () => {
    if (saving || !dirty) return;
    setSavedName(null);
    if (companyName.trim().length > COMPANY_NAME_MAX_LENGTH) {
      setTouched(true);
      setSaveError(`Use ${COMPANY_NAME_MAX_LENGTH} characters or fewer for the agency name.`);
      return;
    }
    if (!capabilities?.canSave) {
      setSaveError("Saving report branding requires the reporting service, which isn't connected yet.");
      return;
    }
    setSaveError(null);
    void run(
      () =>
        new Promise<void>((resolve) =>
          window.setTimeout(() => {
            const next = companyName.trim();
            setCompanyName(next);
            setBaseline(next);
            setSavedName(next);
            resolve();
          }, 500),
        ),
    );
  };

  if (workspace.status === "loading") {
    return (
      <AppShell>
        <PageHeader title="White-Label Reporting" description="Loading your report branding configuration." />
        <TableSkeleton rows={4} columns={2} />
      </AppShell>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <AppShell>
        <PageHeader title="White-Label Reporting" description="Branding shown on client-facing reports." />
        <ErrorState
          description="We couldn't load your organization. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  if (workspace.organization?.accountType !== "agency") {
    return (
      <AppShell>
        <PageHeader title="White-Label Reporting" description="White-label reporting is part of the Agency workspace." />
        <EmptyState
          title="White-label reporting is only available to agency organizations"
          description="This organization is a business account, so reports are always presented with standard Mypageseo branding."
          action={
            <Button asChild>
              <Link to="/settings">Back to settings</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/settings">
            <ArrowLeft aria-hidden /> Back to settings
          </Link>
        </Button>
      </div>

      <PageHeader
        title="White-Label Reporting"
        description="Configure the branding shown on supported client-facing Mypageseo reports. These settings apply to reports only — the Mypageseo product interface keeps its own identity."
        meta={
          dirty ? (
            <StatusBadge tone="warning">Unsaved changes</StatusBadge>
          ) : null
        }
        actions={
          <>
            {capabilities?.canReset ? (
              <Button variant="outline" size="sm">
                Reset to Mypageseo branding
              </Button>
            ) : null}
            <SubmitButton
              type="button"
              size="sm"
              pending={saving}
              onClick={handleSave}
              disabled={!capabilities?.canSave || !dirty || Boolean(nameError)}
              icon={<Save aria-hidden />}
            >
              Save changes
            </SubmitButton>
          </>
        }
      />

      <SettingsNav active="white-label" isAgency className="mt-4" />

      {result.status === "error" ? (
        <div className="mt-5">
          <ErrorState description={result.message} onRetry={() => window.location.reload()} />
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel
            title="Brand identity"
            description="The agency name and logo the report system prints on client-facing reports."
          >
            <div className="space-y-5">
              {saveError ? <FormAlert>{saveError}</FormAlert> : null}
              {savedName !== null ? (
                <FormAlert tone="success">Report branding saved.</FormAlert>
              ) : null}
              <FormTextField
                id="company-name"
                label="Agency name on reports"
                optional
                value={companyName}
                maxLength={COMPANY_NAME_MAX_LENGTH + 20}
                disabled={!capabilities?.canSave || saving}
                placeholder="Mypageseo"
                error={nameError}
                hint="Shown in the report header. Left empty, reports use standard Mypageseo branding."
                onChange={(value) => {
                  setCompanyName(value);
                  setTouched(true);
                  setSaveError(null);
                  setSavedName(null);
                }}
              />

              <div className="space-y-1.5">
                <p className="text-[13px] font-medium text-foreground">Report logo</p>
                {logoUrl ? (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                    <img src={logoUrl} alt="Current report logo" className="h-8 w-auto" />
                    <span className="text-xs text-muted-foreground">Currently used on reports.</span>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button id="logo-upload" variant="outline" size="sm" disabled={!capabilities?.canUploadLogo}>
                    <ImageUp aria-hidden /> Upload logo
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {capabilities?.canUploadLogo
                      ? "The uploaded logo appears here once the file is stored."
                      : "Logo storage is not connected yet, so a report logo cannot be uploaded."}
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Report information"
            description="Contact and business details printed alongside the agency name."
          >
            <p className="text-sm text-muted-foreground">
              The report system currently prints only the agency name and logo. Contact details, website and support
              information are not part of the report branding contract, so they are not configurable here.
            </p>
          </Panel>

          <Panel title="Report appearance" description="Visual settings applied inside the report layout.">
            <p className="text-sm text-muted-foreground">
              Reports use the standard Mypageseo report layout and chart styling. No report-specific colour or layout
              options are exposed by the report system, so none are offered here.
            </p>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Saved configuration" description="What client-facing reports use today.">
            {result.status === "unavailable" ? (
              <p className="text-sm text-muted-foreground">{result.reason}</p>
            ) : (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Agency name</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{baseline || "Mypageseo (default)"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Report logo</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{logoUrl ? "Uploaded" : "Not set"}</dd>
                </div>
              </dl>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              A branded report preview needs generated report data, which is not available in this workspace yet.
            </p>
          </Panel>

          <Panel title="Where this applies">
            <p className="text-sm text-muted-foreground">
              White-label branding is used on client-facing reports only. The signed-in Mypageseo interface, navigation
              and product identity are unchanged for your team.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/reports">Go to Reports Center</Link>
            </Button>
          </Panel>
        </aside>
      </div>
    </AppShell>
  );
}

export default SettingsWhiteLabelPage;
