import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  Eye,
  Globe,
  ImageIcon,
  ListChecks,
  MessageSquareText,
  MousePointerClick,
  Navigation,
  Newspaper,
  Phone,
  Search,
  Sparkles,
  Star,
  Store,
} from "lucide-react";
import type { CheckState as AppCheckState, GbpPillarId } from "@/api";
import { PILLAR_DESCRIPTION, PILLAR_LABEL, STATE_LABEL } from "@/lib/gbp/gbp-labels";
import { cn } from "@/lib/utils";
import { EXPLAIN, unavailableText } from "../copy";
import { formatDate, formatMonth, formatNumber, formatPercentChange, formatRate, formatShortDate } from "../format";
import { isAvailable, type CheckState, type GbpAuditData } from "../types";
import { Bar, Card, Delta, Explain, Kpi, NotAvailable, Pill, ScoreRing, Stars } from "../ui";

const STATE_PILL: Record<CheckState, "good" | "warn" | "bad" | "neutral"> = { pass: "good", partial: "warn", fail: "bad", not_available: "neutral" };
const stateLabel = (state: string) => STATE_LABEL[state as AppCheckState] ?? state;
const pillarLabel = (id: string) => PILLAR_LABEL[id as GbpPillarId] ?? id;

export function GbpAuditSection({ data }: { data: GbpAuditData }) {
  return (
    <div className="space-y-6">
      <ScoreBlock data={data} />
      <Performance data={data} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SearchTerms data={data} />
        <Activity data={data} />
      </div>
      <Checks data={data} />
      <ListingDetails data={data} />
    </div>
  );
}

function ScoreBlock({ data }: { data: GbpAuditData }) {
  const score = isAvailable(data.score) ? data.score : null;
  const fixes = isAvailable(data.checks) ? data.checks.top_fixes : [];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Card title="Profile score" icon={BadgeCheck} explain={EXPLAIN.score}>
        {score ? (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-3">
              <ScoreRing value={score.score} label={score.grade} />
              <div className="flex flex-wrap justify-center gap-1.5">
                <Pill tone="good">{score.counts.pass} good</Pill>
                {score.counts.partial ? <Pill tone="warn">{score.counts.partial} could be better</Pill> : null}
                {score.counts.fail ? <Pill tone="bad">{score.counts.fail} need work</Pill> : null}
              </div>
            </div>
            <div className="w-full min-w-0 flex-1 space-y-3">
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                What the score is made of <Explain label="About the score areas">{EXPLAIN.pillars}</Explain>
              </p>
              {score.pillars.map((pillar) => (
                <div key={pillar.id} title={PILLAR_DESCRIPTION[pillar.id as GbpPillarId]}>
                  <Bar
                    label={pillarLabel(pillar.id)}
                    value={pillar.score ?? 0}
                    max={100}
                    display={pillar.available && pillar.score !== null ? Math.round(pillar.score) : "—"}
                    color={pillar.score === null ? undefined : pillar.score >= 80 ? "var(--success)" : pillar.score >= 50 ? "var(--warning)" : "var(--critical)"}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <NotAvailable>{unavailableText(data.score && !isAvailable(data.score) ? data.score.reason : "no_data")}</NotAvailable>
        )}
      </Card>
      <Card title="What to work on first" icon={Sparkles} explain={EXPLAIN.topFixes}>
        {fixes.length ? (
          <ol className="space-y-2.5">
            {fixes.slice(0, 5).map((fix, index) => (
              <li key={fix.label} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
                <span className="bevel size-7 shrink-0 text-xs font-bold">{index + 1}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{fix.label}</span>
                  {fix.fix_hint ? <span className="block text-xs text-muted-foreground">{fix.fix_hint}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <NotAvailable>Nothing urgent. Your listing is in good shape.</NotAvailable>
        )}
      </Card>
    </div>
  );
}

const METRICS = [
  { key: "impressions", label: "Views", icon: Eye },
  { key: "actions", label: "Actions", icon: MousePointerClick },
  { key: "calls", label: "Calls", icon: Phone },
  { key: "website_clicks", label: "Website visits", icon: Globe },
  { key: "direction_requests", label: "Directions", icon: Navigation },
] as const;

function Performance({ data }: { data: GbpAuditData }) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("impressions");
  if (!isAvailable(data.performance)) return null;
  const perf = data.performance;
  const active = METRICS.find((entry) => entry.key === metric)!;
  const points = perf.by_day.map((day) => ({ date: formatShortDate(`${day.date}T12:00:00Z`), full: formatDate(`${day.date}T12:00:00Z`), value: day[metric] }));
  const surfaceTotal = perf.by_surface.maps + perf.by_surface.search;
  const deviceTotal = perf.by_device.mobile + perf.by_device.desktop;

  return (
    <Card
      title="How people found and contacted you"
      icon={Eye}
      explain={<>{EXPLAIN.views} {EXPLAIN.actions}</>}
      actions={<span className="text-xs text-muted-foreground">{formatDate(`${perf.start}T12:00:00Z`)} – {formatDate(`${perf.end}T12:00:00Z`)}</span>}
    >
      <div className="space-y-5">
        {/* The tiles double as the chart's metric switch. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="tablist" aria-label="Chart">
          {METRICS.map((entry) => {
            const Icon = entry.icon;
            const change = perf.previous_change[entry.key];
            return (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={metric === entry.key}
                onClick={() => setMetric(entry.key)}
                className={cn(
                  "card-3d card-lift p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  metric === entry.key && "ring-2 ring-primary/50",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon aria-hidden className="size-3.5 text-primary" /> {entry.label}
                </span>
                <span className="mt-1 block text-2xl font-semibold tabular text-foreground">{formatNumber(perf.totals[entry.key])}</span>
                <Delta value={change} text={formatPercentChange(change)} better="up" />
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Arrows compare with the previous {perf.days} days. Tap a tile to chart it.</p>

        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="perf-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: "var(--primary)", stopOpacity: 0.32 }} />
                  <stop offset="100%" style={{ stopColor: "var(--primary)", stopOpacity: 0.02 }} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip
                cursor={{ stroke: "var(--primary)", strokeOpacity: 0.25 }}
                content={({ active: on, payload }) => {
                  const point = on ? (payload?.[0]?.payload as (typeof points)[number] | undefined) : undefined;
                  return point ? (
                    <div className="card-3d px-3 py-2 text-xs">
                      <p className="text-muted-foreground">{point.full}</p>
                      <p className="text-sm font-semibold text-foreground">{formatNumber(point.value)} {active.label.toLowerCase()}</p>
                    </div>
                  ) : null;
                }}
              />
              <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} fill="url(#perf-fill)" animationDuration={700} activeDot={{ r: 5, fill: "var(--primary)", stroke: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Split title="Where they saw you" a={{ label: "Google Maps", value: perf.by_surface.maps }} b={{ label: "Google Search", value: perf.by_surface.search }} total={surfaceTotal} />
          <Split title="On which device" a={{ label: "Phone", value: perf.by_device.mobile }} b={{ label: "Computer", value: perf.by_device.desktop }} total={deviceTotal} />
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Actions per 1,000 views <Explain label="About actions per 1,000 views">{EXPLAIN.per1000}</Explain>
            </p>
            <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold tabular text-foreground">
              {formatNumber(perf.actions_per_1000)}
              <Delta value={perf.actions_per_1000_change} text={formatPercentChange(perf.actions_per_1000_change)} better="up" />
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Two shares of one total as a split bar. */
function Split({ title, a, b, total }: { title: string; a: { label: string; value: number }; b: { label: string; value: number }; total: number }) {
  const share = total > 0 ? a.value / total : 0.5;
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <div className="bar-track mt-3 flex h-3 overflow-hidden rounded-full">
        <span className="bar-3d h-full" style={{ width: `${share * 100}%` }} />
        <span className="bar-3d h-full" style={{ width: `${(1 - share) * 100}%`, ["--bar" as string]: "var(--accent-2)" }} />
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="text-foreground"><span className="font-semibold tabular">{formatRate(total ? share : null)}</span> {a.label}</span>
        <span className="text-foreground"><span className="font-semibold tabular">{formatRate(total ? 1 - share : null)}</span> {b.label}</span>
      </div>
    </div>
  );
}

function SearchTerms({ data }: { data: GbpAuditData }) {
  if (!isAvailable(data.keywords) || data.keywords.top.length === 0) return null;
  const top = data.keywords.top.slice(0, 8);
  const max = Math.max(...top.map((entry) => entry.value ?? entry.threshold ?? 0), 1);
  return (
    <Card title="What people searched for" icon={Search} explain={EXPLAIN.searchTerms} actions={<span className="text-xs text-muted-foreground">{formatMonth(data.keywords.latest_month)}</span>}>
      <div className="space-y-2.5">
        {top.map((entry) => (
          <Bar
            key={entry.keyword}
            label={entry.keyword}
            value={entry.value ?? entry.threshold ?? 0}
            max={max}
            display={entry.value !== null ? formatNumber(entry.value) : entry.threshold !== null ? `< ${entry.threshold}` : "—"}
          />
        ))}
      </div>
    </Card>
  );
}

function Activity({ data }: { data: GbpAuditData }) {
  const rmp = data.reviews_media_posts;
  if (!rmp) return null;
  const reviews = isAvailable(rmp.reviews) ? rmp.reviews : null;
  const media = isAvailable(rmp.media) ? rmp.media : null;
  const posts = isAvailable(rmp.posts) ? rmp.posts : null;
  return (
    <Card title="Reviews, photos and posts" icon={Star}>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <Kpi
          icon={Star}
          label="Rating"
          value={reviews?.average_rating?.toFixed(1) ?? "—"}
          sub={reviews ? <><Stars rating={reviews.average_rating} /> <span className="ml-1">{formatNumber(reviews.total)} reviews</span></> : unavailableText("v4_access_pending")}
        />
        <Kpi icon={ImageIcon} label="Photos" value={media ? formatNumber(media.owner_count + media.customer_count) : "—"} sub={media ? `${media.owner_count} yours · ${media.customer_count} from customers` : "Not available"} />
        <Kpi icon={Newspaper} label="Posts (30 days)" value={posts ? posts.last_30_days : "—"} sub={posts?.last_post_at ? `Last ${formatDate(posts.last_post_at)}` : "No recent posts"} />
      </div>
    </Card>
  );
}

function Checks({ data }: { data: GbpAuditData }) {
  if (!isAvailable(data.checks)) return null;
  const checks = data.checks.checks;
  const pillars = [...new Set(checks.map((check) => check.pillar))];
  const order: Record<string, number> = { fail: 0, partial: 1, pass: 2, not_available: 3 };
  return (
    <Card title="Everything we checked" icon={ListChecks} explain={EXPLAIN.checks}>
      <div className="space-y-5">
        {pillars.map((pillar) => (
          <div key={pillar}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{pillarLabel(pillar)}</p>
            <div className="space-y-2">
              {checks
                .filter((check) => check.pillar === pillar)
                .sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9))
                .map((check) => (
                  <details key={check.label} className="group rounded-xl border border-border bg-surface transition-shadow open:shadow-raised">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                      <Pill tone={STATE_PILL[check.state as CheckState] ?? "neutral"} className="shrink-0">{stateLabel(check.state)}</Pill>
                      <span className="min-w-0 flex-1 font-medium text-foreground">{check.label}</span>
                      <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 px-4 pb-4 text-sm">
                      <p className="text-muted-foreground">{check.detail}</p>
                      {check.why_it_matters ? <p><span className="font-medium text-foreground">Why it matters: </span><span className="text-muted-foreground">{check.why_it_matters}</span></p> : null}
                      {check.fix_hint && check.state !== "pass" ? <p className="rounded-lg bg-brand-tint px-3 py-2 text-foreground"><span className="font-medium">How to improve: </span>{check.fix_hint}</p> : null}
                    </div>
                  </details>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ListingDetails({ data }: { data: GbpAuditData }) {
  const profile = isAvailable(data.profile) ? data.profile : null;
  const verification = isAvailable(data.verification) ? data.verification : null;
  if (!profile && !verification) return null;
  const rows: { icon: typeof Store; label: string; value: string | null; ok?: boolean | null }[] = [
    { icon: Store, label: "Name", value: profile?.title ?? null, ok: profile?.nap.find((entry) => entry.field === "name")?.match ?? null },
    { icon: Sparkles, label: "Main category", value: profile?.primary_category ?? null },
    { icon: Phone, label: "Phone", value: profile?.phone ?? null, ok: profile?.nap.find((entry) => entry.field === "phone")?.match ?? null },
    { icon: Globe, label: "Website", value: profile?.website ?? null, ok: profile?.nap.find((entry) => entry.field === "website")?.match ?? null },
    { icon: CalendarClock, label: "Opening hours", value: profile ? (profile.hours_set ? "Set" : "Missing") : null, ok: profile?.hours_set ?? null },
    { icon: MessageSquareText, label: "Description", value: profile ? (profile.description_length ? `${profile.description_length} characters` : "Missing") : null, ok: profile ? profile.description_length >= 250 : null },
    { icon: BadgeCheck, label: "Verified by Google", value: verification ? (verification.verified ? "Yes" : "Not yet") : null, ok: verification?.verified ?? null },
  ];
  return (
    <Card title="Your listing at a glance" icon={Store}>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex items-start gap-3 border-b border-border/60 pb-3">
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="truncate text-sm font-medium text-foreground">{row.value ?? "—"}</dd>
              </div>
              {row.ok === true ? <Pill tone="good">OK</Pill> : row.ok === false ? <Pill tone="warn">Check</Pill> : null}
            </div>
          );
        })}
      </dl>
      {profile && profile.additional_categories.length ? (
        <p className="mt-3 text-xs text-muted-foreground">Also listed as: {profile.additional_categories.join(", ")}</p>
      ) : null}
    </Card>
  );
}
