import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Ban, Clock, Info, PlugZap, RotateCw, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { classifyError, failureCopy, type FailureKind } from "@/lib/mypageseo/errors";

type Tone = "critical" | "caution" | "neutral";

// Failures sit on a white card: a red edge and chip only for real errors; "caution" (not found,
// no access, slow service) stays neutral so the page doesn't look broken when it isn't.
const TONE_CLASS: Record<Tone, { box: string; chip: string }> = {
  critical: { box: "border-critical/25 bg-card", chip: "bg-critical-surface text-critical ring-critical/20" },
  caution: { box: "border-border bg-card", chip: "bg-muted text-muted-foreground ring-border-strong" },
  neutral: { box: "border-dashed border-border-strong bg-card", chip: "bg-info-surface text-info ring-info/20" },
};

const KIND_PRESENTATION: Record<
  FailureKind | "not_connected" | "partial",
  { tone: Tone; Icon: typeof AlertTriangle }
> = {
  not_found: { tone: "caution", Icon: SearchX },
  forbidden: { tone: "caution", Icon: Ban },
  timeout: { tone: "caution", Icon: Clock },
  service_unavailable: { tone: "caution", Icon: Clock },
  network: { tone: "critical", Icon: AlertTriangle },
  unknown: { tone: "critical", Icon: AlertTriangle },
  not_connected: { tone: "neutral", Icon: PlugZap },
  partial: { tone: "caution", Icon: Info },
};

/**
 * Section-level failure state. Use inside a page so the surrounding context
 * (location header, filters, other widgets) stays usable when one data source
 * fails. Never renders technical detail.
 */
export function SectionError({
  kind = "unknown",
  title,
  description,
  onRetry,
  retryLabel = "Try again",
  action,
  compact = false,
  className,
}: {
  kind?: FailureKind;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const copy = failureCopy(kind);
  const { tone, Icon } = KIND_PRESENTATION[kind];
  const showRetry = Boolean(onRetry) && copy.retryable;

  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-4 text-left shadow-card",
        TONE_CLASS[tone].box,
        compact ? "py-3" : "py-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "grid shrink-0 place-items-center rounded-lg ring-1 ring-inset",
            compact ? "size-8" : "size-9",
            TONE_CLASS[tone].chip,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className={cn("min-w-0", compact ? "pt-1" : "pt-0.5")}>
          <h3 className="text-sm font-semibold text-foreground">{title ?? copy.title}</h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {description ?? copy.description}
          </p>
          {showRetry || action ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {showRetry ? (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RotateCw aria-hidden /> {retryLabel}
                </Button>
              ) : null}
              {action}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Failure state derived from a caught error object. */
export function ErrorStateFromError({
  error,
  onRetry,
  action,
  compact,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const failure = classifyError(error);
  return (
    <SectionError
      kind={failure.kind}
      {...(onRetry ? { onRetry } : {})}
      {...(action ? { action } : {})}
      {...(compact === undefined ? {} : { compact })}
      {...(className === undefined ? {} : { className })}
    />
  );
}

/** One-line inline failure for table cells, metric tiles and small widgets. */
export function InlineError({
  message = "Couldn't load",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <AlertTriangle className="size-3.5 shrink-0 text-critical" aria-hidden />
      {message}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-sm font-semibold text-primary underline-offset-2 outline-hidden hover:text-primary-hover hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </button>
      ) : null}
    </span>
  );
}

/** Integration is reachable but not connected. Distinct from an error. */
export function NotConnectedState({
  title = "Not connected yet",
  description,
  action,
  className,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  const { Icon } = KIND_PRESENTATION.not_connected;
  return (
    <div className={cn("rounded-xl border px-4 py-5", TONE_CLASS.neutral.box, className)}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset", TONE_CLASS.neutral.chip)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Some of the data on this page is missing, but the page still works. */
export function PartialDataNotice({
  description,
  onRetry,
  className,
}: {
  description: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-info/25 bg-info-surface px-4 py-2.5",
        className,
      )}
    >
      <Info className="size-4 shrink-0 text-info" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden /> Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Full-page unexpected failure, used by route error boundaries. */
export function AppErrorState({
  error,
  onRetry,
  showBack = true,
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  showBack?: boolean;
  className?: string;
}) {
  const failure = error ? classifyError(error) : failureCopy("unknown");
  return (
    <div
      className={cn(
        "mx-auto max-w-xl rounded-xl border border-border bg-card px-6 py-10 text-center shadow-card",
        className,
      )}
    >
      <span
        aria-hidden
        className="mx-auto grid size-12 place-items-center rounded-full bg-critical-surface text-critical ring-1 ring-inset ring-critical/20"
      >
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
        {failure.kind === "unknown" ? "Something went wrong" : failure.title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {failure.kind === "unknown"
          ? "This screen stopped working unexpectedly. Your data is safe. Try again, and if it keeps happening contact support."
          : failure.description}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {onRetry && failure.retryable ? (
          <Button size="sm" onClick={onRetry}>
            <RotateCw aria-hidden /> Try again
          </Button>
        ) : null}
        {showBack ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof window !== "undefined") window.history.back();
            }}
          >
            Go back
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Return to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

type BoundaryProps = {
  children: ReactNode;
  /** Rendered instead of the default section failure state. */
  fallback?: (error: unknown, reset: () => void) => ReactNode;
  title?: string;
};

type BoundaryState = { error: unknown | null };

/**
 * Keeps one failing section from taking down the rest of a page.
 * Wrap individual widgets, not whole routes.
 */
export class SectionErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Section failed to render", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    const failure = classifyError(error);
    return (
      <SectionError
        kind={failure.kind}
        title={this.props.title ?? failure.title}
        onRetry={this.reset}
      />
    );
  }
}
