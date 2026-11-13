import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { downloadReportPdf, isApiError } from "@/api";
import { saveBlob } from "@/lib/utils";

function downloadErrorText(error: unknown): string {
  const reason = isApiError(error) ? error.reason : undefined;
  if (reason === "expired") return "This report has expired; its PDF is no longer kept.";
  if (reason === "not_ready") return "The PDF isn't ready yet.";
  if (reason === "file_missing") return "The PDF file is missing. Create the report again.";
  return "The PDF couldn't be downloaded. Try again.";
}

/**
 * Downloads a report's PDF (it needs the session, so it's fetched and saved rather than linked).
 * A second click while one download runs is ignored.
 */
export function useReportPdfDownload() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const running = useRef(false);

  const download = useCallback(async (reportId: string) => {
    if (running.current) return;
    running.current = true;
    setDownloading(reportId);
    try {
      const { blob, filename } = await downloadReportPdf(reportId);
      saveBlob(blob, filename);
    } catch (error) {
      toast.error(downloadErrorText(error));
    } finally {
      running.current = false;
      setDownloading(null);
    }
  }, []);

  return { download, downloading };
}
