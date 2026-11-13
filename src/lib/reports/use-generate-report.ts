import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createReport, getReport, isApiError, type ReportType } from "@/api";
import { REPORT_ACTIVE_STATUSES, reportCreateErrorText } from "./report-meta";
import { REPORTS_LIST_KEY } from "./use-report-counts";

export type GenerateRequest = {
  location_id: string;
  type: ReportType;
  range?: string;
  run_id?: string;
};

export type GeneratePhase = "idle" | "starting" | "generating" | "ready" | "failed" | "error";

/**
 * Creating a PDF report and following it until it's ready, without leaving the page:
 * `start()` queues it (`POST reports`; a repeat while one is generating returns that one with
 * `existing: true`), then `GET reports/:id` is polled every 3 s. The report lists refresh when it's
 * queued and again when it's done, so the new row appears and turns "Ready" by itself.
 */
export function useGenerateReport() {
  const queryClient = useQueryClient();
  const [reportId, setReportId] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const busy = useRef(false);

  const start = useCallback(
    async (request: GenerateRequest) => {
      if (busy.current) return;
      busy.current = true;
      setStarting(true);
      setError(null);
      setReportId(null);
      try {
        const report = await createReport(request);
        setExisting(Boolean(report.existing));
        setReportId(report.report_id);
        void queryClient.invalidateQueries({ queryKey: REPORTS_LIST_KEY });
      } catch (err) {
        setError(reportCreateErrorText(err));
      } finally {
        busy.current = false;
        setStarting(false);
      }
    },
    [queryClient],
  );

  const report = useQuery({
    queryKey: ["reports", reportId],
    queryFn: async ({ signal }) => {
      const detail = await getReport(reportId!, signal);
      // Done: the lists (and the "ready" counts) show the final state without waiting for their own refresh.
      if (!REPORT_ACTIVE_STATUSES.includes(detail.report.status)) void queryClient.invalidateQueries({ queryKey: REPORTS_LIST_KEY });
      return detail;
    },
    enabled: Boolean(reportId),
    // A blip while polling is retried; a report that no longer exists is not.
    retry: (count, err) => !(isApiError(err) && err.status === 404) && count < 3,
    refetchInterval: (query) => {
      if (isApiError(query.state.error) && query.state.error.status === 404) return false;
      return !query.state.data || REPORT_ACTIVE_STATUSES.includes(query.state.data.report.status) ? 3_000 : false;
    },
  });

  const status = report.data?.report.status;
  const lost = isApiError(report.error) && report.error.status === 404;
  const phase: GeneratePhase = error
    ? "error"
    : starting
      ? "starting"
      : !reportId
        ? "idle"
        : status === "ready"
          ? "ready"
          : lost || status === "failed" || status === "expired" || status === "archived"
            ? "failed"
            : "generating";

  const reset = useCallback(() => {
    setReportId(null);
    setExisting(false);
    setError(null);
  }, []);

  return { phase, start, reset, reportId, report: report.data?.report ?? null, existing, error };
}
