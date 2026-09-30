import { useId, useRef, useState, type DragEvent } from "react";
import { ImageUp, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { FieldMessage } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { formatBytes, validateImage, type ImageRules } from "@/lib/white-label/white-label";
import { cn } from "@/lib/utils";

export type UploadedImage = { url: string; fileName: string };

/**
 * Drag-and-drop image upload with preview, replace and remove.
 * `upload` stands in for the storage API; it resolves with the hosted URL.
 */
export function ImageUploader({
  label,
  prompt,
  rules,
  value,
  fileName,
  upload,
  onChange,
  disabled,
  previewClassName,
  hint,
}: {
  label: string;
  /** Headline inside the empty drop zone, e.g. "Upload your agency logo". */
  prompt: string;
  rules: ImageRules;
  value: string | null;
  fileName: string | null;
  upload: (file: File) => Promise<string>;
  onChange: (image: UploadedImage | null) => void;
  disabled?: boolean;
  previewClassName?: string;
  hint?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = uploading || Boolean(disabled);

  const accept = async (file: File | undefined) => {
    if (!file || busy) return;
    const problem = validateImage(file, rules);
    setError(problem);
    if (problem) return;
    setUploading(true);
    try {
      const url = await upload(file);
      onChange({ url, fileName: file.name });
    } catch {
      setError("The upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const browse = () => inputRef.current?.click();

  const dropHandlers = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      if (!busy) setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      void accept(e.dataTransfer.files[0]);
    },
  };

  const requirements = `${rules.extensions} · Max ${formatBytes(rules.maxBytes)}`;

  return (
    <div>
      <p id={`${inputId}-label`} className="text-[13px] font-medium text-foreground">
        {label}
      </p>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={rules.types.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-labelledby={`${inputId}-label`}
        onChange={(e) => {
          void accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {value ? (
        <div
          {...dropHandlers}
          className={cn(
            "mt-1.5 flex flex-col gap-3 rounded-lg border border-border bg-background p-3 transition-colors sm:flex-row sm:items-center",
            dragging && "border-primary bg-brand-tint",
          )}
        >
          <div className="flex h-16 w-full shrink-0 items-center justify-center rounded-md border border-border bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#ffffff_0%_50%)] bg-size-[16px_16px] p-2 sm:w-40">
            {uploading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <img src={value} alt={`Current ${label.toLowerCase()}`} className={cn("max-h-full max-w-full object-contain", previewClassName)} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{uploading ? "Uploading…" : (fileName ?? "Uploaded image")}</p>
            <p className="text-xs text-muted-foreground">{requirements}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={browse} disabled={busy} className="flex-1 sm:flex-none">
              <RefreshCw aria-hidden /> Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
              disabled={busy}
              className="flex-1 text-critical hover:text-critical sm:flex-none"
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          {...dropHandlers}
          onClick={browse}
          disabled={busy}
          aria-describedby={`${inputId}-message`}
          className={cn(
            "mt-1.5 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60",
            dragging && "border-primary bg-brand-tint",
          )}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-tint text-primary">
              <ImageUp className="size-5" aria-hidden />
            </span>
          )}
          <span className="mt-2 text-sm font-medium text-foreground">{uploading ? "Uploading…" : prompt}</span>
          <span className="mt-0.5 text-xs text-muted-foreground">
            Drag & drop, or <span className="font-medium text-primary">browse files</span>
          </span>
          <span className="mt-1 text-xs text-muted-foreground">{requirements}</span>
        </button>
      )}
      <FieldMessage id={`${inputId}-message`} error={error} hint={hint} />
    </div>
  );
}
