import { Link } from "react-router-dom";
import { ExternalLink, MapPin, Star, TrendingUp } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
} from "@/components/mypageseo/table";
import { StatusBadge, TrendIndicator } from "@/components/mypageseo/data-display";
import type { ManagedLocation, LocationStatus } from "@/lib/mypageseo/locations-data";

export type LocationSort = "location" | "visibility" | "gbp" | "reviews" | "rank" | "status";
export type { SortOrder };

const statusMeta: Record<LocationStatus, { label: string; tone: "success" | "warning" | "critical" }> = {
  active: { label: "Active", tone: "success" },
  setup_required: { label: "Setup required", tone: "warning" },
  disconnected: { label: "Disconnected", tone: "critical" },
};

export function LocationStatusBadge({ status }: { status: LocationStatus }) {
  const meta = statusMeta[status];
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
}

export function LocationsTable({
  locations,
  agency,
  sort,
  order,
  page,
  pageCount,
  onSort,
  onPageChange,
  onOpen,
}: {
  locations: ManagedLocation[];
  agency: boolean;
  sort: LocationSort;
  order: SortOrder;
  page: number;
  pageCount: number;
  onSort: (sort: LocationSort) => void;
  onPageChange: (page: number) => void;
  onOpen: (location: ManagedLocation) => void;
}) {
  return (
    <TableCard>
      <div className="hidden md:block">
        <TableScroll minWidth={940} label="Locations">
          <TableHead>
            <SortableTh label="Location" value="location" active={sort} order={order} onSort={onSort} className="min-w-[250px]" />
            {agency ? <Th className="min-w-[150px]">Client</Th> : null}
            <SortableTh label="Visibility" value="visibility" active={sort} order={order} onSort={onSort} />
            <SortableTh label="GBP" value="gbp" active={sort} order={order} onSort={onSort} />
            <SortableTh label="Reviews" value="reviews" active={sort} order={order} onSort={onSort} />
            <SortableTh label="Rank" value="rank" active={sort} order={order} onSort={onSort} />
            <SortableTh label="Status" value="status" active={sort} order={order} onSort={onSort} />
            <Th className="w-12" srOnly>
              Actions
            </Th>
          </TableHead>
          <TableBody>
            {locations.map((location) => (
              <TableRow key={location.id}>
                <td className={tdClass}>
                  <button type="button" onClick={() => onOpen(location)} className="group text-left">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary">
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      {location.businessName}
                    </span>
                    <span className="mt-1 block pl-5.5 text-xs text-muted-foreground">{location.area}</span>
                  </button>
                </td>
                {agency ? <td className={tdClass}>{location.clientName ?? "—"}</td> : null}
                <td className={tdClass}><VisibilityCell location={location} /></td>
                <td className={tdClass}><ScoreValue value={location.gbpHealth} suffix="/100" /></td>
                <td className={tdClass}><ReviewsCell location={location} /></td>
                <td className={tdClass}><ScoreValue value={location.averageRank} /></td>
                <td className={tdClass}><LocationStatusBadge status={location.status} /></td>
                <td className="px-2 py-3.5"><RowMenu location={location} onOpen={onOpen} /></td>
              </TableRow>
            ))}
          </TableBody>
        </TableScroll>
      </div>

      <div className="divide-y divide-border md:hidden">
        {locations.map((location) => (
          <MobileListRow key={location.id}>
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onOpen(location)} className="min-w-0 text-left">
                <span className="block truncate text-sm font-semibold text-foreground">{location.businessName}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{location.area}{agency && location.clientName ? ` · ${location.clientName}` : ""}</span>
              </button>
              <RowMenu location={location} onOpen={onOpen} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 border-y border-border py-3">
              <MobileField label="Visibility" value={location.visibility === null ? "—" : `${location.visibility}%`} />
              <MobileField label="GBP" value={location.gbpHealth === null ? "—" : `${location.gbpHealth}`} />
              <MobileField label="Avg. rank" value={location.averageRank === null ? "—" : location.averageRank.toFixed(1)} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <ReviewsCell location={location} />
              <LocationStatusBadge status={location.status} />
            </div>
          </MobileListRow>
        ))}
      </div>

      <TablePagination page={page} pageCount={pageCount} onPageChange={onPageChange} itemLabel="locations" />
    </TableCard>
  );
}

function VisibilityCell({ location }: { location: ManagedLocation }) {
  if (location.visibility === null) return <span className="text-sm text-muted-foreground">—</span>;
  const change = location.visibilityChange ?? 0;
  return (
    <div>
      <span className="text-sm font-semibold text-foreground">{location.visibility}%</span>
      <TrendIndicator direction={change > 0 ? "up" : change < 0 ? "down" : "flat"} value={`${Math.abs(change).toFixed(1)}%`} positive={change > 0} className="mt-0.5 block" />
    </div>
  );
}

function ScoreValue({ value, suffix }: { value: number | null; suffix?: string }) {
  return value === null ? <span className="text-sm text-muted-foreground">—</span> : <span className="text-sm font-medium text-foreground">{value}{suffix ? <span className="text-xs font-normal text-muted-foreground">{suffix}</span> : null}</span>;
}

function ReviewsCell({ location }: { location: ManagedLocation }) {
  if (location.rating === undefined || location.reviewCount === undefined) return <span className="text-sm text-muted-foreground">—</span>;
  return <span className="inline-flex items-center gap-1 text-sm text-foreground"><Star className="size-3.5 fill-warning text-warning" aria-hidden /><span className="font-medium">{location.rating.toFixed(1)}</span><span className="text-xs text-muted-foreground">({location.reviewCount.toLocaleString()})</span></span>;
}

function RowMenu({ location, onOpen }: { location: ManagedLocation; onOpen: (location: ManagedLocation) => void }) {
  return (
    <RowActions label={`Actions for ${location.businessName}`}>
      <DropdownMenuItem onSelect={() => onOpen(location)}>
        <ExternalLink aria-hidden /> Open location
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to={`/locations/${location.id}/rankings`}>
          <TrendingUp aria-hidden /> View rankings
        </Link>
      </DropdownMenuItem>
    </RowActions>
  );
}
