import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/layout/shared/data-display";
import { TableCard, TablePagination, TableToolbar } from "@/components/layout/shared/data-table";
import { NoResultsEmpty } from "@/components/layout/shared/feedback/empty-states";
import { FilterBarSkeleton, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  REPORT_STATUS_LABEL,
  reportPath,
  whiteLabelActions,
  withScheme,
  type ReportStatus,
  type WhiteLabelSnapshot,
} from "@/lib/white-label/white-label";
import { NoClientReportsEmpty } from "../empty-states";
import { copyText } from "../white-label-theme";
import { ClientReportCard } from "./client-report-card";
import { ClientReportTable } from "./client-report-table";
import type { ReportRow, ReportRowHandlers } from "./report-row";
import { ShareReportModal } from "./share-report-modal";

const PAGE_SIZE = 10;

type StatusFilter = "all" | ReportStatus;

export function ClientReports({
  snapshot,
  onCreate,
  onPreview,
}: {
  snapshot: WhiteLabelSnapshot;
  onCreate: () => void;
  onPreview: (reportId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [shareId, setShareId] = useState<string | null>(null);
  const [disableRow, setDisableRow] = useState<ReportRow | null>(null);

  const allRows = useMemo<ReportRow[]>(
    () =>
      snapshot.reports.flatMap((report) => {
        const client = snapshot.clients.find((c) => c.id === report.clientId);
        return client ? [{ report, client, url: reportPath(snapshot.domain, snapshot.agencySlug, client) }] : [];
      }),
    [snapshot.reports, snapshot.clients, snapshot.domain, snapshot.agencySlug],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allRows.filter(
      (row) =>
        (status === "all" || row.report.status === status) &&
        (!query || row.client.name.toLowerCase().includes(query) || row.url.toLowerCase().includes(query) || row.client.category.toLowerCase().includes(query)),
    );
  }, [allRows, search, status]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // Look the row up live so the share modal reflects status changes.
  const shareRow = shareId ? (allRows.find((r) => r.report.id === shareId) ?? null) : null;
  const filtersActive = search.trim() !== "" || status !== "all";

  const reset = () => {
    setSearch("");
    setStatus("all");
    setPage(1);
  };

  const handlers: ReportRowHandlers = {
    onView: (row) => onPreview(row.report.id),
    onCopy: (row) => void copyText(withScheme(row.url), "Report link copied."),
    onShare: (row) => setShareId(row.report.id),
    onPublish: async (row) => {
      await whiteLabelActions.updateClientReport(row.report.id, { status: "published" });
      toast.success("Report published", { description: `${row.client.name} can now open the report link.` });
    },
    onEnable: async (row) => {
      await whiteLabelActions.updateClientReport(row.report.id, { status: "published" });
      toast.success("Report enabled", { description: `${row.client.name} can access the report again.` });
    },
    onDisable: (row) => setDisableRow(row),
  };

  const disable = async () => {
    if (!disableRow) return;
    const row = disableRow;
    setDisableRow(null);
    await whiteLabelActions.disableClientReport(row.report.id);
    toast.success("Report disabled", { description: `${row.client.name} can no longer access this report.` });
  };

  return (
    <section aria-label="Client reports" className="space-y-3">
      <SectionHeader
        title="Client Reports"
        description="Every client report and the branded link your client opens."
        actions={
          allRows.length ? (
            <Button onClick={onCreate} size="sm">
              <Plus aria-hidden /> Create Client Report
            </Button>
          ) : undefined
        }
      />

      {allRows.length === 0 ? (
        <NoClientReportsEmpty onCreate={onCreate} />
      ) : (
        <TableCard>
          <TableToolbar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search clients or URLs"
            filtersActive={filtersActive}
            onReset={reset}
          >
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as StatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full bg-surface text-sm sm:w-44" aria-label="Report status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(REPORT_STATUS_LABEL) as ReportStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {REPORT_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableToolbar>

          {rows.length === 0 ? (
            <div className="p-4">
              <NoResultsEmpty label="client reports" onClear={reset} />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <ClientReportTable rows={visible} handlers={handlers} />
              </div>
              <ul className="divide-y divide-border md:hidden" aria-label="Client reports">
                {visible.map((row) => (
                  <li key={row.report.id}>
                    <ClientReportCard row={row} handlers={handlers} />
                  </li>
                ))}
              </ul>
              <TablePagination page={safePage} pageCount={pageCount} totalItems={rows.length} pageSize={PAGE_SIZE} itemLabel="reports" onPageChange={setPage} />
            </>
          )}
        </TableCard>
      )}

      <ShareReportModal
        row={shareRow}
        onClose={() => setShareId(null)}
        onOpenReport={(row) => {
          setShareId(null);
          onPreview(row.report.id);
        }}
      />

      <ConfirmDialog
        open={disableRow !== null}
        onOpenChange={(open) => !open && setDisableRow(null)}
        title="Disable this client report?"
        description="The client will no longer be able to access this report."
        confirmLabel="Disable Report"
        onConfirm={() => void disable()}
      />
    </section>
  );
}

export function ClientReportsSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading client reports" className="space-y-3">
      <FilterBarSkeleton fields={2} />
      <TableSkeleton rows={6} columns={6} />
    </div>
  );
}
