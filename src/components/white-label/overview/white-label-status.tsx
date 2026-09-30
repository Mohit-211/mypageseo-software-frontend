import { Panel } from "@/components/layout/shared/data-display";
import { Skeleton } from "@/components/ui/skeleton";
import { DOMAIN_STATUS_LABEL, type AgencyBranding, type WhiteLabelSummary } from "@/lib/white-label/white-label";
import { StatusLine } from "../white-label-ui";

/** Neutral checklist of what is configured for the client-facing experience. */
export function WhiteLabelStatus({ summary, branding }: { summary: WhiteLabelSummary; branding: AgencyBranding | null }) {
  const custom = summary.customDomainStatus;
  return (
    <Panel title="White-Label Status" description="Your client-facing setup at a glance.">
      <dl className="divide-y divide-border">
        <StatusLine label="Branding" value={branding ? "Configured" : "Not configured"} state={branding ? "done" : "off"} />
        <StatusLine label="Domain" value={summary.domain.custom ? "Custom connected" : DOMAIN_STATUS_LABEL[summary.domainStatus]} state="done" />
        {custom !== "not_connected" && custom !== "connected" ? (
          <StatusLine label="Custom domain" value={DOMAIN_STATUS_LABEL[custom]} state="pending" />
        ) : null}
        <StatusLine label="Client Reports" value={`${summary.published} Active`} state={summary.published ? "done" : "off"} />
        <StatusLine label="SSL" value={summary.sslStatus === "active" ? "Active" : "Pending"} state={summary.sslStatus === "active" ? "done" : "pending"} />
        <StatusLine
          label="Client Branding"
          value={branding?.hidePlatformBranding ? "Enabled" : "Disabled"}
          state={branding?.hidePlatformBranding ? "done" : "off"}
        />
      </dl>
      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
        Reports are served from <span className="font-medium text-foreground">{summary.domain.hostname}</span>.
      </p>
    </Panel>
  );
}

export function WhiteLabelStatusSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-card" aria-label="Loading status">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="mt-4 flex justify-between">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}
