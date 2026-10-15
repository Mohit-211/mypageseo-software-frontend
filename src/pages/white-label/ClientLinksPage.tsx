import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2, Settings } from "lucide-react";
import { getWhiteLabelLinks, isApiError } from "@/api";
import { RequireAccess } from "@/components/mypageseo/access";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { TableBody, TableCard, TableHead, TablePagination, TableRow, TableScroll, Th, tdClass } from "@/components/layout/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { CLIENT_LINK_REPORT_LABEL, WHITE_LABEL_LINKS_KEY } from "@/lib/white-label/client-links";

const PAGE_SIZE = 25;

/** Every active white-label client link of the agency (`GET white-label-links`), one row per location. */
function ClientLinksPage() {
  return (
    <RequireAccess permission="clients.view">
      <AppShell>
        <PageHeader
          title="Client links"
          description="One page per location for your client, with your branding and the reports you chose. Each updates after every refresh; your client can open earlier versions from it."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm"><Link to="/reports">Back to reports</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/settings/white-label"><Settings aria-hidden /> White-label settings</Link></Button>
            </div>
          }
        />
        <div className="mt-5">
          <ClientLinksTable />
        </div>
      </AppShell>
    </RequireAccess>
  );
}

function ClientLinksTable() {
  const [page, setPage] = useState(1);
  const links = useQuery({
    queryKey: [...WHITE_LABEL_LINKS_KEY, { page }],
    queryFn: ({ signal }) => getWhiteLabelLinks({ page, limit: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
    retry: (count, error) => !(isApiError(error) && error.status === 403) && count < 2,
  });

  if (links.isPending) return <TableSkeleton rows={5} columns={6} />;
  if (links.isError) {
    if (isApiError(links.error) && links.error.reason === "feature_not_included") {
      return <EmptyState icon={Link2} title="Client links aren't in your plan" description="Upgrade to a plan with white-label to send your clients a branded page for each location." action={<Button asChild><Link to="/settings/billing">Billing</Link></Button>} />;
    }
    return <ErrorState description="Client links couldn't be loaded." onRetry={() => void links.refetch()} />;
  }

  const { results, total } = links.data;
  if (results.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No client links yet"
        description="Open a location's Reports page and create its client link. It shows your branding and the reports you choose, and updates after every refresh."
        action={<Button asChild variant="outline"><Link to="/locations">Locations</Link></Button>}
      />
    );
  }

  return (
    <TableCard>
      <TableScroll minWidth={920} label="Client links">
        <TableHead>
          <Th>Location</Th>
          <Th>Link</Th>
          <Th>Reports</Th>
          <Th>Views</Th>
          <Th>Updated</Th>
          <Th>Created</Th>
        </TableHead>
        <TableBody>
          {results.map((row) => (
            <TableRow key={row.location.id}>
              <td className={tdClass}>
                <Link to={`/locations/${row.location.id}/reports`} className="font-semibold text-foreground hover:text-primary hover:underline">
                  {row.location.name}
                </Link>
                <span className="block text-xs text-muted-foreground">{[row.location.city, row.location.state].filter(Boolean).join(", ") || "—"}</span>
              </td>
              <td className={tdClass}>
                <div className="flex items-center gap-1">
                  <span className="max-w-56 truncate font-mono text-xs text-muted-foreground" title={row.url}>{row.url}</span>
                  <Button size="icon" variant="ghost" className="size-7" aria-label={`Copy the link for ${row.location.name}`} onClick={() => void navigator.clipboard.writeText(row.url).then(() => toast.success("Link copied"))}>
                    <Copy aria-hidden className="size-3.5" />
                  </Button>
                  <Button asChild size="icon" variant="ghost" className="size-7" aria-label={`Open the client page for ${row.location.name}`}>
                    <a href={row.url} target="_blank" rel="noreferrer noopener"><ExternalLink aria-hidden className="size-3.5" /></a>
                  </Button>
                </div>
                {row.branding_override ? <StatusBadge tone="brand" className="mt-1">Own branding</StatusBadge> : null}
              </td>
              <td className={tdClass}>
                <div className="flex max-w-64 flex-wrap gap-1">
                  {row.reports.map((type) => <StatusBadge key={type}>{CLIENT_LINK_REPORT_LABEL[type] ?? type}</StatusBadge>)}
                </div>
              </td>
              <td className={tdClass}>
                {row.views}
                <span className="block text-xs text-muted-foreground">{row.last_viewed_at ? `Last ${formatDateTime(row.last_viewed_at)}` : "Not opened yet"}</span>
              </td>
              <td className={tdClass}><span className="text-muted-foreground">{formatDate(row.last_edition_at)}</span></td>
              <td className={tdClass}><span className="text-muted-foreground">{formatDate(row.created_at)}</span></td>
            </TableRow>
          ))}
        </TableBody>
      </TableScroll>
      <TablePagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="links" />
    </TableCard>
  );
}

export default ClientLinksPage;
