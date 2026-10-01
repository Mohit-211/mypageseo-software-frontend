import { useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, ChevronRight, Lightbulb, Star } from "lucide-react";
import type { GbpCheck, GbpPillarId, GbpReport, GbpScore, ScoreHistoryEntry } from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { GbpPageHeader, GbpReportError, SectionUnavailable, StateBadge } from "@/components/gbp/gbp-ui";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/report/rank-report-button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PILLAR_DESCRIPTION, PILLAR_LABEL, STATE_LABEL } from "@/lib/gbp/gbp-labels";
import { useGbpContext } from "@/lib/gbp/gbp-context";
import { useGbpReport } from "@/lib/gbp/use-gbp-report";
import { formatRunDate } from "@/lib/rankings/format";
import { cn } from "@/lib/utils";

const PILLAR_ORDER: GbpPillarId[] = ["completeness", "activity", "reviews", "performance"];
const GRADE_CLASS: Record<string, string> = {
  A: "text-success",
  B: "text-success",
  C: "text-warning-foreground",
  D: "text-critical",
  F: "text-critical",
};

/** GBP Audit: the GBP Score, what it's made of, what to fix, and how it changes over time. */
function LocationGbpAuditPage() {
  const { location } = useGbpContext();
  // The audit doesn't depend on the performance window; 28 days is the score's own window.
  const report = useGbpReport(location.location_id, "28d");

  return (
    <>
      <GbpPageHeader
        locationId={location.location_id}
        view="audit"
        title="GBP Audit"
        description="How complete, active and well-reviewed the Google Business Profile is, and what to improve first."
        generatedAt={report.data?.generated_at}
        pending={report.data?.generation?.pending}
        gbpConnected={location.gbp_connected}
        actions={
          location.gbp_connected ? (
            <ReportButton locationId={location.location_id} type="gbp_audit" subtitle="Score, checks, performance, search terms and profile, as a PDF." />
          ) : null
        }
      />
      {report.isPending ? (
        <PageSkeleton />
      ) : report.isError ? (
        <GbpReportError error={report.error} onRetry={() => void report.refetch()} gbpConnected={location.gbp_connected} />
      ) : (
        <AuditContent report={report.data} />
      )}
    </>
  );
}

function AuditContent({ report }: { report: GbpReport }) {
  const [selected, setSelected] = useState<GbpCheck | null>(null);
  const score = report.gbp_score;

  return (
    <div className="space-y-6">
      {score.available ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(260px,0.45fr)_minmax(0,1.55fr)]">
            <ScorePanel score={score} v4Enabled={report.v4_enabled} />
            <TopFixes fixes={score.top_fixes} onSelect={setSelected} />
          </div>
          <Pillars score={score} />
          <Checks score={score} onSelect={setSelected} />
        </>
      ) : (
        <Panel title="GBP Score"><SectionUnavailable section={score} compact /></Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <ReviewsSummary report={report} />
        <MediaSummary report={report} />
        <PostsSummary report={report} />
      </div>

      <ScoreHistory history={report.score_history} />

      <Sheet open={selected !== null} onOpenChange={(open) => (open ? undefined : setSelected(null))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.label}</SheetTitle>
                <SheetDescription>{PILLAR_LABEL[selected.pillar] ?? selected.pillar}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5 px-4">
                <div className="flex items-center gap-3">
                  <StateBadge state={selected.state} />
                  {selected.status === "scored" ? <span className="text-sm text-muted-foreground">{selected.points} of {selected.max} points</span> : null}
                </div>
                <Detail label="What we found" text={selected.detail} />
                {selected.why_it_matters ? <Detail label="Why it matters" text={selected.why_it_matters} /> : null}
                <Detail label="How to improve" text={selected.fix_hint ?? (selected.state === "pass" ? "Nothing to do: this check earns full points." : "No specific action available.")} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
      <p className="mt-1 text-sm leading-6 text-foreground">{text}</p>
    </div>
  );
}

function ScorePanel({ score, v4Enabled }: { score: GbpScore; v4Enabled: boolean }) {
  const excluded = score.excluded_pillars.map((id) => PILLAR_LABEL[id] ?? id);
  return (
    <Panel
      title="GBP Score"
      actions={
        <TermWithTip term={<span className="sr-only">GBP Score</span>}>
          A 0–100 score from the profile's own data: completeness (25), activity (20), reviews (25) and Google's performance numbers (30). Grades: A 85+, B 70+, C 55+, D 40+, F below. Ranking positions are not part of it.
        </TermWithTip>
      }
    >
      <div className="flex items-end gap-4">
        <p className="text-5xl font-semibold tabular text-foreground">{score.score}</p>
        <p className={cn("pb-1 text-3xl font-semibold", GRADE_CLASS[score.grade] ?? "text-foreground")}>{score.grade}</p>
        <p className="pb-2 text-sm text-muted-foreground">out of 100</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {(["pass", "partial", "fail", "not_available"] as const).map((state) => (
          <div key={state} className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5">
            <dt className="text-muted-foreground">{STATE_LABEL[state]}</dt>
            <dd className="font-semibold tabular">{score.counts[state]}</dd>
          </div>
        ))}
      </dl>
      {score.partial ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Partial score: {excluded.join(" and ")} {excluded.length === 1 ? "isn't" : "aren't"} scored yet
          {!v4Enabled ? " (reviews, photos and posts need a Google approval that is still pending)" : ""}, so the rest is scaled to 100.
        </p>
      ) : null}
    </Panel>
  );
}

function TopFixes({ fixes, onSelect }: { fixes: GbpCheck[]; onSelect: (check: GbpCheck) => void }) {
  return (
    <Panel title="Improve first" description="The checks that would add the most points.">
      {fixes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to fix: every scored check earns full points.</p>
      ) : (
        <ol className="-m-4 divide-y divide-border">
          {fixes.map((fix, index) => (
            <li key={fix.id}>
              <button type="button" onClick={() => onSelect(fix)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-tint text-xs font-semibold text-primary">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {fix.label}
                    <span className="text-xs font-normal text-muted-foreground">+{fix.max - fix.points} points possible</span>
                  </span>
                  <span className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Lightbulb aria-hidden className="mt-0.5 size-3 shrink-0" />{fix.fix_hint ?? fix.detail}
                  </span>
                </span>
                <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Pillars({ score }: { score: GbpScore }) {
  const pillars = PILLAR_ORDER.map((id) => score.pillars.find((pillar) => pillar.id === id)).filter((pillar) => pillar !== undefined);
  return (
    <section aria-label="Score parts" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {pillars.map((pillar) => (
        <div key={pillar.id} className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
              {PILLAR_LABEL[pillar.id] ?? pillar.id}
              <TermWithTip term={<span className="sr-only">{PILLAR_LABEL[pillar.id]}</span>}>{PILLAR_DESCRIPTION[pillar.id]}</TermWithTip>
            </p>
            {pillar.available ? <StateBadge state={pillar.state} /> : <StatusBadge>Not scored</StatusBadge>}
          </div>
          {pillar.available && pillar.score !== null ? (
            <>
              <p className="mt-2 text-2xl font-semibold tabular text-foreground">
                {pillar.score}<span className="text-sm font-normal text-muted-foreground"> / {pillar.weight}</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(pillar.score / pillar.weight) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {pillar.counts.pass} good · {pillar.counts.partial} could be better · {pillar.counts.fail} need work
                {pillar.counts.not_available ? ` · ${pillar.counts.not_available} not available` : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No data for this part yet, so it's left out of the score.</p>
          )}
        </div>
      ))}
    </section>
  );
}

function Checks({ score, onSelect }: { score: GbpScore; onSelect: (check: GbpCheck) => void }) {
  return (
    <Panel title="All checks" description="Select a check to see what was found and how to improve it.">
      <div className="space-y-5">
        {PILLAR_ORDER.map((pillarId) => {
          const checks = score.checks.filter((check) => check.pillar === pillarId);
          if (checks.length === 0) return null;
          return (
            <section key={pillarId}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{PILLAR_LABEL[pillarId]}</h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {checks.map((check) => (
                  <li key={check.id}>
                    <Button variant="ghost" className="h-auto w-full justify-between gap-3 rounded-none px-3 py-2.5 text-left" onClick={() => onSelect(check)}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{check.label}</span>
                        <span className="truncate text-xs font-normal text-muted-foreground">{check.detail}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {check.status === "scored" ? <span className="hidden text-xs tabular text-muted-foreground sm:inline">{check.points}/{check.max}</span> : null}
                        <StateBadge state={check.state} />
                        <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

function ReviewsSummary({ report }: { report: GbpReport }) {
  const reviews = report.reviews;
  return (
    <Panel
      title="Reviews"
      actions={<Button asChild variant="ghost" size="sm"><Link to="/reputation/reviews">Reputation <ArrowRight aria-hidden /></Link></Button>}
    >
      {!reviews.available ? (
        <SectionUnavailable section={reviews} compact />
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2">
            <Star aria-hidden className="size-5 fill-warning text-warning" />
            <span className="text-2xl font-semibold tabular">{reviews.average_rating?.toFixed(1) ?? "—"}</span>
            <span className="text-sm text-muted-foreground">{reviews.total?.toLocaleString() ?? "—"} reviews</span>
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">New in 30 days</dt><dd className="text-right tabular">{reviews.new_30d ?? "—"}</dd>
            <dt className="text-muted-foreground">New in 90 days</dt><dd className="text-right tabular">{reviews.new_90d ?? "—"}</dd>
            <dt className="text-muted-foreground">Answered (90 days)</dt><dd className="text-right tabular">{reviews.reply_rate_90d == null ? "—" : `${Math.round(reviews.reply_rate_90d * 100)}%`}</dd>
            <dt className="text-muted-foreground">Typical reply time</dt><dd className="text-right tabular">{reviews.median_reply_hours == null ? "—" : reviews.median_reply_hours < 48 ? `${Math.round(reviews.median_reply_hours)} h` : `${Math.round(reviews.median_reply_hours / 24)} days`}</dd>
            <dt className="text-muted-foreground">Waiting for a reply</dt><dd className="text-right tabular">{reviews.unreplied.length}</dd>
          </dl>
          <div className="space-y-1" aria-label="Rating distribution">
            {(["5", "4", "3", "2", "1"] as const).map((stars) => {
              const count = reviews.distribution[stars] ?? 0;
              const total = Object.values(reviews.distribution).reduce((sum, value) => sum + value, 0);
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular text-muted-foreground">{stars}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-warning" style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div>
                  <span className="w-8 text-right tabular text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

function MediaSummary({ report }: { report: GbpReport }) {
  const media = report.media;
  return (
    <Panel title="Photos">
      {!media.available ? (
        <SectionUnavailable section={media} compact />
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Your photos</dt><dd className="text-right tabular">{media.owner_count}</dd>
          <dt className="text-muted-foreground">Customer photos</dt><dd className="text-right tabular">{media.customer_count}</dd>
          <dt className="text-muted-foreground">Your latest upload</dt><dd className="text-right">{media.latest_owner_upload ? formatRunDate(media.latest_owner_upload) : "—"}</dd>
        </dl>
      )}
    </Panel>
  );
}

function PostsSummary({ report }: { report: GbpReport }) {
  const posts = report.posts;
  return (
    <Panel title="Posts">
      {!posts.available ? (
        <SectionUnavailable section={posts} compact />
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Last 30 days</dt><dd className="text-right tabular">{posts.last_30_days}</dd>
          <dt className="text-muted-foreground">Last 90 days</dt><dd className="text-right tabular">{posts.last_90_days}</dd>
          <dt className="text-muted-foreground">Latest post</dt><dd className="text-right">{posts.last_post_at ? formatRunDate(posts.last_post_at) : "—"}</dd>
          <dt className="text-muted-foreground">All time</dt><dd className="text-right tabular">{posts.total}</dd>
        </dl>
      )}
    </Panel>
  );
}

/** The GBP Score over time; version 1 scores included ranking data, so they aren't compared with version 2. */
function ScoreHistory({ history }: { history: ScoreHistoryEntry[] }) {
  const rows = [...history]
    .sort((a, b) => a.generated_at.localeCompare(b.generated_at))
    .filter((entry) => entry.gbp_score !== null)
    .map((entry) => ({
      label: formatRunDate(entry.generated_at),
      // Separate series per formula version so no line connects across the change.
      v1: (entry.version ?? 1) === 1 ? entry.gbp_score : null,
      v2: (entry.version ?? 1) >= 2 ? entry.gbp_score : null,
    }));
  const changeAt = rows.find((row) => row.v2 !== null && rows.some((other) => other.v1 !== null));
  if (rows.length < 2) {
    return (
      <Panel title="Score history">
        <p className="text-sm text-muted-foreground">The history appears once the report has been made more than once.</p>
      </Panel>
    );
  }
  return (
    <Panel
      title="Score history"
      description={changeAt ? "The dashed line marks when the score stopped including ranking positions; scores before it aren't comparable." : "GBP Score each time the report was made."}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" minTickGap={24} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <Tooltip />
            {changeAt ? <ReferenceLine x={changeAt.label} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" label={{ value: "New formula", fontSize: 11, position: "insideTopLeft" }} /> : null}
            <Line type="monotone" dataKey="v1" name="Old formula" stroke="var(--color-muted-foreground)" strokeDasharray="4 3" dot={{ r: 2 }} connectNulls />
            <Line type="monotone" dataKey="v2" name="GBP Score" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export default LocationGbpAuditPage;
