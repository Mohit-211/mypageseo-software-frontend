import { AlertCircle, Heart, MessageCircleReply, MessageSquareText, Star, Tags, ThumbsDown, ThumbsUp } from "lucide-react";
import { EXPLAIN, unavailableText } from "../copy";
import { formatDate, formatNumber, formatRate } from "../format";
import { isAvailable, type ReputationData } from "../types";
import { Bar, Card, Kpi, NotAvailable, Pill, Stars } from "../ui";

const STAR_COLOR: Record<number, string> = {
  5: "var(--success)",
  4: "color-mix(in oklch, var(--success) 60%, var(--warning))",
  3: "var(--warning)",
  2: "color-mix(in oklch, var(--warning) 50%, var(--critical))",
  1: "var(--critical)",
};

export function ReputationSection({ data }: { data: ReputationData }) {
  const summary = data.summary;
  return (
    <div className="space-y-6">
      {summary ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Star} label="Average rating" explain={EXPLAIN.rating} value={summary.average_rating?.toFixed(1) ?? "—"} sub={<Stars rating={summary.average_rating} />} />
          <Kpi icon={MessageSquareText} label="Reviews" value={formatNumber(summary.total)} sub={`${summary.new_this_month} new this month`} />
          <Kpi icon={MessageCircleReply} label="Replied to" explain={EXPLAIN.replyRate} value={formatRate(summary.reply_rate)} sub="of reviews" />
          <Kpi icon={AlertCircle} label="Worth a reply" explain={EXPLAIN.needsAttention} value={summary.awaiting_attention} sub={summary.awaiting_attention ? "waiting for an answer" : "all caught up"} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Distribution data={data} />
        <Themes data={data} />
      </div>
      <NeedsAttention data={data} />
      <Replies data={data} />
    </div>
  );
}

function Distribution({ data }: { data: ReputationData }) {
  const rows = [...(data.distribution ?? [])].sort((a, b) => b.stars - a.stars);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <Card title="Star ratings" icon={Star}>
      <div className="space-y-3">
        {rows.map((row) => (
          <Bar key={row.stars} label={`${row.stars} star${row.stars === 1 ? "" : "s"}`} value={row.count} max={max} color={STAR_COLOR[row.stars]} />
        ))}
      </div>
      {data.summary ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone="good"><ThumbsUp aria-hidden className="size-3" /> {data.summary.positive} positive</Pill>
          <Pill tone="bad"><ThumbsDown aria-hidden className="size-3" /> {data.summary.negative} negative</Pill>
        </div>
      ) : null}
    </Card>
  );
}

function Themes({ data }: { data: ReputationData }) {
  const insights = data.insights;
  if (!insights) return null;
  if (!isAvailable(insights)) {
    return (
      <Card title="What customers talk about" icon={Tags} explain={EXPLAIN.themes}>
        <NotAvailable>{unavailableText(insights.reason)}</NotAvailable>
      </Card>
    );
  }
  const tone = (sentiment: string) => (sentiment === "positive" ? "good" : sentiment === "negative" ? "bad" : "neutral");
  return (
    <Card title="What customers talk about" icon={Tags} explain={EXPLAIN.themes}>
      <div className="flex flex-wrap gap-2">
        {[...insights.themes]
          .sort((a, b) => b.mentions - a.mentions)
          .map((theme) => (
            <Pill key={theme.theme} tone={tone(theme.sentiment)} className="px-3 py-1 text-sm">
              {theme.theme} <span className="tabular opacity-70">{theme.mentions}</span>
            </Pill>
          ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {insights.praise.length ? (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-success"><Heart aria-hidden className="size-3.5" /> Customers love</p>
            <ul className="space-y-1 text-sm text-foreground">{insights.praise.map((item) => <li key={item}>• {item}</li>)}</ul>
          </div>
        ) : null}
        {insights.complaints.length ? (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-critical"><AlertCircle aria-hidden className="size-3.5" /> Room to improve</p>
            <ul className="space-y-1 text-sm text-foreground">{insights.complaints.map((item) => <li key={item}>• {item}</li>)}</ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function NeedsAttention({ data }: { data: ReputationData }) {
  const items = data.needs_attention ?? [];
  if (items.length === 0) return null;
  return (
    <Card title="Reviews worth a reply" icon={AlertCircle} explain={EXPLAIN.needsAttention}>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.slice(0, 6).map((item, index) => (
          <li key={index} className="rounded-xl border border-critical/20 bg-critical-surface/40 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <Stars rating={item.rating} />
              <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
            </div>
            {item.excerpt ? <p className="mt-2 line-clamp-4 text-foreground">“{item.excerpt}”</p> : null}
            {item.flags.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.flags.map((flag) => <Pill key={flag} tone="bad">{flag.replace(/_/g, " ")}</Pill>)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Replies({ data }: { data: ReputationData }) {
  const replies = data.replies_sent;
  if (!replies || replies.recent.length === 0) return null;
  return (
    <Card
      title="Replies sent for you"
      icon={MessageCircleReply}
      actions={<span className="text-xs text-muted-foreground">{replies.this_month} this month · {replies.last_90_days} in 90 days</span>}
    >
      <ul className="space-y-3">
        {replies.recent.slice(0, 4).map((item, index) => (
          <li key={index} className="rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <Stars rating={item.rating} />
              <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
            </div>
            {item.review ? <p className="mt-2 line-clamp-3 text-muted-foreground">“{item.review}”</p> : null}
            {item.reply ? (
              <p className="mt-2 rounded-lg border-l-2 border-primary bg-brand-tint px-3 py-2 text-foreground">{item.reply}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
