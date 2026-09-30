import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { PartialDataNotice } from "@/components/layout/shared/feedback/states";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { summarizeWhiteLabel, useWhiteLabel, type ClientReport } from "@/lib/white-label/white-label";
import { BrandingSettings, BrandingSettingsSkeleton } from "./branding/branding-settings";
import { pickPreviewReport } from "./client-report-preview/preview-model";
import { ClientReports, ClientReportsSkeleton } from "./client-reports/client-reports";
import { CreateClientReport } from "./client-reports/create-client-report";
import { DomainSettings, DomainSettingsSkeleton } from "./domain/domain-settings";
import { EmailBrandingSettings, EmailBrandingSkeleton } from "./email-branding-settings";
import { WhiteLabelOverview, WhiteLabelOverviewSkeleton } from "./overview/white-label-overview";
import { whiteLabelPreviewPath } from "./paths";
import { ReportAccessSettings, ReportAccessSkeleton } from "./report-access-settings";


const TABS = [
  { value: "overview", label: "Overview" },
  { value: "branding", label: "Branding" },
  { value: "domain", label: "Domain" },
  { value: "reports", label: "Client Reports" },
  { value: "access", label: "Report Access" },
  { value: "communication", label: "Client Communication" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const isTab = (value: string | null): value is TabValue => TABS.some((t) => t.value === value);

/** White-Label: overview → branding → domain → client reports → access → communication. */
export function WhiteLabelPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const snapshot = useWhiteLabel(params.get("scenario") === "new" ? "new" : "demo");
  const [createKey, setCreateKey] = useState<number | null>(null);

  const tabParam = params.get("tab");
  const tab: TabValue = isTab(tabParam) ? tabParam : "overview";
  const setTab = (next: TabValue) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === "overview") updated.delete("tab");
        else updated.set("tab", next);
        return updated;
      },
      { replace: true },
    );

  const loading = snapshot.status === "loading";
  const summary = summarizeWhiteLabel(snapshot);
  const openPreview = (reportId?: string | null) => navigate(whiteLabelPreviewPath(reportId));
  const openCreate = () => setCreateKey((k) => (k ?? 0) + 1);

  const onCreated = (report: ClientReport) => {
    const client = snapshot.clients.find((c) => c.id === report.clientId);
    setTab("reports");
    toast.success("Client report created", {
      description: `${client?.name ?? "The report"} is saved as a draft. Preview it, then publish to share.`,
      action: { label: "Preview", onClick: () => openPreview(report.id) },
    });
  };

  return (
    <>
      <PageHeader
        title="White-Label"
        description="Customize your client-facing reports with your agency's branding."
        meta={
          loading ? null : snapshot.branding ? (
            <StatusBadge tone="success">White-Label: Active</StatusBadge>
          ) : (
            <StatusBadge tone="warning">White-Label: Not configured</StatusBadge>
          )
        }
        actions={
          <Button onClick={() => openPreview(pickPreviewReport(snapshot).report?.id)} disabled={loading || snapshot.clients.length === 0} className="w-full sm:w-auto">
            <MonitorPlay aria-hidden /> Preview Client View
          </Button>
        }
      />

      <SettingsNav active="white-label" isAgency className="mt-4" />

      <PartialDataNotice description="White-label hosting isn't connected yet. Branding, domains and client reports on this page are sample data for preview, and uploads stay in this browser." />

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)} className="mt-5">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-10 w-max">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="h-8 px-3.5">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-5">
          {loading ? (
            <WhiteLabelOverviewSkeleton />
          ) : (
            <WhiteLabelOverview
              snapshot={snapshot}
              summary={summary}
              onConfigureBranding={() => setTab("branding")}
              onCreateReport={openCreate}
              onViewReports={() => setTab("reports")}
              onOpenPreview={openPreview}
            />
          )}
        </TabsContent>

        <TabsContent value="branding" className="mt-5">
          {loading ? <BrandingSettingsSkeleton /> : <BrandingSettings snapshot={snapshot} />}
        </TabsContent>

        <TabsContent value="domain" className="mt-5">
          {loading ? <DomainSettingsSkeleton /> : <DomainSettings snapshot={snapshot} />}
        </TabsContent>

        <TabsContent value="reports" className="mt-5">
          {loading ? <ClientReportsSkeleton /> : <ClientReports snapshot={snapshot} onCreate={openCreate} onPreview={openPreview} />}
        </TabsContent>

        <TabsContent value="access" className="mt-5">
          {loading ? <ReportAccessSkeleton /> : <ReportAccessSettings settings={snapshot.access} />}
        </TabsContent>

        <TabsContent value="communication" className="mt-5">
          {loading ? (
            <EmailBrandingSkeleton />
          ) : (
            <EmailBrandingSettings settings={snapshot.email} branding={snapshot.branding} sampleClientName={pickPreviewReport(snapshot).client?.name ?? "Your Client"} />
          )}
        </TabsContent>
      </Tabs>

      {createKey !== null ? (
        <CreateClientReport
          key={createKey}
          open
          onOpenChange={(open) => !open && setCreateKey(null)}
          clients={snapshot.clients}
          reports={snapshot.reports}
          brandingConfigured={Boolean(snapshot.branding)}
          onCreated={onCreated}
        />
      ) : null}
    </>
  );
}
