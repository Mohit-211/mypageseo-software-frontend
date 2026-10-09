import { ExternalLink, Link2Off, ListChecks, MapPin, RefreshCw, Star, Tag, Trash2 } from "lucide-react";
import { formatDate as formatLocalDate } from "@/lib/datetime";
import type { LocationRow, LocationSortField, LocationStatus } from "@/api";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  MobileField,
  MobileListRow,
  RowActions,
  SortableTh,
  TableBody,
  TableCard,
  TableHead,
  TablePagination,
  TableRow,
  TableScroll,
  Th,
  tdClass,
  type SortOrder,
} from "@/components/layout/shared/data-table";
import { StatusBadge, TrendIndicator } from "@/components/layout/shared/data-display";

const statusMeta: Record<LocationStatus, { label: string; tone: "success" | "warning" | "critical" | "neutral" }> = {
  active: { label: "Active", tone: "success" },
  setup_required: { label: "Setup required", tone: "warning" },
  gbp_not_connected: { label: "No GBP", tone: "neutral" },
  gbp_disconnected: { label: "GBP disconnected", tone: "warning" },
  reconnect_required: { label: "Reconnect Google", tone: "critical" },
};

export function LocationRowStatusBadge({ status }: { status: LocationStatus }) {
  const meta = statusMeta[status] ?? { label: status, tone: "neutral" as const };
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
}

export type LocationRowActions = {
  onOpen: (location: LocationRow) => void;
  onContinueSetup: (location: LocationRow) => void;
  onReconnect: (location: LocationRow) => void;
  onUnbind: (location: LocationRow) => void;
  onDelete: (location: LocationRow) => void;
  /** Agency only. */
  onSetClient?: ((location: LocationRow) => void) | undefined;
};

/** The locations table over `GET locations` rows. Sorting and paging happen on the server. */
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
}) {
  return (
    <TableCard>
      <div className="hidden md:block">
        <TableScroll minWidth={1080} label="Locations">
          <TableHead>
            <SortableTh label="Location" value="name" active={sort} order={order} onSort={onSort} className="min-w-[240px]" />
            <SortableTh label="City" value="city" active={sort} order={order} onSort={onSort} />
            {agency ? <Th className="min-w-[140px]">Client</Th> : null}
            <SortableTh label="Avg. rank" value="rank" active={sort} order={order} onSort={onSort} />
            <SortableTh label="GBP score" value="gbp_score" active={sort} order={order} onSort={onSort} />
            <SortableTh label="Reviews" value="rating" active={sort} order={order} onSort={onSort} />
            <SortableTh label="Citations" value="citation_score" active={sort} order={order} onSort={onSort} />
            <Th>Status</Th>
            <SortableTh label="Last refreshed" value="last_refreshed" active={sort} order={order} onSort={onSort} />
            <Th className="w-12" srOnly>
              Actions
            </Th>
          </TableHead>
          <TableBody>
            {locations.map((location) => (
              <TableRow key={location.location_id}>
                <td className={tdClass}>
                  <button type="button" onClick={() => actions.onOpen(location)} className="group text-left">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary">
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      {location.name}
                    </span>
                    <span className="mt-1 block pl-5.5 text-xs text-muted-foreground">
                      {location.source === "gbp" ? "Google Business Profile" : "Added from Places search"}
                    </span>
                  </button>
                </td>
                <td className={tdClass}>{placeLabel(location)}</td>
                {agency ? <td className={tdClass}>{location.client?.name ?? "—"}</td> : null}
                <td className={tdClass}><RankCell location={location} /></td>
                <td className={tdClass}><GbpScoreCell location={location} /></td>
                <td className={tdClass}><ReviewsCell location={location} /></td>
                <td className={tdClass}><CitationsCell location={location} /></td>
                <td className={tdClass}><LocationRowStatusBadge status={location.status} /></td>
                <td className={tdClass}><span className="text-sm text-muted-foreground">{formatDate(location.last_refreshed_at)}</span></td>
                <td className="px-2 py-3.5"><RowMenu location={location} agency={agency} actions={actions} /></td>
              </TableRow>
            ))}
          </TableBody>
        </TableScroll>
      </div>

      <div className="divide-y divide-border md:hidden">
        {locations.map((location) => (
          <MobileListRow key={location.location_id}>
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => actions.onOpen(location)} className="min-w-0 text-left">
                <span className="block truncate text-sm font-semibold text-foreground">{location.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {placeLabel(location)}
                  {agency && location.client ? ` · ${location.client.name}` : ""}
                </span>
              </button>
              <RowMenu location={location} agency={agency} actions={actions} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 border-y border-border py-3">
              <MobileField label="Avg. rank" value={location.rank?.overall_avg_rank == null ? "—" : location.rank.overall_avg_rank.toFixed(1)} />
              <MobileField label="GBP score" value={location.gbp?.score == null ? "—" : `${location.gbp.score}${location.gbp.grade ? ` (${location.gbp.grade})` : ""}`} />
              <MobileField label="Citations" value={<CitationsCell location={location} />} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <ReviewsCell location={location} />
              <span className="text-xs text-muted-foreground">Refreshed {formatDate(location.last_refreshed_at)}</span>
              <LocationRowStatusBadge status={location.status} />
            </div>
          </MobileListRow>
        ))}
      </div>

      {attribution ? (
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          Business names, ratings and reviews: {attribution}
        </p>
      ) : null}
      <TablePagination
        page={page}
        pageCount={pageCount}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
        itemLabel="locations"
      />
    </TableCard>
  );
}

function placeLabel(location: LocationRow) {
  return [location.city, location.country].filter(Boolean).join(", ") || "—";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return formatLocalDate(iso);
}

const dash = <span className="text-sm text-muted-foreground">—</span>;

function RankCell({ location }: { location: LocationRow }) {
  const avg = location.rank?.overall_avg_rank;
  if (avg == null) return dash;
  const change = location.rank?.change;
  return (
    <div>
      <span className="text-sm font-semibold text-foreground">{avg.toFixed(1)}</span>
      {change != null ? (
        // `change` is previous − current: positive means the rank improved.
        <TrendIndicator
          direction={change > 0 ? "up" : change < 0 ? "down" : "flat"}
          value={Math.abs(change).toFixed(1)}
          positive={change > 0}
          className="mt-0.5 block"
        />
      ) : null}
    </div>
  );
}

function GbpScoreCell({ location }: { location: LocationRow }) {
  if (location.gbp?.score == null) return dash;
  return (
    <span className="text-sm font-medium text-foreground">
      {location.gbp.score}
      <span className="text-xs font-normal text-muted-foreground">/100</span>
      {location.gbp.grade ? <span className="ml-1.5 text-xs text-muted-foreground">{location.gbp.grade}</span> : null}
      {location.gbp.partial ? <span className="ml-1 text-xs text-muted-foreground" title="Some pillars aren't scored yet">*</span> : null}
    </span>
  );
}

function ReviewsCell({ location }: { location: LocationRow }) {
  const rating = location.reviews?.rating;
  if (rating == null) return dash;
  const count = location.reviews?.count;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-foreground">
      <Star className="size-3.5 fill-warning text-warning" aria-hidden />
      <span className="font-medium">{rating.toFixed(1)}</span>
      {count != null ? <span className="text-xs text-muted-foreground">({count.toLocaleString()})</span> : null}
    </span>
  );
}

function CitationsCell({ location }: { location: LocationRow }) {
  const citations = location.citations;
  if (citations?.score == null) return dash;
  return (
    <span className="text-sm font-medium text-foreground">
      {citations.score}
      <span className="text-xs font-normal text-muted-foreground">/100</span>
      {citations.grade ? <span className="ml-1.5 text-xs text-muted-foreground">{citations.grade}</span> : null}
      {citations.nap_wrong > 0 ? (
        <span className="mt-0.5 block text-xs font-normal text-warning-foreground">{citations.nap_wrong} wrong NAP</span>
      ) : null}
    </span>
  );
}

function RowMenu({ location, agency, actions }: { location: LocationRow; agency: boolean; actions: LocationRowActions }) {
  return (
    <RowActions label={`Actions for ${location.name}`}>
      <DropdownMenuItem onSelect={() => actions.onOpen(location)}>
        <ExternalLink aria-hidden /> Open location
      </DropdownMenuItem>
      {location.status === "setup_required" ? (
        <DropdownMenuItem onSelect={() => actions.onContinueSetup(location)}>
          <ListChecks aria-hidden /> Continue setup
        </DropdownMenuItem>
      ) : null}
      {location.status === "gbp_disconnected" ? (
        <DropdownMenuItem onSelect={() => actions.onReconnect(location)}>
          <RefreshCw aria-hidden /> Connect GBP again
        </DropdownMenuItem>
      ) : null}
      {location.status === "reconnect_required" ? (
        <DropdownMenuItem onSelect={() => actions.onReconnect(location)}>
          <RefreshCw aria-hidden /> Reconnect Google
        </DropdownMenuItem>
      ) : null}
      {agency && actions.onSetClient ? (
        <DropdownMenuItem onSelect={() => actions.onSetClient?.(location)}>
          <Tag aria-hidden /> {location.client ? "Change client" : "Set client"}
        </DropdownMenuItem>
      ) : null}
      {location.gbp_connected ? (
        <DropdownMenuItem onSelect={() => actions.onUnbind(location)}>
          <Link2Off aria-hidden /> Unbind GBP
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-critical focus:text-critical" onSelect={() => actions.onDelete(location)}>
        <Trash2 aria-hidden /> Delete location
      </DropdownMenuItem>
    </RowActions>
  );
}
