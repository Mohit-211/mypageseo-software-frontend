import { Link, useNavigate } from "react-router-dom";
import { Briefcase, ChevronRight, LoaderCircle } from "lucide-react";
import type { DashboardSort } from "@/api";
import { preloadPath } from "@/app/route-preload";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { InfoTip } from "@/components/layout/shared/info-tip";
import { TrendIndicator } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import {
  SortableTh,
  TableBody,
  TableHead,
  TablePagination,
  TableScroll,
  Th,
  tdClass,
  tdNumberClass,
  type SortOrder,
} from "@/components/layout/shared/data-table";
import { LocationAvatar, LocationStatusBadge, RankFigure, ScoreChip } from "@/components/location/location-badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccess } from "@/hooks/use-access";
import type { AgencyDashboardModel, PortfolioRow } from "@/lib/dashboard/dashboard-data";
import { locationPath } from "@/lib/mypageseo/section-links";
import { cn } from "@/lib/utils";

/** The sorts offered on phones; each is the column's first-click order. */
const MOBILE_SORTS: { value: string; label: string }[] = [
  { value: "name:asc", label: "Location, A–Z" },
  { value: "client:asc", label: "Client, A–Z" },
  { value: "rank:asc", label: "Best average rank" },
  { value: "gbp_score:desc", label: "Highest profile score" },
];

/** Unanswered 1–3★ or flagged reviews: amber when there are some, a quiet 0 otherwise. */
function UrgentReviews({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("font-semibold tabular-nums", value > 0 ? "text-warning-foreground" : "text-muted-foreground")}>{value}</span>;
}

const URGENT_HELP = "Urgent reviews: unanswered 1–3★ or flagged reviews, the ones to answer first.";

/**
 * The agency portfolio: one row per client location, sorted and paged by the server (`sort`,
 * `order`, `page` on `GET /dashboard`), so the order is right across every page. A row opens the
 * location's overview.
 */
export function PortfolioCard({
  portfolio,
  sort,
  order,
  onSort,
  onPage,
  busy,
}: {
  portfolio: AgencyDashboardModel["portfolio"];
  sort: DashboardSort;
  order: SortOrder;
  onSort: (field: DashboardSort) => void;
  onPage: (page: number) => void;
  busy: boolean;
}) {
  const navigate = useNavigate();
  const canViewClients = useAccess().can("clients.view");
  const pageCount = Math.max(1, Math.ceil(portfolio.total / Math.max(1, portfolio.limit)));
  const open = (row: PortfolioRow) => navigate(locationPath(row.locationId));

  return (
    <section aria-labelledby="portfolio-title" aria-busy={busy || undefined} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={Briefcase} tone="clients" size="md" className="-mt-0.5" />
          <div className="min-w-0">
            <h2 id="portfolio-title" className="flex items-center gap-2 text-[15px] font-semibold leading-6 text-foreground">
              Portfolio
              {busy ? <LoaderCircle aria-label="Updating" className="size-3.5 animate-spin text-muted-foreground" /> : null}
            </h2>
            <p className="text-[13px] text-muted-foreground">Every client location. Sort by a column, open a row for the full picture.</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {/* Phones get cards instead of the table, so the column sort moves into a select. */}
          <Select
            value={MOBILE_SORTS.some((option) => option.value === `${sort}:${order}`) ? `${sort}:${order}` : ""}
            onValueChange={(value) => {
              const [field] = value.split(":") as [DashboardSort];
              onSort(field);
            }}
          >
            <SelectTrigger className="h-8 w-full min-w-0 flex-1 sm:w-48 sm:flex-none md:hidden" aria-label="Sort the portfolio">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {MOBILE_SORTS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canViewClients ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/clients">Manage clients</Link>
            </Button>
          ) : null}
        </div>
      </header>

      {portfolio.rows.length === 0 ? (
        <EmptyState compact variant="no-results" className="py-10" title="No locations on this page" description="Go back to the first page to see your locations." />
      ) : (
        <>
          <div className="hidden md:block">
            <TableScroll minWidth={940} label="Portfolio">
              <TableHead>
                <SortableTh label="Location" value="name" active={sort} order={order} onSort={onSort} className="min-w-[260px]" />
                <SortableTh label="Client" value="client" active={sort} order={order} onSort={onSort} />
                <SortableTh label="Avg. rank" value="rank" active={sort} order={order} onSort={onSort} align="right" />
                <Th align="right">Top 3</Th>
                <SortableTh label="Profile score" value="gbp_score" active={sort} order={order} onSort={onSort} align="right" />
                <Th align="right">Citations</Th>
                {/* One short word keeps the table inside its card on laptops; the tip and the phone cards say it in full. */}
                <Th align="right" className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-0.5">
                    Urgent<span className="sr-only"> reviews</span>
                    <InfoTip label="About urgent reviews">{URGENT_HELP}</InfoTip>
                  </span>
                </Th>
                <Th className="w-10" srOnly>
                  Open
                </Th>
              </TableHead>
              <TableBody>
                {portfolio.rows.map((row) => (
                  <tr
                    key={row.locationId}
                    onClick={() => open(row)}
                    onPointerEnter={() => preloadPath(locationPath(row.locationId))}
                    className="group cursor-pointer transition-colors hover:bg-accent/60"
                  >
                    <td className={tdClass}>
                      <span className="flex min-w-0 items-center gap-3">
                        <LocationAvatar name={row.name} />
                        <span className="min-w-0">
                          <Link
                            to={locationPath(row.locationId)}
                            onClick={(event) => event.stopPropagation()}
                            className="block truncate rounded-sm font-semibold text-foreground outline-hidden group-hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {row.name}
                          </Link>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            {row.city ?? "No city"}
                            {row.status !== "active" ? <LocationStatusBadge status={row.status} size="sm" /> : null}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={cn(tdClass, "max-w-[180px]")}>
                      <span className={cn("block truncate", row.clientName ? "text-foreground" : "text-muted-foreground")}>{row.clientName ?? "No client"}</span>
                    </td>
                    <td className={tdNumberClass}>{row.rank ? <RankFigure text={row.rank.text} change={row.rank.change} /> : <span className="text-muted-foreground">—</span>}</td>
                    <td className={tdNumberClass}>
                      {row.top3 === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="inline-flex items-baseline gap-1.5">
                          <span className="font-semibold">{row.top3}%</span>
                          {row.top3Change ? <TrendIndicator direction={row.top3Change > 0 ? "up" : "down"} value={`${Math.abs(row.top3Change)} pts`} positive={row.top3Change > 0} /> : null}
                        </span>
                      )}
                    </td>
                    <td className={tdNumberClass}>
                      <ScoreChip score={row.profileScore} grade={row.profileGrade} label="Profile score" />
                    </td>
                    <td className={tdNumberClass}>
                      <span className="inline-flex flex-col items-end">
                        <ScoreChip score={row.citationScore} label="Citation score" />
                        {row.citationNapWrong > 0 ? <span className="text-xs text-warning-foreground">{row.citationNapWrong} with wrong details</span> : null}
                      </span>
                    </td>
                    <td className={tdNumberClass}>
                      <UrgentReviews value={row.urgentReviews} />
                    </td>
                    <td className="px-2 py-3 text-right">
                      <ChevronRight aria-hidden className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" />
                    </td>
                  </tr>
                ))}
              </TableBody>
            </TableScroll>
          </div>

          <ul className="divide-y divide-border md:hidden">
            {portfolio.rows.map((row) => (
              <li key={row.locationId}>
                <Link to={locationPath(row.locationId)} className="group block px-4 py-3.5 outline-hidden transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span className="flex items-start gap-3">
                    <LocationAvatar name={row.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{row.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[row.city, row.clientName].filter(Boolean).join(" · ") || "No client"}</span>
                    </span>
                    <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  </span>
                  <span className="mt-3 grid grid-cols-3 gap-3 rounded-lg bg-surface-strong px-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">Avg. rank</span>
                      {row.rank ? <RankFigure text={row.rank.text} change={row.rank.change} /> : <span className="text-sm text-muted-foreground">—</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">Profile</span>
                      <ScoreChip score={row.profileScore} grade={row.profileGrade} label="Profile score" />
                    </span>
                    <span className="min-w-0" title={URGENT_HELP}>
                      <span className="block text-xs text-muted-foreground">Urgent reviews</span>
                      <span className="text-sm">
                        <UrgentReviews value={row.urgentReviews} />
                      </span>
                    </span>
                  </span>
                  {row.status !== "active" ? <LocationStatusBadge status={row.status} size="sm" className="mt-2.5" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {portfolio.total > portfolio.limit || portfolio.page > 1 ? (
        <TablePagination page={portfolio.page} pageCount={pageCount} totalItems={portfolio.total} pageSize={portfolio.limit} onPageChange={onPage} itemLabel="locations" />
      ) : (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          {portfolio.total.toLocaleString()} {portfolio.total === 1 ? "location" : "locations"}
        </p>
      )}
    </section>
  );
}
