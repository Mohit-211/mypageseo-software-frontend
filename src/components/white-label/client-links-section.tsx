import { useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Copy, ExternalLink, Gem, Info, MapPin, Plus, RotateCcw, Search, Settings2 } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import {
  SortableTh,
  TableBody,
  TableCard,
  TableHead,
  TablePagination,
  TableRow,
  TableScroll,
  Th,
  tdClass,
  tdMutedClass,
  type SortOrder,
} from "@/components/layout/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useNow } from "@/hooks/use-now";
import { formatDate, formatRelative } from "@/lib/datetime";
import { sortRows } from "@/lib/sort";
import { CLIENT_LINK_REPORTS, CLIENT_LINK_REPORT_LABEL, isNeutralLink, shortLinkLabel } from "@/lib/white-label/client-links";
import { clientLinkComparator, matchesClientLinkSearch, type ClientLinkRow, type ClientLinkSort } from "@/lib/white-label/use-client-links";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
type StatusFilter = "all" | "live" | "none";

/**
 * ② Client links: every location of the page in one table, live or not. Copy and open a live link
 * in place; "Manage" / "Create link" opens the location's link editor in the drawer.
 */
export function ClientLinksSection({
  rows,
  loading,
  error,
  featureMissing,
  hasLocations,
  canEdit,
  canBilling,
  blockedReason,
  onRetry,
  onOpen,
}: {
  /** Locations with their link, already narrowed by the page's client / location filter. */
  rows: ClientLinkRow[];
  loading: boolean;
  /** A load failure other than "not in your plan". */
  error: boolean;
  featureMissing: boolean;
  /** The workspace has at least one location (else the next step is adding one). */
  hasLocations: boolean;
  canEdit: boolean;
  canBilling: boolean;
  /** Why creating links is off (read-only or suspended account). */
  blockedReason: string | null;
  onRetry: () => void;
  onOpen: (row: ClientLinkRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<ClientLinkSort>("default");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);

  if (featureMissing) {
    return (
      <EmptyState
        icon={Gem}
        tone="brand"
        title="Client links aren't in your plan"
        description="Upgrade to a plan with white label to send each client a live page with your brand, for every location."
        action={
          canBilling ? (
            <Button asChild>
              <Link to="/settings/billing">See plans in Billing</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (!hasLocations) {
    return (
      <EmptyState
        icon={MapPin}
        tone="locations"
        title="Add a location first"
        description="Each client link shows one location's results. Add the business you work on, then create its link here."
        action={
          <Button asChild>
            <Link to="/locations/add">
              <Plus aria-hidden /> Add location
            </Link>
          </Button>
        }
      />
    );
  }
  if (loading) return <TableSkeleton rows={4} columns={6} />;
  if (error) return <ErrorState compact description="Your client links couldn't be loaded." onRetry={onRetry} />;

  const liveCount = rows.filter((row) => row.link).length;
  const counts: Record<StatusFilter, number> = { all: rows.length, live: liveCount, none: rows.length - liveCount };
  const visible = sortRows(
    rows.filter((row) => (status === "all" || (status === "live") === Boolean(row.link)) && matchesClientLinkSearch(row, search)),
    clientLinkComparator(sort, order),
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filtered = status !== "all" || search.trim() !== "";
  const showClient = rows.some((row) => row.clientName);
  const notNeutral = rows.some((row) => row.link && !isNeutralLink(row.link.url));

  const onSort = (next: ClientLinkSort) => {
    if (sort === next) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSort(next);
      // Names read A to Z; numbers and dates are most useful largest / newest first.
      setOrder(next === "name" ? "asc" : "desc");
    }
    setPage(1);
  };

  return (
    <div className="space-y-3">
      <TableCard>
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xs">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={showClient ? "Search locations or clients" : "Search locations"}
              aria-label="Search client links"
              className="h-9 pl-9"
            />
          </div>
          <SegmentedControl
            size="sm"
            aria-label="Show"
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: `All · ${counts.all}` },
              { value: "live", label: `Live · ${counts.live}` },
              { value: "none", label: `No link · ${counts.none}` },
            ]}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            variant="no-results"
            title={status === "live" && !search ? "No live links yet" : "No locations match"}
            description={status === "live" && !search ? "Create a link from the “No link” list to share a live page." : "Try a shorter search, or show every location."}
            action={
              filtered ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                  }}
                >
                  <RotateCcw aria-hidden /> Show every location
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Phones: one card per location; the table needs more room than a phone has. */}
            <ul className="divide-y divide-border md:hidden">
              {pageRows.map((row) => (
                <li key={row.id} className="space-y-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{[row.area, row.clientName].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <LinkStatus row={row} />
                  </div>
                  {row.link ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-strong px-3 py-2">
                      <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{shortLinkLabel(row.link.url)}</span>
                      <CopyOpen url={row.link.url} name={row.name} />
                    </div>
                  ) : null}
                  {row.link ? <Visits row={row} inline /> : null}
                  <RowAction row={row} canEdit={canEdit} blockedReason={blockedReason} onOpen={onOpen} wide />
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
              <TableScroll minWidth={1000} label="Client links">
                <TableHead>
                  <SortableTh label="Location" value="name" active={sort === "default" ? null : sort} order={order} onSort={onSort} />
                  <Th>Status</Th>
                  <Th>Client link</Th>
                  <Th>Shows</Th>
                  <SortableTh label="Visits" value="visits" active={sort === "default" ? null : sort} order={order} onSort={onSort} align="right" />
                  <SortableTh label="Updated" value="updated" active={sort === "default" ? null : sort} order={order} onSort={onSort} />
                  <Th srOnly className="w-28">
                    Actions
                  </Th>
                </TableHead>
                <TableBody>
                  {pageRows.map((row) => (
                    <TableRow key={row.id} className="cursor-pointer">
                      <td className={tdClass} onClick={(event) => openFromCell(event, row, onOpen)}>
                        <button
                          type="button"
                          onClick={() => onOpen(row)}
                          className="block max-w-60 truncate rounded-sm text-left font-semibold text-foreground underline-offset-2 outline-hidden hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {row.name}
                        </button>
                        <span className="block max-w-60 truncate text-xs text-muted-foreground">
                          {[row.area, row.clientName].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </td>
                      <td className={tdClass} onClick={(event) => openFromCell(event, row, onOpen)}>
                        <LinkStatus row={row} />
                      </td>
                      <td className={tdClass} onClick={(event) => openFromCell(event, row, onOpen)}>
                        {row.link ? <CopyOpen url={row.link.url} name={row.name} labelled /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className={tdClass} onClick={(event) => openFromCell(event, row, onOpen)}>
                        {row.link ? <ReportChips reports={row.link.reports} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className={cn(tdClass, "text-right")} onClick={(event) => openFromCell(event, row, onOpen)}>
                        {row.link ? <Visits row={row} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className={cn(tdMutedClass, "whitespace-nowrap")} onClick={(event) => openFromCell(event, row, onOpen)}>
                        {row.link ? formatDate(row.link.last_edition_at ?? row.link.created_at) : "—"}
                      </td>
                      <td className={cn(tdClass, "text-right")}>
                        <RowAction row={row} canEdit={canEdit} blockedReason={blockedReason} onOpen={onOpen} />
                      </td>
                    </TableRow>
                  ))}
                </TableBody>
              </TableScroll>
            </div>
            {visible.length > PAGE_SIZE ? (
              <TablePagination page={current} pageCount={pageCount} totalItems={visible.length} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="locations" />
            ) : null}
          </>
        )}
      </TableCard>
      <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <Info aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>
          {notNeutral
            ? "Links move to a neutral address automatically once it's switched on; the page itself never mentions MyPageSEO."
            : "Client pages never mention MyPageSEO."}{" "}
          Using your own domain: coming soon.
        </span>
      </p>
    </div>
  );
}

/** A click on the row (outside its own buttons and links) opens the drawer too. */
function openFromCell(event: MouseEvent<HTMLElement>, row: ClientLinkRow, onOpen: (row: ClientLinkRow) => void) {
  if ((event.target as HTMLElement).closest("a, button, input")) return;
  onOpen(row);
}

function LinkStatus({ row }: { row: ClientLinkRow }) {
  if (!row.link) return <StatusBadge tone="neutral">No link</StatusBadge>;
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge tone="success" dot>
        Live
      </StatusBadge>
      {row.link.branding_override ? (
        <StatusBadge tone="brand" size="sm">
          Own branding
        </StatusBadge>
      ) : null}
    </span>
  );
}

function CopyOpen({ url, name, labelled }: { url: string; name: string; labelled?: boolean }) {
  const copy = () =>
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied", { description: name }),
      () => toast.error("Couldn't copy. Open the link and copy it from the address bar."),
    );
  return (
    <span className="flex shrink-0 items-center gap-1">
      {labelled ? (
        <Button size="sm" variant="outline" title={url} aria-label={`Copy the client link for ${name}`} onClick={copy}>
          <Copy aria-hidden /> Copy link
        </Button>
      ) : (
        <Button size="icon" variant="ghost" className="size-9" aria-label={`Copy the client link for ${name}`} onClick={copy}>
          <Copy aria-hidden className="size-4" />
        </Button>
      )}
      <Button asChild size="icon" variant="ghost" className="size-9" aria-label={`Open the client page for ${name} in a new tab`}>
        <a href={url} target="_blank" rel="noreferrer noopener">
          <ExternalLink aria-hidden className="size-4" />
        </a>
      </Button>
    </span>
  );
}

/** The link's reports in page order: two named, the rest counted. */
function ReportChips({ reports }: { reports: string[] }) {
  const ordered = CLIENT_LINK_REPORTS.map((entry) => entry.value).filter((value) => reports.includes(value));
  const shown = ordered.slice(0, 2);
  const rest = ordered.slice(2);
  return (
    <div className="flex max-w-52 flex-wrap gap-1">
      {shown.map((type) => (
        <StatusBadge key={type} tone="neutral" size="sm">
          {CLIENT_LINK_REPORT_LABEL[type] ?? type}
        </StatusBadge>
      ))}
      {rest.length > 0 ? (
        <span title={rest.map((type) => CLIENT_LINK_REPORT_LABEL[type] ?? type).join(", ")}>
          <StatusBadge tone="neutral" size="sm">
            +{rest.length}
          </StatusBadge>
        </span>
      ) : null}
    </div>
  );
}

function Visits({ row, inline }: { row: ClientLinkRow; inline?: boolean }) {
  const now = useNow();
  const link = row.link!;
  const last = link.last_viewed_at ? `opened ${formatRelative(link.last_viewed_at, now)}` : "not opened yet";
  if (inline) {
    return (
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">{link.views}</span> visit{link.views === 1 ? "" : "s"} · {last}
      </p>
    );
  }
  return (
    <span className="block">
      <span className="block font-semibold tabular-nums text-foreground">{link.views.toLocaleString()}</span>
      <span className="block whitespace-nowrap text-xs text-muted-foreground">{last}</span>
    </span>
  );
}

function RowAction({
  row,
  canEdit,
  blockedReason,
  onOpen,
  wide,
}: {
  row: ClientLinkRow;
  canEdit: boolean;
  blockedReason: string | null;
  onOpen: (row: ClientLinkRow) => void;
  wide?: boolean;
}) {
  if (row.link || !canEdit) {
    return (
      <Button size="sm" variant="outline" className={cn(wide && "w-full")} onClick={() => onOpen(row)}>
        <Settings2 aria-hidden /> {row.link ? "Manage" : "View"}
      </Button>
    );
  }
  // Outline like "Manage": one per location without a link, so a filled one would outshout the
  // header's "New client link" (the page's one filled action).
  return (
    <span title={blockedReason ?? undefined} className={cn(wide && "block")}>
      <Button size="sm" variant="outline" className={cn(wide && "w-full")} disabled={blockedReason !== null} onClick={() => onOpen(row)}>
        <Plus aria-hidden /> Create link
      </Button>
    </span>
  );
}
