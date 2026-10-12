import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, ListChecks } from "lucide-react";
import {
  getCitationChanges,
  getCitations,
  isApiError,
  type CitationChange,
  type CitationRow,
  type CitationStatus,
} from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { LocationHeader, LocationNavigation } from "@/components/location/location-workspace";
import { ReportButton } from "@/components/report/rank-report-button";
import { Button } from "@/components/ui/button";
import { useRequiredParams } from "@/hooks/use-required-params";
import { formatDate } from "@/lib/datetime";
import { useLocation } from "@/lib/locations/use-locations";
import { cn } from "@/lib/utils";

const CITATION_STATUS_LABEL: Record<CitationStatus, string> = {
  live_correct: "Live & correct",
  nap_wrong: "Wrong name/address/phone",
  not_found: "Not listed",
  duplicate: "Duplicate listing",
  submitted: "Submitted",
  pending: "Pending approval",
  not_checked: "Not checked yet",
  removed: "Removed",
};

const STATUS_TONE: Record<CitationStatus, "success" | "critical" | "warning" | "info" | "neutral"> = {
  live_correct: "success",
  nap_wrong: "critical",
  not_found: "warning",
  duplicate: "warning",
  submitted: "info",
  pending: "info",
  not_checked: "neutral",
  removed: "neutral",
};

const FIELD_LABEL: Record<string, string> = { name: "Name", address: "Address", phone: "Phone", website: "Website" };
const FILTER_ORDER: CitationStatus[] = ["live_correct", "nap_wrong", "not_found", "duplicate", "submitted", "pending", "not_checked"];

/** Citations for one location (Phase 16). Read-only: the MyPageSEO team picks and checks the directories. */
function LocationCitationsPage() {
  const { locationId } = useRequiredParams("locationId");
  const location = useLocation(locationId);
  const [status, setStatus] = useState<CitationStatus | null>(null);
  const citations = useQuery({
    queryKey: ["locations", locationId, "citations", status],
    queryFn: ({ signal }) => getCitations(locationId, status ?? undefined, signal),
    retry: false,
  });

  if (location.isPending) return <AppShell><PageSkeleton /></AppShell>;
  if (location.isError) {
    return (
      <AppShell>
        {isApiError(location.error) && location.error.status === 404 ? (
          <EmptyState
            title="Location not found"
            description="It may have been deleted, or it isn't in this organization."
            action={<Button asChild variant="outline"><Link to="/locations"><ArrowLeft aria-hidden /> Back to locations</Link></Button>}
          />
        ) : (
          <ErrorState description="We couldn't load this location." onRetry={() => void location.refetch()} />
        )}
      </AppShell>
    );
  }
  const data = location.data;
  const available = citations.data?.available === true ? citations.data : null;

  return (
    <AppShell showLocationContext={false}>
      <LocationHeader
        location={{
          id: data.location_id,
          ...(data.client ? { clientId: data.client.client_id } : {}),
          businessName: data.name,
          area: [data.city, data.state, data.country].filter(Boolean).join(", "),
        }}
      />
      <LocationNavigation locationId={data.location_id} activeSection="citations" />
      <PageHeader
        title="Citations"
        description="Where this business is listed across directories, and whether its name, address and phone are right. Our team picks and checks the directories for you."
        meta={available?.last_checked_at ? <p className="text-xs text-muted-foreground">Last checked {formatDate(available.last_checked_at)} by the MyPageSEO team</p> : undefined}
        actions={available ? <ReportButton locationId={locationId} type="citation" subtitle="Citation score, listings, NAP issues and recent changes, as a PDF." /> : undefined}
      />

      {citations.isPending ? (
        <PageSkeleton />
      ) : citations.isError ? (
        <ErrorState description="Citations couldn't be loaded." onRetry={() => void citations.refetch()} />
      ) : !available ? (
        <EmptyState icon={ListChecks} title="Our team is setting up your citation tracking" description="Once your directories are chosen and checked, they show here. There's nothing you need to do." />
      ) : (
        <div className="space-y-6">
          <section className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-3 sm:divide-x sm:divide-border">
            <MetricCard
              label="Citation Health"
              value={available.health.score == null ? "Being checked" : `${available.health.score}${available.health.grade ? ` · ${available.health.grade}` : ""}`}
              caption={available.health.score == null ? "Our team is checking your listings" : "0–100, from the listings checked"}
            />
            <MetricCard
              label="Checked"
              value={`${Math.round((available.health.coverage ?? 0) * available.health.total)} of ${available.health.total}`}
              caption="Listings checked by our team"
            />
            <MetricCard
              label="Need fixing"
              value={(available.counts.nap_wrong ?? 0) + (available.counts.duplicate ?? 0) + (available.counts.not_found ?? 0)}
              caption="Wrong details, duplicates or not listed"
            />
          </section>

          <Panel title="Listings" description="Problems first. Our team fixes and re-checks these.">
            <div className="-mx-4 -mt-1 mb-3 flex flex-wrap gap-1.5 px-4">
              <FilterChip active={status === null} onClick={() => setStatus(null)} label="All" count={available.health.total} />
              {FILTER_ORDER.map((value) =>
                (available.counts[value] ?? 0) > 0 || status === value ? (
                  <FilterChip key={value} active={status === value} onClick={() => setStatus(value)} label={CITATION_STATUS_LABEL[value]} count={available.counts[value] ?? 0} />
                ) : null,
              )}
            </div>
            <CitationTable rows={available.citations} />
          </Panel>

          <ChangesPanel locationId={locationId} recent={available.recent_changes} />
        </div>
      )}
    </AppShell>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {label} <span className="tabular opacity-80">{count}</span>
    </button>
  );
}

function CitationTable({ rows }: { rows: CitationRow[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No listings with this status.</p>;
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-y border-border bg-surface-strong text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Directory</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Details</th>
            <th className="px-3 py-2.5 font-medium">Last checked</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.directory.name}>
              <td className="px-4 py-3">
                <span className="block font-medium text-foreground">{row.directory.name}</span>
                <span className="text-xs capitalize text-muted-foreground">{row.directory.type}</span>
              </td>
              <td className="px-3 py-3"><StatusBadge tone={STATUS_TONE[row.status]}>{CITATION_STATUS_LABEL[row.status]}</StatusBadge></td>
              <td className="px-3 py-3 text-xs text-muted-foreground">
                {row.nap_issues.length
                  ? row.nap_issues.map((issue) => (
                      <p key={issue.field}>
                        {FIELD_LABEL[issue.field] ?? issue.field}: listed as {issue.found ?? "nothing"}, should be {issue.expected ?? "—"}
                      </p>
                    ))
                  : "—"}
              </td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{row.last_checked_at ? formatDate(row.last_checked_at) : "Not yet"}</td>
              <td className="px-3 py-3 text-right">
                {row.listing_url ? (
                  <Button asChild size="sm" variant="ghost">
                    <a href={row.listing_url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> View listing</a>
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function changeText(change: CitationChange): string {
  if (change.from && change.to && change.from !== change.to) return `${CITATION_STATUS_LABEL[change.from] ?? change.from} → ${CITATION_STATUS_LABEL[change.to] ?? change.to}`;
  if (change.to) return CITATION_STATUS_LABEL[change.to] ?? change.to;
  return change.action.replace(/_/g, " ");
}

function ChangesPanel({ locationId, recent }: { locationId: string; recent: CitationChange[] }) {
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ["locations", locationId, "citations", "changes", page],
    queryFn: ({ signal }) => getCitationChanges(locationId, page, 20, signal),
    enabled: all,
  });
  const rows = all ? (history.data?.changes ?? []) : recent;
  const pages = history.data ? Math.max(1, Math.ceil(history.data.total / 20)) : 1;

  return (
    <Panel
      title="Recent changes"
      actions={!all && recent.length > 0 ? <Button size="sm" variant="outline" onClick={() => setAll(true)}>Full history</Button> : undefined}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{all && history.isPending ? "Loading…" : "No changes yet."}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((change, index) => (
            <li key={`${change.at}-${change.directory.name}-${index}`}>
              <span className="font-medium text-foreground">{change.directory.name}</span>: {changeText(change)}
              <span className="text-muted-foreground"> · {formatDate(change.at)}, by {change.by}</span>
            </li>
          ))}
        </ul>
      )}
      {all && pages > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="tabular text-muted-foreground">{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      ) : null}
    </Panel>
  );
}

export default LocationCitationsPage;
