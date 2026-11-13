import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, FileBarChart, Link2, Palette, type LucideIcon } from "lucide-react";
import type { Branding } from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { hexOr, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from "@/lib/white-label/color";
import { cn } from "@/lib/utils";

export type SetupCounts = {
  brand: { loading: boolean; branding: Branding | undefined; logoUrl: string | null };
  links: { loading: boolean; live: number; locations: number; visits: number };
  reports: { loading: boolean; ready: number | undefined; emails: number | undefined };
};

type StepState = "done" | "todo" | "waiting" | "optional" | "unavailable";

const STATE_BADGE: Record<StepState, { label: string; tone: "success" | "warning" | "neutral" }> = {
  done: { label: "Done", tone: "success" },
  todo: { label: "To do", tone: "warning" },
  waiting: { label: "Not set up", tone: "neutral" },
  optional: { label: "Optional", tone: "neutral" },
  unavailable: { label: "Not in your plan", tone: "warning" },
};

/**
 * The three steps of White Label at the top of the page (brand, client links, PDF reports), each
 * with its real status and a click to its section. Once each has something, it folds into one
 * compact row of the key numbers.
 */
export function SetupProgress({
  counts,
  canEditBrand,
  canEdit,
  featureMissing,
  onBrand,
  onLinks,
  onReports,
}: {
  counts: SetupCounts;
  canEditBrand: boolean;
  canEdit: boolean;
  featureMissing: boolean;
  onBrand: () => void;
  onLinks: () => void;
  onReports: () => void;
}) {
  const { brand, links, reports } = counts;
  const brandDone = Boolean(brand.branding?.updated_at);
  const linksDone = links.live > 0;
  const reportsDone = (reports.ready ?? 0) > 0 || (reports.emails ?? 0) > 0;
  const loading = brand.loading || links.loading || reports.loading;

  const brandState: StepState = featureMissing ? "unavailable" : brandDone ? "done" : canEditBrand ? "todo" : "waiting";
  const linksState: StepState = featureMissing ? "unavailable" : linksDone ? "done" : canEdit ? "todo" : "waiting";
  const reportsState: StepState = reportsDone ? "done" : "optional";

  const name = brand.branding?.name ?? "Your brand";
  const primary = hexOr(brand.branding?.primary_color, DEFAULT_PRIMARY);
  const secondary = hexOr(brand.branding?.secondary_color, DEFAULT_SECONDARY);
  const reportLine = `${(reports.ready ?? 0).toLocaleString()} PDF report${reports.ready === 1 ? "" : "s"} · ${(reports.emails ?? 0).toLocaleString()} monthly email${reports.emails === 1 ? "" : "s"}`;

  if (!loading && !featureMissing && brandDone && linksDone && reportsDone) {
    return (
      <section aria-label="White Label at a glance" className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-[auto_repeat(3,minmax(0,1fr))] lg:divide-x">
          <div className="flex items-center gap-3 border-border px-4 py-3.5 sm:col-span-2 sm:border-b lg:col-span-1 lg:border-b-0">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-success-surface text-success ring-1 ring-inset ring-success/25">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">All set up</p>
              <p className="text-xs text-muted-foreground">Brand, client links and reports</p>
            </div>
          </div>
          <CompactStat onClick={onBrand} label="Your brand" action={canEditBrand ? "Edit brand" : "View brand"}>
            <span className="flex min-w-0 items-center gap-2">
              {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="h-6 max-w-16 shrink-0 object-contain" /> : null}
              <span className="truncate">{name}</span>
              <Swatches primary={primary} secondary={secondary} />
            </span>
          </CompactStat>
          <CompactStat onClick={onLinks} label="Client links" action="Manage links">
            <span className="tabular-nums">
              {links.live} of {links.locations} live
            </span>
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">· {links.visits.toLocaleString()} visits</span>
          </CompactStat>
          <CompactStat onClick={onReports} label="PDF reports" action="Open reports">
            <span className="tabular-nums">{(reports.ready ?? 0).toLocaleString()} ready</span>
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              · {(reports.emails ?? 0).toLocaleString()} monthly email{reports.emails === 1 ? "" : "s"}
            </span>
          </CompactStat>
        </div>
      </section>
    );
  }

  const done = [brandDone && !featureMissing, linksDone, reportsDone].filter(Boolean).length;

  return (
    <section aria-label="Set up White Label" className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">From your brand to a live link, in three steps</p>
          <p className="text-xs text-muted-foreground">Set your brand once; every client link, PDF and email uses it.</p>
        </div>
        {loading ? (
          <Skeleton className="h-5 w-32" />
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{done} of 3 done</span>
            <span aria-hidden className="flex gap-1">
              {[0, 1, 2].map((index) => (
                <span key={index} className={cn("h-1.5 w-7 rounded-full", index < done ? "bg-success" : "bg-muted")} />
              ))}
            </span>
          </div>
        )}
      </div>
      <ol className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        <StepTile
          step={1}
          icon={Palette}
          title="Brand"
          state={brandState}
          loading={brand.loading}
          onClick={onBrand}
          action={brandState === "todo" ? "Set up brand" : canEditBrand && !featureMissing ? "Edit brand" : "View brand"}
        >
          {brandDone ? (
            <span className="flex min-w-0 items-center gap-2">
              {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="h-6 max-w-16 shrink-0 object-contain" /> : null}
              <span className="truncate font-medium text-foreground">{name}</span>
              <Swatches primary={primary} secondary={secondary} />
            </span>
          ) : featureMissing ? (
            "Your plan doesn't include white-label branding."
          ) : canEditBrand ? (
            "Add your name, logo and colours."
          ) : (
            "The account owner sets this up."
          )}
        </StepTile>
        <StepTile
          step={2}
          icon={Link2}
          title="Client links"
          state={linksState}
          loading={links.loading}
          onClick={onLinks}
          action={featureMissing ? "See why" : linksDone ? "Manage links" : canEdit ? "New client link" : "View links"}
        >
          {featureMissing ? (
            "Upgrade to send each client a live, branded page."
          ) : linksDone ? (
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {links.live} of {links.locations}
              </span>{" "}
              locations live · {links.visits.toLocaleString()} visit{links.visits === 1 ? "" : "s"}
            </span>
          ) : (
            "Create a live page for a client. It updates itself every month."
          )}
        </StepTile>
        <StepTile step={3} icon={FileBarChart} title="PDF reports" state={reportsState} loading={reports.loading} onClick={onReports} action={reportsDone ? "Open reports" : "Create a report"}>
          {reportsDone ? reportLine : "Download, share or email a PDF, once or every month."}
        </StepTile>
      </ol>
    </section>
  );
}

function StepTile({
  step,
  icon: Icon,
  title,
  state,
  loading,
  action,
  onClick,
  children,
}: {
  step: number;
  icon: LucideIcon;
  title: string;
  state: StepState;
  loading: boolean;
  action: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const badge = STATE_BADGE[state];
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onClick}
        className="group flex h-full w-full cursor-pointer flex-col gap-2.5 px-4 py-4 text-left transition-colors outline-hidden hover:bg-accent/50 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
      >
        <span className="flex w-full items-center gap-2.5">
          <span
            aria-hidden
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold",
              state === "done" ? "bg-success text-success-foreground" : "bg-brand text-brand-foreground",
            )}
          >
            {state === "done" ? <CheckCircle2 className="size-4" /> : step}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-foreground">
            <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              <span className="sr-only">Step {step}: </span>
              {title}
            </span>
          </span>
          {loading ? (
            <Skeleton className="h-5 w-14 rounded-full" />
          ) : (
            <StatusBadge tone={badge.tone} size="sm">
              {badge.label}
            </StatusBadge>
          )}
        </span>
        <span className="min-h-10 text-sm text-muted-foreground">{loading ? <Skeleton className="h-4 w-4/5" /> : children}</span>
        <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-primary">
          {action}
          <ArrowRight aria-hidden className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
        </span>
      </button>
    </li>
  );
}

function CompactStat({ label, action, onClick, children }: { label: string; action: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={action}
      className="group flex min-w-0 cursor-pointer flex-col gap-0.5 px-4 py-3.5 text-left transition-colors outline-hidden hover:bg-accent/50 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
    >
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        {label}
        <ArrowRight aria-hidden className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </span>
      <span className="flex min-w-0 items-baseline text-base font-semibold text-foreground">{children}</span>
    </button>
  );
}

function Swatches({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <span aria-hidden className="flex shrink-0 -space-x-1">
      <span className="size-4 rounded-full ring-2 ring-card" style={{ backgroundColor: primary }} />
      <span className="size-4 rounded-full ring-2 ring-card" style={{ backgroundColor: secondary }} />
    </span>
  );
}
