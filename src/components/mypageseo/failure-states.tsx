import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Ban, Clock, Info, PlugZap, RotateCw, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { classifyError, failureCopy, type FailureKind } from "@/lib/mypageseo/errors";

type Tone = "critical" | "caution" | "neutral";

const TONE_CLASS: Record<Tone, { box: string; icon: string }> = {
  critical: { box: "border-border bg-critical-surface/40", icon: "text-critical" },
  caution: { box: "border-border bg-surface-strong", icon: "text-foreground/70" },
  neutral: { box: "border-dashed border-primary/25 bg-brand-tint", icon: "text-primary" },
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
  retryLabel = "Retry",
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
        "rounded-lg border px-4 text-left",
        TONE_CLASS[tone].box,
        compact ? "py-3" : "py-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_CLASS[tone].icon)} aria-hidden />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title ?? copy.title}</h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {description ?? copy.description}
          </p>
          {showRetry || action ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {showRetry ? (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RotateCw className="size-3.5" /> {retryLabel}
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
      <AlertTriangle className="size-3.5 text-critical" aria-hidden />
      {message}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Retry
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
    <div className={cn("rounded-lg border border-dashed border-primary/25 bg-brand-tint px-4 py-6", className)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div>
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
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-surface-strong px-4 py-2.5",
        className,
      )}
    >
      <Info className="size-4 shrink-0 text-foreground/70" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Retry
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
        "mx-auto max-w-xl rounded-lg border border-border bg-surface px-6 py-10 text-center shadow-card",
        className,
      )}
    >
      <AlertTriangle className="mx-auto size-5 text-critical" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-foreground">
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
            <RotateCw className="size-3.5" /> Try again
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
