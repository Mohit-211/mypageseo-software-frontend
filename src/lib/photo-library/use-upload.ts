/**
 * Uploading photos into the library, one after the other (each is checked before it is sent: JPEG or PNG, at most
 * 5 MB). A full library stops the rest. The report lists what was added and, per file, what went wrong ("x.jpg is
 * in your library already."). The photo lists and the readiness checklist are read again once, at the end.
 */
import { useState } from "react";
import { toast } from "sonner";
import { photoFileProblem, uploadErrorText } from "./library";
import { useLibraryMutations } from "./use-library";

export type UploadProblem = { name: string; text: string };
export type UploadReport = { added: number; problems: UploadProblem[] };

export function useUploadPhotos(locationId: string) {
  const { upload, refresh } = useLibraryMutations(locationId);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<UploadReport | null>(null);

  const start = async (files: readonly File[]) => {
    if (progress || files.length === 0) return;
    const problems: UploadProblem[] = [];
    const valid = files.filter((file) => {
      const problem = photoFileProblem(file);
      if (problem) problems.push({ name: file.name, text: problem });
      return !problem;
    });
    setReport(null);
    setProgress({ done: 0, total: valid.length });
    let added = 0;
    for (let index = 0; index < valid.length; index += 1) {
      const file = valid[index];
      if (!file) continue;
      try {
        await upload.mutateAsync(file);
        added += 1;
      } catch (err) {
        const { text, stop } = uploadErrorText(err);
        problems.push({ name: file.name, text });
        if (stop) {
          for (const rest of valid.slice(index + 1)) problems.push({ name: rest.name, text: "wasn't uploaded." });
          break;
        }
      }
      setProgress({ done: index + 1, total: valid.length });
    }
    setProgress(null);
    if (added > 0) {
      refresh();
      toast.success(`${added} ${added === 1 ? "photo" : "photos"} added to your library.`, {
        description: "Each one is described and checked in the next few minutes.",
      });
    }
    setReport({ added, problems });
  };

  return {
    start,
    uploading: progress !== null,
    progress,
    report,
    dismissReport: () => setReport(null),
  };
}
