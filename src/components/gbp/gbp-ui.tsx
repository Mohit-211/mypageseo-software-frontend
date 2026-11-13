import { useState, type ComponentProps, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Gauge,
  LoaderCircle,
  MinusCircle,
  PlugZap,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { apiErrorData, isApiError, refreshLocation, type CheckState, type GbpUnavailable } from "@/api";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { IconChip } from "@/components/layout/shared/icon-chip";
import type { ModuleTone } from "@/components/layout/shared/module-tone";
import { BackgroundActivity } from "@/components/location/background-activity";
import { FirstRunProgress } from "@/components/ranking/first-run-progress";
import { ConnectGbpButton } from "@/components/gbp-audit/connect-gbp-button";
import { Button } from "@/components/ui/button";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { noteAccountError } from "@/lib/billing/account-restriction";
import { useWriteBlock } from "@/lib/billing/write-block";
import { formatDateTime, formatRelative } from "@/lib/datetime";
import { STATE_LABEL, STATE_TONE, unavailableCopy, type FixAction } from "@/lib/gbp/gbp-labels";
import { gbpReportKey, isNoReportYet } from "@/lib/gbp/use-gbp-report";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { locationPath } from "@/lib/mypageseo/section-links";
import { formatRunDate } from "@/lib/rankings/format";
import { rankingsKey, useRefreshState } from "@/lib/rankings/use-rankings";
import { cn } from "@/lib/utils";

const STATE_ICON: Record<CheckState, LucideIcon> = {
  pass: CheckCircle2,
  partial: AlertCircle,
  fail: XCircle,
  not_available: MinusCircle,
};

/** A check's state as a badge with an icon, so it never relies on colour alone. */
export function StateBadge({ state, size = "md" }: { state: CheckState; size?: "sm" | "md" }) {
  return (
    <StatusBadge tone={STATE_TONE[state]} icon={STATE_ICON[state]} size={size}>
      {STATE_LABEL[state]}
    </StatusBadge>
  );
}

/** A section the report can't show, with copy by `reason`. */
export function SectionUnavailable({ section, compact = false }: { section: GbpUnavailable; compact?: boolean }) {
  const copy = unavailableCopy(section.reason);
  if (compact) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface-strong px-3.5 py-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground ring-1 ring-inset ring-border-strong">
          {section.reason === "v4_access_pending" || section.reason === "not_synced_yet" ? <Clock className="size-4" /> : <AlertCircle className="size-4" />}
        </span>
        <p className="min-w-0 pt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{copy.title}.</span> {copy.description}
        </p>
      </div>
    );
  }
  return <EmptyState icon={AlertCircle} tone="settings" title={copy.title} description={copy.description} compact className="min-h-40" />;
}

/** Manual GBP refresh: a sync now (tokens, once per 24 h); the report regenerates ~2 min after it. */
function RefreshGbpButtonEditor({ locationId, gbpConnected }: { locationId: string; gbpConnected: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const state = useRefreshState(locationId);
  const now = useNow();
  // A read-only or suspended account can't start one (the backend answers 402 / 403).
  const block = useWriteBlock();
  const canPay = useAccess().can("billing.manage");
  const [starting, setStarting] = useState(false);
  const gbp = state.data?.gbp ?? null;
  const active = gbp?.active_sync ?? null;
  const nextAllowed = gbp?.next_allowed_at ?? null;
  const waiting = nextAllowed !== null && new Date(nextAllowed).getTime() > now;
  const cost = state.data?.tokens.cost.gbp;

  if (!gbpConnected) return null;

  const run = async () => {
    // A second click while the request is out would start (and charge) nothing new, but it looks broken.
    if (starting) return;
    setStarting(true);
    try {
      const result = await refreshLocation(locationId, ["gbp"]);
      const gbpResult = result.gbp;
      if (gbpResult && "skipped" in gbpResult) {
        toast.message(`Google data can be refreshed again ${formatRunDate(gbpResult.next_allowed_at, true)}.`);
      } else {
        toast.success(gbpResult?.existing ? "A Google sync is already running." : "Fetching the latest Google data. The report updates a couple of minutes after it finishes.");
      }
    } catch (err) {
      // Not a useMutation, so tell the shell's account banner about a read-only or suspended refusal here.
      noteAccountError(err);
      if (isApiError(err) && err.reason === "insufficient_tokens") {
        const data = apiErrorData(err);
        const shortfall = `Not enough tokens: this refresh costs ${String(data.cost ?? cost ?? "?")}, your balance is ${String(data.balance ?? "?")}.`;
        // Only someone who can pay is offered "Buy tokens"; anyone else is told to ask the owner.
        if (canPay) toast.error(shortfall, { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } });
        else toast.error(shortfall, { description: "Ask the account owner to add tokens." });
      } else if (isApiError(err) && err.reason === "read_only") {
        toast.error("Your access is read-only, so you can't start a refresh.");
      } else if (isApiError(err) && err.reason === "organization_suspended") {
        toast.error("This account is suspended", { description: "Contact support to restore it." });
      } else if (isApiError(err) && err.reason === "subscription_required") {
        // Only the owner can subscribe; anyone else is told to ask the owner (as the shell's account banner does).
        toast.warning(
          "Your account is read-only",
          canPay
            ? { description: "Refreshes are paused until you subscribe.", action: { label: "Go to billing", onClick: () => navigate("/settings/billing") } }
            : { description: "Refreshes are paused. Ask the account owner to subscribe." },
        );
      } else if (isApiError(err) && err.status === 429) {
        const next = (apiErrorData(err).gbp as { next_allowed_at?: string } | undefined)?.next_allowed_at;
        toast.error(`Google data was refreshed recently. Try again ${next ? formatRunDate(next, true) : "in 24 hours"}.`);
      } else {
        // Plain words, not the raw API message: the account cases above have their own copy.
        toast.error("The refresh couldn't be started", { description: "Try again in a moment." });
      }
    } finally {
      setStarting(false);
      void queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: gbpReportKey(locationId) });
      // The whole billing prefix: the header pill, and the summary behind AI Studio and the AI cost chips.
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    }
  };

  const busy = starting || Boolean(active);
  return (
    <Button
      variant="outline"
      disabled={!state.data || busy || waiting || block.blocked}
      aria-busy={busy || undefined}
      title={block.reason ?? (waiting ? "Google data can be refreshed once a day." : undefined)}
      onClick={() => void run()}
    >
      {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
      {active ? "Syncing Google data…" : starting ? "Starting…" : waiting ? `Next refresh ${formatRunDate(nextAllowed, true)}` : "Refresh profile data"}
      {!busy && !waiting && cost != null ? (
        <span className="rounded-full bg-muted px-1.5 py-px text-xs font-medium tabular-nums text-muted-foreground">
          {cost} token{cost === 1 ? "" : "s"}
        </span>
      ) : null}
    </Button>
  );
}

/** Hidden for a read-only client_user. */
export function RefreshGbpButton(props: ComponentProps<typeof RefreshGbpButtonEditor>) {
  return useCanEdit() ? <RefreshGbpButtonEditor {...props} /> : null;
}

/** "Updated 2 hours ago" (the exact time on hover) plus a chip while a new version is being made. */
function Freshness({ generatedAt, pending }: { generatedAt?: string | null | undefined; pending?: boolean | undefined }) {
  const now = useNow();
  if (!generatedAt && !pending) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {generatedAt ? (
        <span
          title={`Report made ${formatDateTime(generatedAt)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
        >
          <Clock aria-hidden className="size-3.5" />
          Updated {formatRelative(generatedAt, now)}
        </span>
      ) : null}
      {pending ? (
        <StatusBadge tone="info" icon={LoaderCircle} className="[&_svg]:animate-spin motion-reduce:[&_svg]:animate-none">
          A new version is being prepared
        </StatusBadge>
      ) : null}
    </div>
  );
}

/** The page header shared by the GBP pages: title, freshness, the refresh button and the page's own actions. */
export function GbpPageHeader({
  locationId,
  title,
  description,
  generatedAt,
  pending,
  gbpConnected,
  actions,
  icon = Building2,
  tone = "gbp",
  children,
}: {
  locationId: string;
  /** @deprecated The GBP tab bar is gone (the sidebar navigates between GBP pages); ignored. */
  view?: string;
  title: string;
  description: string;
  generatedAt?: string | null | undefined;
  pending?: boolean | undefined;
  gbpConnected: boolean;
  /**
   * The page's own actions, primary last (right-most). On phones they come before the refresh
   * button; with several, wrap the primary in `max-sm:order-first` so it leads (Profile Comparison).
   */
  actions?: ReactNode;
  icon?: LucideIcon;
  tone?: ModuleTone;
  /** Toolbar row under the header (e.g. the period switch). */
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader
        icon={icon}
        tone={tone}
        title={title}
        description={description}
        meta={generatedAt || pending ? <Freshness generatedAt={generatedAt} pending={pending} /> : undefined}
        actions={
          <>
            <RefreshGbpButton locationId={locationId} gbpConnected={gbpConnected} />
            {/* On phones the actions stack under the title: the page's own (its filled one) come
                before the outline refresh, as on Rankings. Hidden when its buttons render nothing
                (a read-only client user), so it adds no gap. */}
            {actions ? <span className="inline-flex flex-wrap items-center gap-2 empty:hidden max-sm:order-first">{actions}</span> : null}
          </>
        }
      >
        {children}
      </PageHeader>
      <BackgroundActivity locationId={locationId} />
    </>
  );
}

const CONNECT_BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Eye, title: "Views and customer actions", text: "Profile views, calls, website clicks and direction requests, day by day." },
  { icon: Search, title: "What people search", text: "The searches that lead people to your profile, ready to track as keywords." },
  { icon: Gauge, title: "Profile score and fixes", text: "A 0–100 audit of your profile, with the fixes worth the most points." },
];

/**
 * The location has no Google Business Profile connected: one clear card that says what connecting
 * unlocks, with the Connect button and the Profile Comparison (public data works without it).
 */
export function GbpNotConnected({
  locationId,
  title = "Connect your Google Business Profile",
  description = "See how people find you on Google and what to improve next. Connecting takes about a minute, and you choose which profiles to add.",
  showComparison = true,
}: {
  locationId: string;
  title?: string;
  description?: string;
  showComparison?: boolean;
}) {
  const canEdit = useCanEdit();
  return (
    <section aria-labelledby="gbp-connect-title" className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <IconChip icon={Building2} tone="gbp" size="lg" />
            <StatusBadge tone="info" icon={PlugZap}>
              Not connected
            </StatusBadge>
          </div>
          <h2 id="gbp-connect-title" className="mt-5 text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
          {canEdit ? null : <p className="mt-2 text-sm text-muted-foreground">Ask the account owner or your agency to connect it.</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            <ConnectGbpButton size="default" label="Connect Google" />
            {showComparison ? (
              <Button asChild variant="outline">
                <Link to={locationPath(locationId, "gbp/comparison")}>
                  <Scale aria-hidden /> See Profile Comparison
                </Link>
              </Button>
            ) : null}
          </div>
          {showComparison ? <p className="mt-3 text-xs text-muted-foreground">Profile Comparison uses public Google data, so it works without connecting.</p> : null}
        </div>
        <ul className="grid content-center gap-3 rounded-xl bg-surface-strong p-4 ring-1 ring-inset ring-border">
          {CONNECT_BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex items-start gap-3 rounded-lg bg-card p-3 ring-1 ring-inset ring-border">
              <IconChip icon={benefit.icon} tone="gbp" size="sm" className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{benefit.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{benefit.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Loading / no report yet / error states shared by the GBP pages. */
export function GbpReportError({
  error,
  onRetry,
  gbpConnected,
  locationId,
}: {
  error: unknown;
  onRetry: () => void;
  gbpConnected: boolean;
  locationId?: string;
}) {
  const { connect } = useGbpConnect();
  const canEdit = useCanEdit();
  if (isNoReportYet(error)) {
    const empty = (
      <EmptyState
        icon={Building2}
        tone="gbp"
        title="Your GBP report is on its way"
        description={
          gbpConnected
            ? "It's made after the first Google sync or ranking check, usually within minutes of setup. Use Refresh profile data to sync now."
            : "Connect this location's Google Business Profile to get its report. The public Profile Comparison appears after the first ranking check."
        }
        action={!gbpConnected && canEdit ? <Button onClick={() => connect()}>Connect Google</Button> : undefined}
      />
    );
    // While the first ranking check (or the report build) is going, show the wait instead (the
    // public comparison is built then too, also without GBP).
    return locationId ? <FirstRunProgress locationId={locationId} for="gbp-report" fallback={empty} /> : empty;
  }
  if (isApiError(error) && error.status === 404) {
    return (
      <EmptyState
        variant="no-results"
        title="Location not found"
        description="It may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link to="/locations">
              <ArrowLeft aria-hidden /> Back to locations
            </Link>
          </Button>
        }
      />
    );
  }
  return <ErrorState title="The GBP report couldn't be loaded" description="Check your connection and try again." onRetry={onRetry} />;
}

/** Copies text and confirms it; a refused clipboard gets a plain explanation. */
function copyText(text: string, done: string) {
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success(done))
    .catch(() => toast.error("Your browser didn't allow copying. Copy the link from GBP Overview instead."));
}

/**
 * The "Fix" call to action for an audit check or a comparison insight: a page in the app, Google's
 * own editor (new tab), or copying the review link. Hidden for read-only users.
 */
export function FixButton({ fix, className, size = "sm" }: { fix: FixAction; className?: string; size?: "sm" | "default" }) {
  const canEdit = useCanEdit();
  if (!canEdit) return null;
  const classes = cn("shrink-0", className);
  if (fix.kind === "link") {
    return (
      <Button asChild size={size} variant="outline" className={classes}>
        <Link to={fix.to}>
          {fix.ai ? <Sparkles aria-hidden className="text-ai" /> : null}
          {fix.label}
          {fix.ai ? null : <ArrowRight aria-hidden />}
        </Link>
      </Button>
    );
  }
  if (fix.kind === "external") {
    return (
      <Button asChild size={size} variant="outline" className={classes}>
        <a href={fix.href} target="_blank" rel="noreferrer">
          {fix.label}
          <ExternalLink aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </Button>
    );
  }
  return (
    <Button size={size} variant="outline" className={classes} onClick={() => copyText(fix.text, fix.copied)}>
      <Copy aria-hidden /> {fix.label}
    </Button>
  );
}
