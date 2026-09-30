import { Expand } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BRAND_FONT_LABEL, BUTTON_STYLE_LABEL, type AgencyBranding, type WhiteLabelSnapshot } from "@/lib/white-label/white-label";
import { ClientReportView } from "../client-report-preview/client-report-view";
import { DeviceFrame } from "../client-report-preview/device-frame";
import { reportPreview } from "../client-report-preview/preview-model";

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden className="size-6 shrink-0 rounded-md border border-border" style={{ background: color }} />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="font-mono text-xs text-foreground">{color}</p>
      </div>
    </div>
  );
}

/** Overview preview: what a client sees, framed in a browser window. */
export function BrandingPreview({
  snapshot,
  branding,
  onOpenFullPreview,
}: {
  snapshot: WhiteLabelSnapshot;
  branding: AgencyBranding;
  onOpenFullPreview: (reportId: string | null) => void;
}) {
  const preview = reportPreview(snapshot, branding);

  return (
    <Panel
      title="Branding Preview"
      description="What your client sees when they open a report."
      actions={
        <Button size="sm" variant="outline" onClick={() => onOpenFullPreview(preview.report?.id ?? null)} disabled={!preview.client}>
          <Expand aria-hidden /> Open Full Preview
        </Button>
      }
    >
      {preview.client && preview.data ? (
        <div className="rounded-lg bg-muted/60 p-3 sm:p-5">
          <DeviceFrame device="desktop" url={preview.url} title={preview.pageTitle} faviconUrl={branding.faviconUrl} maxHeight={560}>
            <ClientReportView theme={preview.theme} client={preview.client} data={preview.data} modules={preview.modules} />
          </DeviceFrame>
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-5">
        <Swatch label="Primary" color={branding.primaryColor} />
        <Swatch label="Secondary" color={branding.secondaryColor} />
        <Swatch label="Accent" color={branding.accentColor} />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Buttons</p>
          <p className="truncate text-xs text-foreground">{BUTTON_STYLE_LABEL[branding.buttonStyle]}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Typography</p>
          <p className="truncate text-xs text-foreground">{BRAND_FONT_LABEL[branding.font]}</p>
        </div>
      </div>
    </Panel>
  );
}

export function BrandingPreviewSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card" aria-label="Loading branding preview">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="p-4">
        <Skeleton className="aspect-[16/10] w-full rounded-lg" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </div>
    </div>
  );
}
