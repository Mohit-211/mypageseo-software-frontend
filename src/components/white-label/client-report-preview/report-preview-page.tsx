import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Eye, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { REPORT_STATUS_LABEL, whiteLabelActions, withScheme, useWhiteLabel, type ReportTheme } from "@/lib/white-label/white-label";
import { copyText, themeStyle } from "../white-label-theme";
import { WHITE_LABEL_REPORTS_PATH, whiteLabelPreviewPath } from "../paths";
import { AgencyMark } from "../white-label-ui";
import { ClientReportView } from "./client-report-view";
import { DeviceFrame, DeviceSwitcher, type PreviewDevice } from "./device-frame";
import { reportPreview } from "./preview-model";


/** While previewing, the browser tab shows the agency's favicon and title, as the client would see it. */
function useClientDocumentMeta(title: string, faviconUrl: string | null) {
  useEffect(() => {
    const previousTitle = document.title;
    const icon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    const previousIcon = icon?.href ?? null;
    document.title = title;
    if (icon && faviconUrl) icon.href = faviconUrl;
    return () => {
      document.title = previousTitle;
      if (icon && previousIcon) icon.href = previousIcon;
    };
  }, [title, faviconUrl]);
}

/** What a client sees when a disabled report link is opened. */
function ReportUnavailable({ theme }: { theme: ReportTheme }) {
  return (
    <div style={themeStyle(theme)} className="flex min-h-full flex-col items-center justify-center bg-slate-50 px-6 py-24 text-center text-slate-900">
      <AgencyMark theme={theme} showName />
      <h1 className="mt-8 text-xl font-semibold">This report is no longer available</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        Please contact {theme.agencyName}
        {theme.contactEmail ? ` at ${theme.contactEmail}` : ""} for an updated link.
      </p>
    </div>
  );
}

export function ReportPreviewPage({ reportId }: { reportId: string | null }) {
  const navigate = useNavigate();
  const snapshot = useWhiteLabel();
  const isMobile = useIsMobile();
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [publishing, setPublishing] = useState(false);
  const preview = reportPreview(snapshot, snapshot.branding, reportId);

  useClientDocumentMeta(preview.pageTitle, preview.theme.faviconUrl);

  if (snapshot.status === "loading") {
    return (
      <div role="status" aria-label="Loading preview" className="min-h-dvh bg-muted/40">
        <div className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="mx-auto max-w-5xl space-y-4 p-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if ((reportId && !preview.report) || !preview.client || !preview.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <EmptyState
          title="Report not found"
          description="This client report doesn't exist or was replaced by a newer report."
          action={
            <Button asChild>
              <Link to={WHITE_LABEL_REPORTS_PATH}>
                <ArrowLeft aria-hidden /> Back to Client Reports
              </Link>
            </Button>
          }
          className="w-full max-w-lg"
        />
      </div>
    );
  }

  const { report, client, data } = preview;
  const status = report?.status ?? null;
  const effectiveDevice = isMobile ? "desktop" : device;

  const publish = async () => {
    if (!report) return;
    setPublishing(true);
    await whiteLabelActions.updateClientReport(report.id, { status: "published" });
    setPublishing(false);
    toast.success("Report published", { description: `${client.name} can now open the report link.` });
  };

  const content =
    status === "disabled" ? (
      <ReportUnavailable theme={preview.theme} />
    ) : (
      <ClientReportView theme={preview.theme} client={client} data={data} modules={preview.modules} allowDownload={snapshot.access.allowDownload} />
    );

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      {/* Preview Mode bar: product UI, deliberately outside the client-facing report. */}
      <div className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
          <Button variant="ghost" size="sm" className="-ml-1" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(WHITE_LABEL_REPORTS_PATH))}>
            <ArrowLeft aria-hidden /> <span className="hidden sm:inline">Back</span>
          </Button>
          <StatusBadge tone="brand">
            <Eye className="size-3" aria-hidden /> Preview Mode
          </StatusBadge>

          {snapshot.reports.length > 1 ? (
            <Select value={report?.id ?? ""} onValueChange={(id) => navigate(whiteLabelPreviewPath(id), { replace: true })}>
              <SelectTrigger className="h-8 w-44 bg-surface text-sm sm:w-56" aria-label="Client report">
                <SelectValue placeholder={client.name} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {snapshot.reports.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {snapshot.clients.find((c) => c.id === r.clientId)?.name ?? r.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {status && status !== "published" ? <StatusBadge tone={status === "draft" ? "neutral" : "critical"}>{REPORT_STATUS_LABEL[status]}</StatusBadge> : null}
          {report?.visibility === "password" ? (
            <StatusBadge>
              <Lock className="size-3" aria-hidden /> Password protected
            </StatusBadge>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <DeviceSwitcher value={device} onChange={setDevice} className="hidden md:inline-flex" />
            <Button variant="outline" size="sm" onClick={() => void copyText(withScheme(preview.url), "Report link copied.")} disabled={status === "disabled"}>
              <Copy aria-hidden /> <span className="hidden sm:inline">Copy Link</span>
            </Button>
            {status === "draft" ? (
              <Button size="sm" onClick={() => void publish()} disabled={publishing}>
                <Send aria-hidden /> {publishing ? "Publishing…" : "Publish"}
              </Button>
            ) : null}
          </div>
        </div>
        <p className="truncate border-t border-border px-4 py-1.5 font-mono text-[11px] text-muted-foreground">{preview.url}</p>
      </div>

      <main className="flex-1">
        {effectiveDevice === "desktop" ? (
          content
        ) : (
          <div className="px-4 py-6">
            <DeviceFrame device={effectiveDevice} url={preview.url} title={preview.pageTitle} faviconUrl={preview.theme.faviconUrl} maxHeight={880}>
              {content}
            </DeviceFrame>
          </div>
        )}
      </main>
    </div>
  );
}
