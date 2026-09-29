import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { GbpAuditContent } from "@/components/gbp-audit/gbp-audit-main";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { getGbpAudit } from "@/lib/gbp/gbp-audit";
import { useWorkspace } from "@/lib/mypageseo/workspace";



function GbpAuditPage() {
  const workspace = useWorkspace();
  const location = workspace.activeLocation ?? workspace.locations[0] ?? null;
  const data = location ? getGbpAudit(location?.id) : null;

  return (
    <AppShell>
      <PageHeader
        title="GBP Audit"
        description="Profile completeness and actionable issues."
        meta={
          location ? (
            <p className="text-xs text-muted-foreground">
              {location.businessName} · {location.area}
              {data?.checkedAt ? ` · Last checked ${data.checkedAt}` : ""}
            </p>
          ) : undefined
        }
      />
      {location && data ? (
        <GbpAuditContent data={data} onRetry={() => window.location.reload()} />
      ) : (
        <EmptyState
          title="No locations in this workspace"
          description="Add a location to this workspace to run a Google Business Profile audit."
        />
      )}
    </AppShell>
  );
}

export default GbpAuditPage;
