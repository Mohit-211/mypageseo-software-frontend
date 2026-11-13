import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  ListChecks,
  ListTodo,
  Link2,
  MapPin,
  MessageSquareHeart,
  MessageSquareX,
  Newspaper,
  ShieldAlert,
  Sparkles,
  Swords,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { preloadPath } from "@/app/route-preload";
import { IconChip } from "@/components/layout/shared/icon-chip";
import type { ModuleTone, StatusTone } from "@/components/layout/shared/module-tone";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { MAX_NEXT_STEPS, nextStepCta, type NextStep, type NextStepCta, type NextStepSource, type NextStepViewer } from "@/lib/dashboard/next-steps";
import type { WritingMode } from "@/lib/dashboard/replies";
import { cn } from "@/lib/utils";

/** Each kind of task keeps the colour and icon of the section where it's done. */
const SOURCE_LOOK: Record<NextStepSource, { icon: LucideIcon; tone: ModuleTone }> = {
  connection: { icon: Link2, tone: "gbp" },
  setup: { icon: ListTodo, tone: "locations" },
  ranking: { icon: TrendingUp, tone: "rankings" },
  gbp: { icon: Building2, tone: "gbp" },
  reviews: { icon: MessageSquareHeart, tone: "reputation" },
  citations: { icon: ListChecks, tone: "citations" },
  posts: { icon: Newspaper, tone: "posts" },
  other: { icon: ArrowRight, tone: "dashboard" },
};

function lookFor(step: NextStep, cta: NextStepCta | null): { icon: LucideIcon; tone: ModuleTone; statusTone?: StatusTone } {
  const to = cta?.kind === "link" ? cta.to : "";
  // Phase 25a: replies Google rejected aren't public, a problem like a failed post: a red mark whatever the button opens.
  if (step.source === "reviews" && step.kind === "reply_rejected") return { icon: MessageSquareX, tone: "reputation", statusTone: "critical" };
  if (to.includes("/ai/")) return { icon: Sparkles, tone: "ai" };
  // "<Competitor> ranks ahead of you" is about a competitor, wherever its button leads (Profile Comparison).
  if (step.source === "ranking" && step.kind === "competitor_ahead") return { icon: Swords, tone: "competitors" };
  if (step.source === "reviews" && to.includes("flag=suspicious")) return { icon: ShieldAlert, tone: "reputation" };
  return SOURCE_LOOK[step.source];
}

/**
 * "Next steps": the first block of the dashboard. The most useful tasks right now, most impact
 * first, each with one verb button that opens the exact page (and filter) where it's done. The
 * first button is the page's primary action; the rest stay quieter. Read-only users get links to
 * look, and reply and post buttons follow what AI can do (`writing`).
 */
export function NextStepsPanel({
  steps,
  showLocation,
  primary = true,
  writing = "ai",
}: {
  steps: NextStep[];
  showLocation: boolean;
  /** False when another block above already holds the page's primary action (the setup card). */
  primary?: boolean;
  /** What the person looking can write right now (`writingModeFor(useAiStatus(…))`). */
  writing?: WritingMode;
}) {
  const canEdit = useCanEdit();
  const viewer: NextStepViewer = { canEdit, writing };
  // The backend sends only its top few: a full list is "the top 5", not the whole workload.
  const capped = steps.length >= MAX_NEXT_STEPS;
  return (
    <section aria-labelledby="next-steps-title" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-linear-to-r from-brand-tint/70 via-card to-card px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={ListTodo} tone="dashboard" size="md" className="-mt-0.5" />
          <div className="min-w-0">
            <h2 id="next-steps-title" className="text-[15px] font-semibold leading-6 text-foreground">
              Next steps
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {steps.length === 0
                ? "When something needs you, it shows up here."
                : capped
                  ? `The ${MAX_NEXT_STEPS} that will help most right now, most important first.`
                  : "What will help most right now, most important first."}
            </p>
          </div>
        </div>
        {steps.length > 0 ? (
          <StatusBadge tone="brand" dot>
            {capped ? `Top ${MAX_NEXT_STEPS}` : `${steps.length} to do`}
          </StatusBadge>
        ) : null}
      </header>
      {steps.length === 0 ? (
        <EmptyState
          variant="all-done"
          compact
          className="rounded-none border-0"
          title="You're all caught up"
          description="Rankings, your profile, reviews and listings look fine. New tasks show up here after the next update."
        />
      ) : (
        <ol className="divide-y divide-border">
          {steps.map((step, index) => (
            <NextStepRow key={step.key} step={step} primary={primary && index === 0} showLocation={showLocation} viewer={viewer} />
          ))}
        </ol>
      )}
    </section>
  );
}

function NextStepRow({ step, primary, showLocation, viewer }: { step: NextStep; primary: boolean; showLocation: boolean; viewer: NextStepViewer }) {
  const cta = nextStepCta(step, viewer);
  const look = lookFor(step, cta);
  return (
    <li className="group flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconChip icon={look.icon} tone={look.tone} statusTone={look.statusTone} size="md" />
        <div className="min-w-0 pt-0.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
            <span className="min-w-0">{step.title}</span>
            {step.high ? (
              <StatusBadge tone="warning" size="sm">
                High impact
              </StatusBadge>
            ) : null}
          </p>
          {step.detail || (showLocation && step.locationName) ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {step.detail}
              {showLocation && step.locationName ? (
                // Its own line on phones; after the detail on wider screens.
                <span className={cn("mt-0.5 flex items-center gap-1 font-medium text-foreground sm:mt-0 sm:inline-flex", step.detail && "sm:ml-2")}>
                  <MapPin aria-hidden className="size-3.5 shrink-0 text-primary" />
                  {step.locationName}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      {/* Read-only users can't connect Google: no button, but they still see what's wrong. */}
      {cta ? (
        <div className="flex shrink-0 pl-12 sm:pl-0">
          <NextStepButton cta={cta} primary={primary} />
        </div>
      ) : null}
    </li>
  );
}

function NextStepButton({ cta, primary }: { cta: NextStepCta; primary: boolean }) {
  const { connect } = useGbpConnect();
  const variant = primary ? "default" : "outline";
  if (cta.kind === "connect") {
    return (
      <Button size="sm" variant={variant} onClick={() => connect()}>
        <Link2 aria-hidden /> {cta.label}
      </Button>
    );
  }
  const to = cta.to;
  return (
    <Button asChild size="sm" variant={variant}>
      <Link to={to} onPointerEnter={() => preloadPath(to)} onFocus={() => preloadPath(to)}>
        {cta.label} <ArrowRight aria-hidden />
      </Link>
    </Button>
  );
}

/** Placeholder rows while the dashboard loads (same frame, so nothing jumps). */
export function NextStepsSkeleton() {
  return (
    <section aria-hidden className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <Skeleton className="size-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-border px-5 py-4 last:border-b-0">
          <Skeleton className="size-9 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="hidden h-8 w-32 rounded-lg sm:block" />
        </div>
      ))}
    </section>
  );
}
