import { format } from "date-fns";
import type { AgencyClient, ClientReport } from "@/lib/white-label/white-label";

export type ReportRow = { report: ClientReport; client: AgencyClient; url: string };

export type ReportRowHandlers = {
  onView: (row: ReportRow) => void;
  onCopy: (row: ReportRow) => void;
  onShare: (row: ReportRow) => void;
  onPublish: (row: ReportRow) => void;
  onEnable: (row: ReportRow) => void;
  onDisable: (row: ReportRow) => void;
};

export const lastUpdated = (row: ReportRow) => format(new Date(row.report.updatedAt), "MMM d, yyyy");
