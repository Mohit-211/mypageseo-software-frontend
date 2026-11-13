import { useId, useRef, useState, type ReactNode } from "react";
import { ImagePlus, ImageUp, LoaderCircle, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HEX } from "@/lib/white-label/branding";
import { formatRatio, type ContrastLevel } from "@/lib/white-label/color";
import { cn } from "@/lib/utils";

/**
 * A colour with its hex value: a swatch that opens the system colour picker, and the hex field.
 * An empty value (with a `placeholder`) means "use the default", shown as the placeholder's swatch.
 */
export function ColorField({
  id,
  label,
  value,
  placeholder,
  onChange,
  hint,
  error,
  aside,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string | undefined;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: string | undefined;
  /** Shown next to the label, e.g. a contrast pill. */
  aside?: ReactNode;
  disabled?: boolean;
}) {
  const shown = HEX.test(value) ? value : placeholder && HEX.test(placeholder) ? placeholder : null;
  const messageId = `${id}-message`;
  return (
    <div className="min-w-0">
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {aside}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className={cn(
            "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-input shadow-xs focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            !shown && "bg-muted",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          )}
          style={shown ? { backgroundColor: shown } : undefined}
        >
          <input
            type="color"
            aria-label={`${label}: pick a colour`}
            disabled={disabled}
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            value={shown ?? "#000000"}
            onChange={(event) => onChange(event.target.value)}
          />
        </span>
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className="font-mono uppercase placeholder:normal-case"
          onChange={(event) => onChange(event.target.value.trim())}
        />
      </div>
      {error ? (
        <p id={messageId} role="alert" className="mt-1.5 text-xs font-medium text-critical">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTRAST_COPY: Record<ContrastLevel, { label: string; tone: "success" | "neutral" | "warning" }> = {
  good: { label: "Easy to read", tone: "success" },
  large: { label: "OK for large text", tone: "neutral" },
  poor: { label: "Hard to read", tone: "warning" },
};

/** How readable text is on (or in) a brand colour, with the ratio for those who want it. */
export function ContrastPill({ level, ratio, what }: { level: ContrastLevel; ratio: number; what: string }) {
  const copy = CONTRAST_COPY[level];
  return (
    <span title={`${what}: contrast ${formatRatio(ratio)} (4.5:1 or more reads well at any size)`}>
      <StatusBadge tone={copy.tone} size="sm" dot>
        {copy.label}
        <span className="sr-only">
          {" "}
          ({what}, contrast {formatRatio(ratio)})
        </span>
      </StatusBadge>
    </span>
  );
}

/**
 * A logo picker: drop a file on it or click to choose. Saving is the caller's job (it happens
 * right away, unlike the other fields). Read-only when `onFile` is missing.
 */
export function LogoField({
  label,
  url,
  busy,
  hasLogo,
  onFile,
  onRemove,
  emptyLabel = "No logo yet",
  hint = "PNG or JPEG, up to 512 KB. Saved as soon as you upload it.",
  disabled,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  hasLogo: boolean;
  onFile?: ((file: File) => void) | undefined;
  onRemove?: (() => void) | undefined;
  emptyLabel?: string;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const editable = Boolean(onFile) && !disabled;

  const take = (file: File | undefined) => {
    if (file && onFile && editable) onFile(file);
  };

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!editable || busy}
          aria-describedby={hintId}
          aria-label={hasLogo ? `Replace the ${label.toLowerCase()}` : `Upload a ${label.toLowerCase()}`}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            if (!editable) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            take(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "relative grid h-16 w-40 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-card p-2 transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            editable && "cursor-pointer hover:border-primary/60 hover:bg-brand-tint/40",
            dragging && "border-primary bg-brand-tint",
            !editable && "cursor-default",
          )}
        >
          {busy ? (
            <LoaderCircle aria-hidden className="size-5 animate-spin text-primary" />
          ) : url ? (
            <img src={url} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground">
              <ImagePlus aria-hidden className="size-5" />
              {editable ? "Drop or choose" : emptyLabel}
            </span>
          )}
        </button>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                take(file);
              }}
            />
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              <ImageUp aria-hidden /> {hasLogo ? "Replace" : "Upload"}
            </Button>
            {hasLogo && onRemove ? (
              <Button type="button" size="sm" variant="ghost" className="text-critical hover:text-critical" disabled={busy} onClick={onRemove}>
                <Trash2 aria-hidden /> Remove
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <p id={hintId} className="mt-1.5 text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
