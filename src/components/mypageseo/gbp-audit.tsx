import { useState } from "react";
import { AlertCircle, ChevronRight } from "lucide-react";
import { MetricCard, Panel, ScoreIndicator, StatusBadge, type StatusTone } from "@/components/mypageseo/data-display";
import { EmptyState, ErrorState, MetricSkeletonGrid, TableSkeleton } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditCategory, AuditFinding, AuditFindingStatus, GbpAuditData } from "@/lib/mypageseo/gbp-audit";

const labels: Record<AuditFindingStatus, string> = { healthy: "Healthy", attention: "Needs attention", warning: "Warning", incomplete: "Incomplete", unavailable: "Unavailable" };
const tones: Record<AuditFindingStatus, StatusTone> = { healthy: "success", attention: "warning", warning: "warning", incomplete: "critical", unavailable: "neutral" };

export function GbpAuditLoading() {
  return <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading GBP audit"><MetricSkeletonGrid count={4} /><div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]"><Skeleton className="h-72 w-full" /><TableSkeleton rows={8} columns={3} /></div></div>;
}

export function GbpAuditContent({ data, onRetry }: { data: GbpAuditData; onRetry: () => void }) {
  const [selected, setSelected] = useState<{ category: AuditCategory; finding: AuditFinding } | null>(null);
  if (data.status === "loading") return <GbpAuditLoading />;
  if (data.status === "error") return <ErrorState title="GBP audit could not be loaded" description="We couldn't load the current audit. Try again without leaving this location." onRetry={onRetry} />;
  if (data.status === "disconnected") return <EmptyState title="Connect Google Business Profile to run an audit" description="This location needs a connected Google Business Profile before Mypageseo can evaluate profile information, reviews, media, duplicates, website signals, and local search signals. Connection is not available in the current product integration." className="min-h-72" />;
  if (data.status === "not_generated") return <EmptyState title="No GBP audit is available yet" description={data.canRunAudit ? "Run the first audit to evaluate this profile's available GBP and local SEO signals." : "An audit can appear here after audit generation is available for this location."} className="min-h-72" />;

  return (
    <div className="space-y-6">
      <section aria-labelledby="audit-summary-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 id="audit-summary-title" className="text-sm font-semibold text-foreground">Audit summary</h2><p className="text-xs text-muted-foreground">Counts reflect checks evaluated in this audit only.</p></div>{data.status === "partial" ? <StatusBadge tone="warning">Partial data</StatusBadge> : null}</div>
        <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
          <MetricCard label="Audit score" value={data.score ?? "—"} caption={data.scoreExplanation ?? "Scoring methodology unavailable"} />
          <MetricCard label="Checks passed" value={data.summary.passed ?? "—"} caption="Healthy checks" />
          <MetricCard label="Needs attention" value={data.summary.attention ?? "—"} caption="Actionable findings" />
          <MetricCard label="Could not evaluate" value={data.summary.unavailable ?? "—"} caption="Checks without sufficient data" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Panel title="Overall health" description="Derived only from evaluated checks">{data.score === null ? <Unavailable text="No audit score is available." /> : <ScoreIndicator label={data.scoreLabel ?? "GBP audit"} score={data.score} {...(data.scoreExplanation ? { detail: data.scoreExplanation } : {})} />}{data.previousAudit ? <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Previous audit: {data.previousAudit.checkedAt}{data.previousAudit.score === null ? "" : ` · ${data.previousAudit.score}`}</p> : null}</Panel>
        <Panel title="Diagnostic areas" description="Select an available finding to review its context and next step">
          {data.categories.length === 0 ? <Unavailable text="Audit categories could not be evaluated." /> : <div className="divide-y divide-border">{data.categories.map((category) => <CategoryRow key={category.id} category={category} onSelect={(finding) => setSelected({ category, finding })} />)}</div>}
        </Panel>
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected ? <><SheetHeader><SheetTitle>{selected.finding.title}</SheetTitle><SheetDescription>{selected.category.title}</SheetDescription></SheetHeader><div className="mt-6 space-y-5"><StatusBadge tone={tones[selected.finding.status]}>{labels[selected.finding.status]}</StatusBadge><Detail label="Finding" text={selected.finding.summary} /><Detail label="Why it matters" text={selected.finding.whyItMatters ?? "No additional context is available."} /><Detail label="Next step" text={selected.finding.nextStep ?? "No supported action is available."} /></div></> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CategoryRow({ category, onSelect }: { category: AuditCategory; onSelect: (finding: AuditFinding) => void }) {
  return <section className="min-w-0 py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-foreground">{category.title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{category.description}</p></div><StatusBadge tone={tones[category.status]}>{labels[category.status]}</StatusBadge></div>{category.findings.length > 0 ? <div className="mt-3 divide-y divide-border rounded-md border border-border">{category.findings.map((finding) => <Button key={finding.id} variant="ghost" className="h-auto w-full min-w-0 justify-between rounded-none px-3 py-2.5 text-left first:rounded-t-md last:rounded-b-md" onClick={() => onSelect(finding)}><span className="flex min-w-0 flex-1 flex-col"><span className="block truncate text-sm font-medium">{finding.title}</span><span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{finding.summary}</span></span><ChevronRight className="size-4 shrink-0" aria-hidden /></Button>)}</div> : <p className="mt-3 text-xs text-muted-foreground">No findings are available for this category.</p>}</section>;
}

function Detail({ label, text }: { label: string; text: string }) { return <div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3><p className="mt-1 text-sm leading-6 text-foreground">{text}</p></div>; }
function Unavailable({ text }: { text: string }) { return <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><AlertCircle className="size-4 shrink-0" aria-hidden />{text}</div>; }