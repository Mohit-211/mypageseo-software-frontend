import { useState, type DragEvent } from "react";
import { CircleCheck, CircleX, ImagePlus, Loader2, Upload } from "lucide-react";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { UploadReport } from "@/lib/photo-library/use-upload";
import { cn } from "@/lib/utils";

/** What makes a good library photo, and what the screening keeps out of automatic posts. */
const GOOD = ["Your work, before and after", "Your team at work", "Your place, inside and out", "Your products"];
const AVOID = ["Screenshots and collages", "Stock photos", "Text, logos or contact details on the photo"];

/**
 * Where photos join the library: drop them here or pick them (JPEG or PNG, up to 5 MB each, several at once), with
 * what makes a good library photo. While files upload it shows how far it has got.
 */
export function UploadZone({
  onPick,
  onFiles,
  progress,
}: {
  /** Opens the page's file picker. */
  onPick: () => void;
  onFiles: (files: File[]) => void;
  progress: { done: number; total: number } | null;
}) {
  const [over, setOver] = useState(false);
  const uploading = progress !== null;

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    if (uploading || !Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setOver(true);
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setOver(false);
    if (uploading) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) onFiles(files);
  };

  return (
    <section
      aria-label="Add photos to your library"
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "grid gap-4 rounded-xl border border-dashed bg-card p-4 transition-colors sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center",
        over ? "border-ai bg-ai-surface" : "border-border-strong",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-ai-surface text-ai ring-1 ring-inset ring-ai/20">
          <ImagePlus className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {over ? (
              "Drop your photos to add them"
            ) : (
              <>
                {/* Nothing is dragged on a touch screen. */}
                <span className="pointer-coarse:hidden">Drop photos here, or pick them</span>
                <span className="hidden pointer-coarse:inline">Add photos of your business</span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">JPEG or PNG, up to 5 MB each. Pick several at once.</p>
          {uploading ? (
            <div role="status" className="mt-3 max-w-sm space-y-1.5">
              <p className="flex items-center gap-2 text-sm text-foreground">
                <Loader2 aria-hidden className="size-4 animate-spin text-ai" />
                Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
              </p>
              <Progress value={progress.total ? Math.round((progress.done / progress.total) * 100) : 0} aria-label="Upload progress" className="h-1.5 bg-ai/15 [&>div]:bg-ai" />
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onPick}>
              <Upload aria-hidden /> Choose photos
            </Button>
          )}
        </div>
      </div>
      <div className="grid min-w-0 gap-3 text-xs sm:grid-cols-2">
        <TipList title="Good photos" items={GOOD} good />
        <TipList title="Kept out of automatic posts" items={AVOID} good={false} />
      </div>
    </section>
  );
}

function TipList({ title, items, good }: { title: string; items: readonly string[]; good: boolean }) {
  const Icon = good ? CircleCheck : CircleX;
  return (
    <div className="min-w-0">
      <p className="font-semibold text-foreground">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5 text-muted-foreground">
            <Icon aria-hidden className={cn("mt-px size-3.5 shrink-0", good ? "text-success" : "text-muted-foreground")} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What happened to the files of the last upload that didn't all make it in ("x.jpg is in your library already."). */
export function UploadReportNotice({ report, onDismiss }: { report: UploadReport; onDismiss: () => void }) {
  if (report.problems.length === 0) return null;
  const notAdded = report.problems.length;
  const title =
    report.added > 0
      ? `${report.added} ${report.added === 1 ? "photo" : "photos"} added, ${notAdded} not added`
      : notAdded === 1
        ? "This photo wasn't added"
        : `These ${notAdded} photos weren't added`;
  return (
    <FormAlert tone={report.added > 0 ? "warning" : "critical"} title={title}>
      <ul className="mt-1 space-y-0.5">
        {report.problems.slice(0, 12).map((problem, index) => (
          <li key={`${index}-${problem.name}`} className="break-words">
            <span className="font-medium text-foreground">{problem.name}</span> {problem.text}
          </li>
        ))}
        {notAdded > 12 ? <li>And {notAdded - 12} more.</li> : null}
      </ul>
      <Button
        type="button"
        variant="link"
        size="sm"
        // Small print with an invisible hit area about 40px tall.
        className="relative mt-1 h-auto p-0 text-xs after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-['']"
        onClick={onDismiss}
      >
        Dismiss
      </Button>
    </FormAlert>
  );
}
