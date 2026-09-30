import { format } from "date-fns";
import { Loader2, RotateCw, Trash2 } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DOMAIN_STATUS_DESCRIPTION, type CustomDomain, type DomainStatus as DomainStatusValue } from "@/lib/white-label/white-label";
import { DomainStatusBadge } from "../white-label-ui";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** Connected custom domain: status, SSL and last check. */
export function DomainStatus({
  domain,
  checking,
  onRecheck,
  onRemove,
}: {
  domain: CustomDomain;
  checking: boolean;
  onRecheck: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Detail label="Domain">{domain.hostname}</Detail>
        <Detail label="Status">
          <DomainStatusBadge status={domain.status} />
        </Detail>
        <Detail label="SSL">{domain.sslStatus === "active" ? "Active" : domain.sslStatus === "pending" ? "Pending" : "Not issued"}</Detail>
        <Detail label="Last checked">{domain.lastCheckedAt ? format(new Date(domain.lastCheckedAt), "MMMM d, yyyy") : "Never"}</Detail>
      </dl>
      <p className="text-xs text-muted-foreground">Client report links now use this domain. Existing links on the default domain keep working.</p>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" className="text-critical hover:text-critical" onClick={onRemove} disabled={checking}>
          <Trash2 aria-hidden /> Remove domain
        </Button>
        <Button type="button" variant="outline" onClick={onRecheck} disabled={checking}>
          {checking ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
          {checking ? "Checking domain..." : "Re-check Domain"}
        </Button>
      </div>
    </div>
  );
}

const STATUS_ORDER: DomainStatusValue[] = ["not_connected", "pending_verification", "ssl_pending", "connected", "failed"];

/** Legend explaining every domain status badge. */
export function DomainStatusGuide() {
  return (
    <Panel title="Domain Statuses" description="What each status means.">
      <ul className="space-y-3">
        {STATUS_ORDER.map((status) => (
          <li key={status} className="flex flex-col gap-1">
            <DomainStatusBadge status={status} className="self-start" />
            <span className="text-xs text-muted-foreground">{DOMAIN_STATUS_DESCRIPTION[status]}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function DomainStatusSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-card" aria-label="Loading domain status">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="size-10 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="mt-4 h-9 w-full" />
    </div>
  );
}
