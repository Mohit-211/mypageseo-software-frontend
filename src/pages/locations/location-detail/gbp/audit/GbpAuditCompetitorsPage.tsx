import { Link } from "react-router-dom";
import { ArrowRight, Check, Lightbulb, Minus, Star } from "lucide-react";
import type { CompetitorRow, CompetitorsSection, GbpReport } from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { GbpPageHeader, GbpReportError, SectionUnavailable } from "@/components/gbp/gbp-ui";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/report/rank-report-button";
import { useGbpContext } from "@/lib/gbp/gbp-context";
import { useGbpReport } from "@/lib/gbp/use-gbp-report";
import { formatRunDate } from "@/lib/rankings/format";

const SOURCE_LABEL: Record<string, string> = {
  self: "You",
  tracking: "Tracked competitor",
  map_list: "Nearby on Google Maps",
};

/** Public comparison with nearby businesses (public data only; ranks are in Rankings). */
function GbpAuditCompetitorsPage() {
  const { location } = useGbpContext();
  const report = useGbpReport(location.location_id, "28d");

  return (
    <>
      <GbpPageHeader
        locationId={location.location_id}
        view="competitors"
        title="Competitor comparison"
        description="How the profile compares with nearby businesses on what anyone can see on Google: rating, reviews, photos and profile details."
        generatedAt={report.data?.generated_at}
        pending={report.data?.generation?.pending}
        gbpConnected={location.gbp_connected}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to={`/locations/${location.location_id}/rankings/competitors`}>Ranking comparison <ArrowRight aria-hidden /></Link>
            </Button>
            <ReportButton locationId={location.location_id} type="competitor_analysis" subtitle="Public scores, comparison table, insights and reviews, as a PDF." />
          </>
        }
      />
      {report.isPending ? (
        <PageSkeleton />
      ) : report.isError ? (
        <GbpReportError error={report.error} onRetry={() => void report.refetch()} gbpConnected={location.gbp_connected} />
      ) : (
        <CompetitorsContent report={report.data} />
      )}
    </>
  );
}

function CompetitorsContent({ report }: { report: GbpReport }) {
  const section = report.competitors;
  if (!section.available) return <Panel><SectionUnavailable section={section} compact /></Panel>;
  return (
    <div className="space-y-6">
      {section.warning ? (
        <p className="rounded-md border border-warning/40 bg-warning-surface/40 px-3 py-2 text-sm text-warning-foreground">
          Business details couldn't be refreshed this time; the last known details are shown.
        </p>
      ) : null}
      <ComparisonTable section={section} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Insights section={section} />
        <RecentReviews rows={section.rows} />
      </div>
      {report.attribution ? <p className="text-[11px] text-muted-foreground">{report.attribution.text}</p> : null}
    </div>
  );
}

function Present({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  return value ? <Check aria-label="Yes" className="mx-auto size-4 text-success" /> : <Minus aria-label="No" className="mx-auto size-4 text-muted-foreground" />;
}

function ComparisonTable({ section }: { section: CompetitorsSection }) {
  const rows = [...section.rows].sort((a, b) => Number(b.is_self) - Number(a.is_self));
  return (
    <Panel
      title="Side by side"
      description={`Public details from Google, updated ${formatRunDate(section.generated_at)}.`}
      actions={
        <TermWithTip term={<span className="sr-only">Public Score</span>}>
          Public Score (0–100) uses only what anyone can see on Google, the same way for every business: rating (25), number of reviews (20) and five profile details (category, hours, website, phone, editorial summary; 5 each), scaled to 100.
        </TermWithTip>
      }
    >
      <div className="-m-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-border bg-surface-strong text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Business</th>
              <th className="px-3 py-2.5 text-right font-medium">Public Score</th>
              <th className="px-3 py-2.5 text-right font-medium">Rating</th>
              <th className="px-3 py-2.5 text-right font-medium">Reviews</th>
              <th className="px-3 py-2.5 font-medium">Category</th>
              <th className="px-2 py-2.5 text-center font-medium">Hours</th>
              <th className="px-2 py-2.5 text-center font-medium">Website</th>
              <th className="px-2 py-2.5 text-center font-medium">Phone</th>
              <th className="px-3 py-2.5 text-right font-medium">
                <TermWithTip term="Photos">Google returns up to 10 photo references, so 10 shows as “10+”.</TermWithTip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <CompetitorTableRow key={row.place_id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function CompetitorTableRow({ row }: { row: CompetitorRow }) {
  const closed = row.public_score?.flag;
  return (
    <tr className={row.is_self ? "bg-brand-tint/50" : undefined}>
      <td className="px-4 py-3">
        <span className="block font-medium text-foreground">{row.name ?? "Unnamed business"}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {SOURCE_LABEL[row.source] ?? row.source}
          {closed ? <StatusBadge tone="critical">{closed === "closed_permanently" ? "Closed" : "Temporarily closed"}</StatusBadge> : null}
          {row.stale ? <StatusBadge tone="warning">Details may be outdated</StatusBadge> : null}
        </span>
      </td>
      <td className="px-3 py-3 text-right text-base font-semibold tabular">{row.public_score?.score ?? "—"}</td>
      <td className="px-3 py-3 text-right tabular">
        {row.rating != null ? <span className="inline-flex items-center gap-1"><Star aria-hidden className="size-3.5 fill-warning text-warning" />{row.rating.toFixed(1)}</span> : "—"}
      </td>
      <td className="px-3 py-3 text-right tabular">{row.user_rating_count?.toLocaleString() ?? "—"}</td>
      <td className="px-3 py-3 text-muted-foreground">{row.primary_type_label ?? "—"}</td>
      <td className="px-2 py-3 text-center"><Present value={row.fetched_at ? row.has_hours : null} /></td>
      <td className="px-2 py-3 text-center"><Present value={row.fetched_at ? row.has_website : null} /></td>
      <td className="px-2 py-3 text-center"><Present value={row.fetched_at ? row.has_phone : null} /></td>
      <td className="px-3 py-3 text-right tabular">{row.photo_count == null ? "—" : row.photos_capped ? "10+" : row.photo_count}</td>
    </tr>
  );
}

function Insights({ section }: { section: CompetitorsSection }) {
  return (
    <Panel title="What stands out" description="Gaps against the businesses above, most important first.">
      {section.insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notable gaps found.</p>
      ) : (
        <ul className="space-y-3">
          {[...section.insights].sort((a, b) => b.impact - a.impact).map((insight) => (
            <li key={`${insight.id}-${insight.place_id ?? ""}`} className="flex gap-2.5 text-sm">
              <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>{insight.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RecentReviews({ rows }: { rows: CompetitorRow[] }) {
  const withReviews = rows.filter((row) => row.reviews.length > 0);
  return (
    <Panel title="What customers say" description="Recent Google reviews of each business (up to two each).">
      {withReviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews were returned by Google.</p>
      ) : (
        <div className="space-y-4">
          {withReviews.map((row) => (
            <section key={row.place_id}>
              <h3 className="text-sm font-semibold text-foreground">{row.name ?? "Unnamed business"}{row.is_self ? " (you)" : ""}</h3>
              <ul className="mt-1.5 space-y-2">
                {row.reviews.slice(0, 2).map((review, index) => (
                  <li key={index} className="rounded-md border border-border p-2.5 text-sm">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {review.rating != null ? <span className="inline-flex items-center gap-0.5"><Star aria-hidden className="size-3 fill-warning text-warning" />{review.rating}</span> : null}
                      {review.author?.name ? (
                        review.author.uri ? <a href={review.author.uri} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">{review.author.name}</a> : <span className="font-medium text-foreground">{review.author.name}</span>
                      ) : null}
                      {review.relative_time ? <span>{review.relative_time}</span> : null}
                    </p>
                    {review.text ? <p className="mt-1 line-clamp-4 text-foreground">{review.text}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default GbpAuditCompetitorsPage;
