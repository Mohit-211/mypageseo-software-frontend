import type { ComponentType } from "react";
import { ArrowRight, PartyPopper, Target } from "lucide-react";
import { EXPLAIN, REPORT_ICON, REPORT_META } from "../copy";
import { formatRank, formatRate, plural } from "../format";
import { isAvailable, type ClientPageData, type ClientReportType } from "../types";
import { Card, Delta, Kpi, Stars } from "../ui";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type Highlight = { text: string; to: ClientReportType };

/** The page's first tab: one headline number per report, and what's good and what to do next. */
export function OverviewSection({ page, onOpen }: { page: ClientPageData; onOpen: (type: ClientReportType) => void }) {
  const { good, todo } = highlights(page);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {page.reports.map((type) => (
          <HeadlineTile key={type} type={type} page={page} onOpen={() => onOpen(type)} />
        ))}
      </div>
      {good.length || todo.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {good.length ? <HighlightList title="Good news" icon={PartyPopper} items={good} tone="good" onOpen={onOpen} /> : null}
          {todo.length ? <HighlightList title="Worth doing next" icon={Target} items={todo} tone="todo" onOpen={onOpen} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function HeadlineTile({ type, page, onOpen }: { type: ClientReportType; page: ClientPageData; onOpen: () => void }) {
  const meta = REPORT_META[type];
  const icon = REPORT_ICON[type];
  const footer = (
    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
      See {meta.short.toLowerCase()} <ArrowRight aria-hidden className="size-3" />
    </span>
  );
  const common = { icon, label: meta.label, onClick: onOpen };

  if (type === "rank_tracker") {
    const rt = isAvailable(page.data.rank_tracker) ? page.data.rank_tracker : null;
    return (
      <Kpi
        {...common}
        explain={EXPLAIN.avgRank}
        value={formatRank(rt?.summary?.overall_avg_rank)}
        suffix="average position"
        delta={<Delta value={rt?.summary?.change} better="up" />}
        sub={<>{rt?.summary ? `In the top 3 for ${formatRate(rt.summary.top3_rate)} of searches` : null}<br />{footer}</>}
      />
    );
  }
  if (type === "gbp_audit") {
    const gbp = isAvailable(page.data.gbp_audit) ? page.data.gbp_audit : null;
    const score = gbp && isAvailable(gbp.score) ? gbp.score : null;
    const perf = gbp && isAvailable(gbp.performance) ? gbp.performance : null;
    return (
      <Kpi
        {...common}
        explain={EXPLAIN.score}
        value={score ? Math.round(score.score) : "—"}
        suffix={score ? `/ 100 · ${score.grade}` : undefined}
        sub={<>{perf ? `${perf.totals.impressions.toLocaleString()} views and ${perf.totals.actions.toLocaleString()} actions in ${perf.days} days` : null}<br />{footer}</>}
      />
    );
  }
  if (type === "competitor_analysis") {
    const comp = isAvailable(page.data.competitor_analysis) ? page.data.competitor_analysis : null;
    const scores = [...(comp?.public_scores ?? [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const place = scores.findIndex((entry) => entry.is_self) + 1;
    return (
      <Kpi
        {...common}
        explain={EXPLAIN.competitorScore}
        value={place ? `#${place}` : "—"}
        suffix={scores.length ? `of ${scores.length} nearby` : undefined}
        sub={<>Ranked by listing strength<br />{footer}</>}
      />
    );
  }
  if (type === "citation") {
    const cit = isAvailable(page.data.citation) ? page.data.citation : null;
    return (
      <Kpi
        {...common}
        explain={EXPLAIN.citationScore}
        value={cit?.score?.score !== null && cit?.score?.score !== undefined ? Math.round(cit.score.score) : "—"}
        suffix={cit?.score?.grade ? `/ 100 · ${cit.score.grade}` : undefined}
        sub={<>{cit?.score ? `Listed on ${formatRate(cit.score.coverage)} of ${cit.score.total} directories` : null}<br />{footer}</>}
      />
    );
  }
  const rep = isAvailable(page.data.reputation) ? page.data.reputation : null;
  return (
    <Kpi
      {...common}
      explain={EXPLAIN.rating}
      value={rep?.summary?.average_rating?.toFixed(1) ?? "—"}
      suffix={rep?.summary ? <Stars rating={rep.summary.average_rating} /> : undefined}
      sub={<>{rep?.summary ? `${plural(rep.summary.total, "review")} · ${rep.summary.new_this_month} new this month` : null}<br />{footer}</>}
    />
  );
}

function HighlightList({ title, icon, items, tone, onOpen }: { title: string; icon: Icon; items: Highlight[]; tone: "good" | "todo"; onOpen: (type: ClientReportType) => void }) {
  return (
    <Card title={title} icon={icon}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.text}>
            <button
              type="button"
              onClick={() => onOpen(item.to)}
              className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/30 hover:bg-brand-tint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <span aria-hidden className={tone === "good" ? "size-2 shrink-0 rounded-full bg-success" : "size-2 shrink-0 rounded-full bg-warning"} />
              <span className="flex-1 text-foreground">{item.text}</span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Plain sentences from the data: what went well, and what is worth doing next. */
function highlights(page: ClientPageData): { good: Highlight[]; todo: Highlight[] } {
  const good: Highlight[] = [];
  const todo: Highlight[] = [];
  const has = (type: ClientReportType) => page.reports.includes(type);

  const rt = has("rank_tracker") && isAvailable(page.data.rank_tracker) ? page.data.rank_tracker : null;
  if (rt?.summary?.change && rt.summary.change > 0) good.push({ text: `You moved up ${rt.summary.change.toFixed(1).replace(/\.0$/, "")} places on average in Google Maps.`, to: "rank_tracker" });
  const best = rt?.movers?.improved[0];
  if (best) good.push({ text: `“${best.keyword}” climbed ${best.change} places.`, to: "rank_tracker" });
  if (rt?.movers?.entered.length) good.push({ text: `You now show up for ${plural(rt.movers.entered.length, "new search", "new searches")}.`, to: "rank_tracker" });
  const worst = rt?.movers?.declined[0];
  if (worst) todo.push({ text: `“${worst.keyword}” slipped ${Math.abs(worst.change)} places.`, to: "rank_tracker" });

  const gbp = has("gbp_audit") && isAvailable(page.data.gbp_audit) ? page.data.gbp_audit : null;
  const perf = gbp && isAvailable(gbp.performance) ? gbp.performance : null;
  if (perf && (perf.previous_change.actions ?? 0) > 0.02) good.push({ text: `${Math.round((perf.previous_change.actions ?? 0) * 100)}% more calls, visits and direction requests than the period before.`, to: "gbp_audit" });
  const fix = gbp && isAvailable(gbp.checks) ? gbp.checks.top_fixes[0] : null;
  if (fix) todo.push({ text: `Profile: ${fix.label.charAt(0).toLowerCase()}${fix.label.slice(1)}.`, to: "gbp_audit" });

  const rep = has("reputation") && isAvailable(page.data.reputation) ? page.data.reputation : null;
  if (rep?.summary?.new_this_month) good.push({ text: `${plural(rep.summary.new_this_month, "new review")} this month.`, to: "reputation" });
  if (rep?.summary?.awaiting_attention) todo.push({ text: `${plural(rep.summary.awaiting_attention, "review")} worth a reply.`, to: "reputation" });

  const cit = has("citation") && isAvailable(page.data.citation) ? page.data.citation : null;
  const wrong = cit?.nap_issues ? new Set(cit.nap_issues.rows.map((row) => row.directory)).size : 0;
  if (wrong) todo.push({ text: `${plural(wrong, "directory", "directories")} show${wrong === 1 ? "s" : ""} different details than your Google listing.`, to: "citation" });

  return { good: good.slice(0, 4), todo: todo.slice(0, 4) };
}
