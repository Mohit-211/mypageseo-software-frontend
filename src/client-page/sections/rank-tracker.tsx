import { useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Crown, Grid3x3, ListOrdered, MapPin, Target, TrendingUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPLAIN } from "../copy";
import { formatDate, formatRank, formatRate, formatShortDate, plural } from "../format";
import { capStyle, rankBucket } from "../ranks";
import type { RankTrackerData, RtGrid } from "../types";
import { BucketLegend, Card, Delta, Explain, Kpi, NotAvailable, Pill, RankCap } from "../ui";

export function RankTrackerSection({ data }: { data: RankTrackerData }) {
  const summary = data.summary;
  return (
    <div className="space-y-6">
      {summary ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi
            icon={Trophy}
            label="Average position"
            explain={EXPLAIN.avgRank}
            value={formatRank(summary.overall_avg_rank)}
            delta={<Delta value={summary.change} better="up" />}
            sub="1 is the top spot"
          />
          <Kpi icon={Crown} label="In the top 3" explain={EXPLAIN.top3} value={formatRate(summary.top3_rate)} sub="of all searches" />
          <Kpi icon={Target} label="Found on Maps" explain={EXPLAIN.found} value={formatRate(summary.found_rate)} sub="in the first 60 results" />
          <Kpi icon={ListOrdered} label="Searches tracked" explain={EXPLAIN.keywords} value={summary.keywords} sub={`Measured ${formatDate(data.run.run_at)}`} />
        </div>
      ) : null}

      {data.grid && data.grid.length > 0 ? <GridBoard grids={data.grid} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Your position over time" icon={TrendingUp} explain={EXPLAIN.trend}>
          {data.history && data.history.filter((point) => point.overall_avg_rank !== null).length > 1 ? (
            <TrendChart history={data.history} />
          ) : (
            <NotAvailable>The trend appears after the second update.</NotAvailable>
          )}
        </Card>
        <Movers data={data} />
      </div>

      {data.keywords && data.keywords.length > 0 ? <KeywordTable rows={data.keywords} /> : null}
      {data.keyword_groups && data.keyword_groups.length > 0 ? <Groups groups={data.keyword_groups} /> : null}
      {data.map_ranking && data.map_ranking.length > 0 ? <MapTop rankings={data.map_ranking} /> : null}
    </div>
  );
}

/** Keyword chips above a block; one keyword at a time. */
function KeywordPicker({ keywords, value, onChange }: { keywords: string[]; value: number; onChange: (index: number) => void }) {
  if (keywords.length < 2) return null;
  return (
    <div role="tablist" aria-label="Search" className="flex flex-wrap gap-2">
      {keywords.map((keyword, index) => (
        <button
          key={keyword}
          type="button"
          role="tab"
          aria-selected={index === value}
          aria-current={index === value ? "true" : undefined}
          onClick={() => onChange(index)}
          className={cn(
            "tab-raised rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            index === value && "border-primary/30",
          )}
        >
          {keyword}
        </button>
      ))}
    </div>
  );
}

const DIRECTIONS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

/** "1.6 km north-east of your business" for a grid cell. */
function cellPlace(grid: RtGrid, row: number, col: number): string {
  const center = (grid.size - 1) / 2;
  const dx = (col - center) * grid.spacing_km;
  const dy = (center - row) * grid.spacing_km;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.01) return "At your business";
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  const direction = DIRECTIONS[Math.round(((angle + 360) % 360) / 45) % 8];
  return `${distance.toFixed(1).replace(/\.0$/, "")} km ${direction} of your business`;
}

/** The local search grid as a board of key caps that leans back and straightens on hover. */
function GridBoard({ grids }: { grids: RtGrid[] }) {
  const [index, setIndex] = useState(0);
  const [focus, setFocus] = useState<{ row: number; col: number } | null>(null);
  const grid = grids[Math.min(index, grids.length - 1)]!;
  const byCell = useMemo(() => new Map(grid.cells.map((cell) => [`${cell.row}:${cell.col}`, cell])), [grid]);
  const center = (grid.size - 1) / 2;
  const focused = focus ? byCell.get(`${focus.row}:${focus.col}`) : null;

  return (
    <Card title="Where nearby customers find you" icon={Grid3x3} explain={EXPLAIN.grid}>
      <div className="space-y-4">
        <KeywordPicker keywords={grids.map((entry) => entry.keyword)} value={index} onChange={(next) => { setIndex(next); setFocus(null); }} />
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="board-stage mx-auto w-full max-w-[30rem]">
            <div
              className="board-tilt grid gap-1.5 rounded-2xl bg-gradient-to-b from-surface-strong to-brand-tint-strong p-3 shadow-[inset_0_1px_3px_rgb(15_23_42/0.12)] sm:gap-2"
              style={{ gridTemplateColumns: `repeat(${grid.size}, minmax(0, 1fr))` }}
              onMouseLeave={() => setFocus(null)}
            >
              {Array.from({ length: grid.size * grid.size }, (_, i) => {
                const row = Math.floor(i / grid.size);
                const col = i % grid.size;
                const cell = byCell.get(`${row}:${col}`);
                const bucket = rankBucket(cell?.rank ?? null, cell?.status ?? "error");
                const isCenter = row === center && col === center;
                const text = bucket === "error" ? "–" : bucket === "not_found" ? "60+" : String(cell?.rank ?? "–");
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${cellPlace(grid, row, col)}: ${bucket === "not_found" ? "not in the top 60" : bucket === "error" ? "no result" : `position ${cell?.rank}`}`}
                    onMouseEnter={() => setFocus({ row, col })}
                    onFocus={() => setFocus({ row, col })}
                    onClick={() => setFocus({ row, col })}
                    className={cn(
                      "keycap relative flex aspect-square items-center justify-center text-[11px] font-bold tabular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                      isCenter && "ring-2 ring-white ring-offset-2 ring-offset-primary",
                    )}
                    style={capStyle(bucket)}
                  >
                    {text}
                    {isCenter ? <MapPin aria-hidden className="absolute -top-2 -right-2 size-4 rounded-full bg-white p-0.5 text-primary shadow" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface-strong/70 p-4" aria-live="polite">
              {focused && focus ? (
                <>
                  <p className="text-xs text-muted-foreground">{cellPlace(grid, focus.row, focus.col)}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
                    <RankCap rank={focused.rank} status={focused.status} />
                    {focused.status === "ok" && focused.rank !== null ? `You were #${focused.rank} here` : focused.status === "not_found" ? "You weren't in the first 60 results" : "Google gave no result here"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Hover over or tap a square to see where the search was made and how you ranked.</p>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Average", value: formatRank(grid.avg_rank) },
                { label: "Top 3", value: formatRate(grid.top3_rate) },
                { label: "Found", value: formatRate(grid.found_rate) },
              ].map((stat) => (
                <div key={stat.label} className="card-3d px-2 py-3">
                  <dt className="text-[11px] text-muted-foreground">{stat.label}</dt>
                  <dd className="text-lg font-semibold tabular text-foreground">{stat.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              {grid.size} × {grid.size} spots, {grid.spacing_km} km apart. The pinned square is your business.
            </p>
            <BucketLegend />
          </div>
        </div>
      </div>
    </Card>
  );
}

function TrendChart({ history }: { history: { run_at: string; overall_avg_rank: number | null }[] }) {
  const points = [...history]
    .sort((a, b) => a.run_at.localeCompare(b.run_at))
    .map((point) => ({ date: formatShortDate(point.run_at), full: formatDate(point.run_at), rank: point.overall_avg_rank }));
  // Position 1 sits at the top; the shading fills down to the lowest position shown.
  const bottom = Math.ceil(Math.max(...points.map((point) => point.rank ?? 1)) + 1);
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="rank-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--primary)", stopOpacity: 0.35 }} />
              <stop offset="100%" style={{ stopColor: "var(--primary)", stopOpacity: 0.02 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis reversed allowDecimals={false} domain={[1, bottom]} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip
            cursor={{ stroke: "var(--primary)", strokeOpacity: 0.25 }}
            content={({ active, payload }) => {
              const point = active ? (payload?.[0]?.payload as (typeof points)[number] | undefined) : undefined;
              return point ? (
                <div className="card-3d px-3 py-2 text-xs">
                  <p className="text-muted-foreground">{point.full}</p>
                  <p className="text-sm font-semibold text-foreground">Average position {formatRank(point.rank)}</p>
                </div>
              ) : null;
            }}
          />
          <Area
            type="monotone"
            dataKey="rank"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="url(#rank-fill)"
            baseValue={bottom}
            animationDuration={700}
            connectNulls
            dot={{ r: 3, fill: "#fff", stroke: "var(--primary)", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "var(--primary)", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Movers({ data }: { data: RankTrackerData }) {
  const movers = data.movers;
  const has = movers && (movers.improved.length || movers.declined.length || movers.entered.length || movers.dropped.length);
  return (
    <Card title="Biggest changes" icon={TrendingUp} explain={EXPLAIN.movers}>
      {!has ? (
        <NotAvailable>No changes to compare yet.</NotAvailable>
      ) : (
        <ul className="space-y-2">
          {movers.improved.slice(0, 4).map((entry) => (
            <MoverRow key={`up-${entry.keyword}`} keyword={entry.keyword}>
              <Delta value={entry.change} better="up" />
            </MoverRow>
          ))}
          {movers.entered.slice(0, 3).map((keyword) => (
            <MoverRow key={`in-${keyword}`} keyword={keyword}>
              <Pill tone="good">Now found</Pill>
            </MoverRow>
          ))}
          {movers.declined.slice(0, 4).map((entry) => (
            <MoverRow key={`down-${entry.keyword}`} keyword={entry.keyword}>
              <Delta value={-Math.abs(entry.change)} text={String(Math.abs(entry.change))} better="up" />
            </MoverRow>
          ))}
          {movers.dropped.slice(0, 3).map((keyword) => (
            <MoverRow key={`out-${keyword}`} keyword={keyword}>
              <Pill tone="bad">Dropped out</Pill>
            </MoverRow>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MoverRow({ keyword, children }: { keyword: string; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm">
      <span className="truncate text-foreground">{keyword}</span>
      {children}
    </li>
  );
}

function KeywordTable({ rows }: { rows: RankTrackerData["keywords"] & object }) {
  const sorted = [...rows].sort((a, b) => (a.avg_rank ?? 99) - (b.avg_rank ?? 99));
  return (
    <Card title="Every search we track" icon={ListOrdered} explain={EXPLAIN.keywords} bodyClassName="px-0 pb-2">
      <div className="data-grid-scroll">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-5 py-2 font-medium">Search</th>
              <th className="px-3 py-2 font-medium">
                <span className="inline-flex items-center gap-1">Position <Explain label="About position">{EXPLAIN.avgRank}</Explain></span>
              </th>
              <th className="px-3 py-2 font-medium">Change</th>
              <th className="px-3 py-2 font-medium">Top 3</th>
              <th className="px-5 py-2 text-right font-medium">Found</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.keyword} className="border-t border-border/70 transition-colors hover:bg-brand-tint/60">
                <td className="px-5 py-2.5 font-medium text-foreground">{row.keyword}</td>
                <td className="px-3 py-2.5"><RankCap rank={row.avg_rank} /></td>
                <td className="px-3 py-2.5">{row.change ? <Delta value={row.change} better="up" /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2.5 tabular text-muted-foreground">{formatRate(row.top3_rate)}</td>
                <td className="px-5 py-2.5 text-right tabular text-muted-foreground">{formatRate(row.found_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Groups({ groups }: { groups: NonNullable<RankTrackerData["keyword_groups"]> }) {
  return (
    <Card title="By topic" icon={ListOrdered} explain={EXPLAIN.groups}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.name} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">{group.name}</p>
              <RankCap rank={group.avg_rank} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {plural(group.keywords.length, "search", "searches")} · top 3 {formatRate(group.top3_rate)}
            </p>
            {group.change ? <Delta value={group.change} better="up" className="mt-2" /> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

const POINT_NAME: Record<string, string> = { C: "Your business", N: "North", S: "South", E: "East", W: "West" };

function MapTop({ rankings }: { rankings: NonNullable<RankTrackerData["map_ranking"]> }) {
  const [index, setIndex] = useState(0);
  const [pointIndex, setPointIndex] = useState(0);
  const ranking = rankings[Math.min(index, rankings.length - 1)]!;
  const point = ranking.points[Math.min(pointIndex, ranking.points.length - 1)];
  return (
    <Card title="Who shows up first on the map" icon={MapPin} explain={EXPLAIN.mapTop}>
      <div className="space-y-4">
        <KeywordPicker keywords={rankings.map((entry) => entry.keyword)} value={index} onChange={(next) => { setIndex(next); setPointIndex(0); }} />
        <div className="track-inset inline-flex flex-wrap gap-1 rounded-xl p-1" role="tablist" aria-label="Searched from">
          {ranking.points.map((entry, i) => (
            <button
              key={entry.point}
              type="button"
              role="tab"
              aria-selected={i === pointIndex}
              aria-current={i === pointIndex ? "true" : undefined}
              onClick={() => setPointIndex(i)}
              className="tab-raised rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {POINT_NAME[entry.point] ?? entry.point}
            </button>
          ))}
        </div>
        {point ? (
          <>
            <ol className="space-y-2">
              {point.top.map((entry) => (
                <li
                  key={`${entry.rank}-${entry.name}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
                    entry.is_self ? "card-3d border-primary/30 font-semibold text-primary" : "border-border bg-surface text-foreground",
                  )}
                >
                  <span className="keycap inline-flex size-7 shrink-0 items-center justify-center text-xs font-bold" style={capStyle(rankBucket(entry.rank))}>{entry.rank}</span>
                  <span className="truncate">{entry.name ?? "A business"}</span>
                  {entry.is_self ? <Pill tone="brand" className="ml-auto">You</Pill> : null}
                </li>
              ))}
            </ol>
            {!point.top.some((entry) => entry.is_self) ? (
              <p className="text-sm text-muted-foreground">
                From here you were {point.self_rank ? `#${point.self_rank}` : "not in the top 20"}.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}
