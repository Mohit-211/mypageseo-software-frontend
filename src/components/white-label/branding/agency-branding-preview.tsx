import { useState } from "react";
import { Panel } from "@/components/layout/shared/data-display";
import { isHexColor, reportTheme, type AgencyBranding, type WhiteLabelSnapshot } from "@/lib/white-label/white-label";
import { ClientReportView } from "../client-report-preview/client-report-view";
import { DeviceFrame, DeviceSwitcher, type PreviewDevice } from "../client-report-preview/device-frame";
import { reportPreview } from "../client-report-preview/preview-model";

/** Live preview of unsaved branding on desktop, tablet and mobile. */
export function AgencyBrandingPreview({ snapshot, draft, dirty }: { snapshot: WhiteLabelSnapshot; draft: AgencyBranding; dirty: boolean }) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  // Keep half-typed hex values from breaking the preview.
  const safeDraft: AgencyBranding = {
    ...draft,
    primaryColor: isHexColor(draft.primaryColor) ? draft.primaryColor : (snapshot.branding?.primaryColor ?? "#000000"),
    secondaryColor: isHexColor(draft.secondaryColor) ? draft.secondaryColor : (snapshot.branding?.secondaryColor ?? "#FFFFFF"),
    accentColor: isHexColor(draft.accentColor) ? draft.accentColor : (snapshot.branding?.accentColor ?? "#3B82F6"),
  };
  // Always preview agency branding here, even if the sample report uses the neutral theme.
  const preview = reportPreview(snapshot, safeDraft);
  const theme = reportTheme(safeDraft, "agency");

  return (
    <Panel
      title="Agency Branding Preview"
      description={dirty ? "Showing unsaved changes." : "Matches your saved branding."}
    >
      <DeviceSwitcher value={device} onChange={setDevice} className="mb-4 flex w-full [&>button]:flex-1 [&>button]:justify-center" />
      {preview.client && preview.data ? (
        <div className="rounded-lg bg-muted/60 p-3 sm:p-4">
          <DeviceFrame device={device} url={preview.url} title={preview.pageTitle} faviconUrl={safeDraft.faviconUrl} maxHeight={device === "desktop" ? 420 : 560}>
            <ClientReportView theme={theme} client={preview.client} data={preview.data} modules={preview.modules} />
          </DeviceFrame>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Sample report for {preview.client?.name ?? "your first client"}. Scroll inside the frame to see the full report.
      </p>
    </Panel>
  );
}

