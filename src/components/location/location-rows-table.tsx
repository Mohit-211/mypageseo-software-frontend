import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, Link2, Link2Off, ListTodo, RefreshCw, Star, Tag, Trash2 } from "lucide-react";
import type { LocationRow, LocationSortField, LocationStatus } from "@/api";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  RowActions,
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
import { useNow } from "@/hooks/use-now";
import { avgRankText } from "@/lib/rankings/format";
import { formatDate, formatRelative } from "@/lib/datetime";
import { locationPath } from "@/lib/mypageseo/section-links";
import { cn } from "@/lib/utils";

/** Kept for older imports: the status badge of a locations row. */
export function LocationRowStatusBadge({ status }: { status: LocationStatus }) {
  return <LocationStatusBadge status={status} />;
}

/** Write actions are left out for a read-only client_user, which hides their menu items. */
export type LocationRowActions = {
  onOpen: (location: LocationRow) => void;
  onContinueSetup?: ((location: LocationRow) => void) | undefined;
  onReconnect?: ((location: LocationRow) => void) | undefined;
  onUnbind?: ((location: LocationRow) => void) | undefined;
  onDelete?: ((location: LocationRow) => void) | undefined;
  /** Agency only. */
  onSetClient?: ((location: LocationRow) => void) | undefined;
};

// The ::after pads the small text button out to a finger-sized target without moving the layout.
const INLINE_ACTION =
  "relative z-10 inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-semibold text-primary underline-offset-4 outline-hidden after:absolute after:-inset-x-1.5 after:-inset-y-2.5 after:content-[''] hover:text-primary-hover hover:underline focus-visible:ring-2 focus-visible:ring-ring";

/** "Toronto, Canada" (and the client for agencies). */
function placeLine(location: LocationRow, agency: boolean): string {
  const place = [location.city, location.country].filter(Boolean).join(", ") || "No address";
  return agency && location.client ? `${place} · ${location.client.name}` : place;
}

/** The one fix a status needs, right next to it (setup, reconnect). */
function StatusFix({ location, actions }: { location: LocationRow; actions: LocationRowActions }) {
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  if (location.status === "setup_required" && actions.onContinueSetup) {
    return (
      <button
        type="button"
        className={INLINE_ACTION}
        onClick={(event) => {
          stop(event);
          actions.onContinueSetup?.(location);
        }}
      >
        Continue setup <ArrowRight aria-hidden className="size-3.5" />
      </button>
    );
  }
  if ((location.status === "reconnect_required" || location.status === "gbp_disconnected") && actions.onReconnect) {
    return (
      <button
        type="button"
        className={INLINE_ACTION}
        onClick={(event) => {
          stop(event);
          actions.onReconnect?.(location);
        }}
      >
        <Link2 aria-hidden className="size-3.5" /> {location.status === "reconnect_required" ? "Reconnect" : "Connect again"}
      </button>
    );
  }
  return null;
}

function Reviews({ location }: { location: LocationRow }) {
  const rating = location.reviews?.rating;
  if (rating == null) return <span className="text-sm text-muted-foreground">—</span>;
  const count = location.reviews?.count;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-foreground">
      <Star className="size-3.5 fill-warning-bright text-warning" aria-hidden />
      <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>
      {count != null ? <span className="text-xs tabular-nums text-muted-foreground">({count.toLocaleString()})</span> : null}
    </span>
  );
}

function Citations({ location, align = "end" }: { location: LocationRow; align?: "start" | "end" }) {
  const citations = location.citations;
  if (citations?.score == null) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex flex-col", align === "end" ? "items-end" : "items-start")}>
      <ScoreChip score={citations.score} grade={citations.grade} label="Citation score" />
      {citations.nap_wrong > 0 ? <span className="text-xs text-warning-foreground">{citations.nap_wrong} with wrong details</span> : null}
    </span>
  );
}

function Rank({ location }: { location: LocationRow }) {
  if (!location.rank || (location.rank.overall_avg_rank == null && !location.rank.status)) return <span className="text-sm text-muted-foreground">—</span>;
  return <RankFigure text={avgRankText(location.rank.overall_avg_rank, location.rank.status, location.rank.display)} change={location.rank.change} />;
}

function Refreshed({ iso, now }: { iso: string | null; now: number }) {
  if (!iso) return <span className="text-sm text-muted-foreground">Not yet</span>;
  return (
    <time dateTime={iso} title={formatDate(iso)} className="whitespace-nowrap text-sm text-muted-foreground">
      {formatRelative(iso, now)}
    </time>
  );
}

function MobileMetric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="min-w-0">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="mt-0.5 block">{children}</span>
    </span>
  );
}

/**
 * The locations table over `GET locations` rows. Sorting and paging happen on the server; a row
 * opens the location's overview. Below `md` the rows become cards (no sideways scrolling).
 */
export function LocationRowsTable({
  locations,
  agency,
  sort,
  order,
  page,
  pageCount,
  total,
  pageSize,
  attribution,
  onSort,
  onPageChange,
  actions,
  toolbar,
  empty,
}: {
  locations: LocationRow[];
  agency: boolean;
  sort: LocationSortField;
  order: SortOrder;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  attribution: string | null;
  onSort: (sort: LocationSortField) => void;
  onPageChange: (page: number) => void;
  actions: LocationRowActions;
  /** Search and filters, drawn inside the card above the rows. */
  toolbar?: ReactNode;
  /**
   * Shown under the toolbar instead of the rows when `locations` is empty (no search results). The
   * toolbar stays the same element, so the search box keeps focus while the results come and go.
   */
  empty?: ReactNode;
}) {
  const now = useNow();
  if (locations.length === 0 && empty) {
    return (
      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {toolbar}
        {empty}
      </div>
    );
  }
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      {toolbar}
      <div className="hidden md:block">
        <TableScroll minWidth={960} label="Locations">
          <TableHead>
            <SortableTh label="Location" value="name" active={sort} order={order} onSort={onSort} className="min-w-[260px]" />
            <Th>Status</Th>
            <SortableTh label="Avg. rank" value="rank" active={sort} order={order} onSort={onSort} align="right" />
            <SortableTh label="Profile score" value="gbp_score" active={sort} order={order} onSort={onSort} align="right" />
            <SortableTh label="Reviews" value="rating" active={sort} order={order} onSort={onSort} align="right" />
            <SortableTh label="Citations" value="citation_score" active={sort} order={order} onSort={onSort} align="right" />
            <SortableTh label="Refreshed" value="last_refreshed" active={sort} order={order} onSort={onSort} align="right" />
            <Th className="w-12" srOnly>
              Actions
            </Th>
          </TableHead>
          <TableBody>
            {locations.map((location) => (
              <tr key={location.location_id} onClick={() => actions.onOpen(location)} className="group cursor-pointer transition-colors hover:bg-accent/60">
                <td className={tdClass}>
                  <span className="flex min-w-0 items-center gap-3">
                    <LocationAvatar name={location.name} />
                    <span className="min-w-0">
                      <Link
                        to={locationPath(location.location_id)}
                        onClick={(event) => event.stopPropagation()}
                        className="block truncate rounded-sm font-semibold text-foreground outline-hidden group-hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {location.name}
                      </Link>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{placeLine(location, agency)}</span>
                    </span>
                  </span>
                </td>
                <td className={tdClass}>
                  <span className="flex flex-col items-start gap-1">
                    <LocationStatusBadge status={location.status} size="sm" />
                    <StatusFix location={location} actions={actions} />
                  </span>
                </td>
                <td className={tdNumberClass}>
                  <Rank location={location} />
                </td>
                <td className={tdNumberClass}>
                  <ScoreChip score={location.gbp?.score} grade={location.gbp?.grade} label="Profile score" />
                </td>
                <td className={tdNumberClass}>
                  <Reviews location={location} />
                </td>
                <td className={tdNumberClass}>
                  <Citations location={location} />
                </td>
                <td className={tdNumberClass}>
                  <Refreshed iso={location.last_refreshed_at} now={now} />
                </td>
                <td className="px-2 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                  <RowMenu location={location} agency={agency} actions={actions} />
                </td>
              </tr>
            ))}
          </TableBody>
        </TableScroll>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {locations.map((location) => (
          <li key={location.location_id} className="px-4 py-3.5">
            <div className="flex items-start gap-3">
              <Link to={locationPath(location.location_id)} className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                <LocationAvatar name={location.name} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{location.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{placeLine(location, agency)}</span>
                </span>
              </Link>
              <RowMenu location={location} agency={agency} actions={actions} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <LocationStatusBadge status={location.status} size="sm" />
              <StatusFix location={location} actions={actions} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg bg-surface-strong px-3 py-2.5">
              <MobileMetric label="Avg. rank">
                <Rank location={location} />
              </MobileMetric>
              <MobileMetric label="Profile">
                <ScoreChip score={location.gbp?.score} grade={location.gbp?.grade} label="Profile score" />
              </MobileMetric>
              <MobileMetric label="Citations">
                <Citations location={location} align="start" />
              </MobileMetric>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <Reviews location={location} />
              <span className="text-xs text-muted-foreground">
                Refreshed <Refreshed iso={location.last_refreshed_at} now={now} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      {attribution ? <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Business names, ratings and reviews: {attribution}</p> : null}
      <TablePagination page={page} pageCount={pageCount} totalItems={total} pageSize={pageSize} onPageChange={onPageChange} itemLabel="locations" />
    </div>
  );
}

function RowMenu({ location, agency, actions }: { location: LocationRow; agency: boolean; actions: LocationRowActions }) {
  return (
    <RowActions label={`Actions for ${location.name}`}>
      <DropdownMenuItem onSelect={() => actions.onOpen(location)}>
        <ExternalLink aria-hidden /> Open location
      </DropdownMenuItem>
      {location.status === "setup_required" && actions.onContinueSetup ? (
        <DropdownMenuItem onSelect={() => actions.onContinueSetup?.(location)}>
          <ListTodo aria-hidden /> Continue setup
        </DropdownMenuItem>
      ) : null}
      {location.status === "gbp_disconnected" && actions.onReconnect ? (
        <DropdownMenuItem onSelect={() => actions.onReconnect?.(location)}>
          <RefreshCw aria-hidden /> Connect Google again
        </DropdownMenuItem>
      ) : null}
      {location.status === "reconnect_required" && actions.onReconnect ? (
        <DropdownMenuItem onSelect={() => actions.onReconnect?.(location)}>
          <RefreshCw aria-hidden /> Reconnect Google
        </DropdownMenuItem>
      ) : null}
      {agency && actions.onSetClient ? (
        <DropdownMenuItem onSelect={() => actions.onSetClient?.(location)}>
          <Tag aria-hidden /> {location.client ? "Change client" : "Set client"}
        </DropdownMenuItem>
      ) : null}
      {location.gbp_connected && actions.onUnbind ? (
        <DropdownMenuItem onSelect={() => actions.onUnbind?.(location)}>
          <Link2Off aria-hidden /> Disconnect Google profile
        </DropdownMenuItem>
      ) : null}
      {actions.onDelete ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-critical focus:text-critical" onSelect={() => actions.onDelete?.(location)}>
            <Trash2 aria-hidden /> Delete location
          </DropdownMenuItem>
        </>
      ) : null}
    </RowActions>
  );
}
