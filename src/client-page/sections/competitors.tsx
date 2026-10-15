import { Check, Lightbulb, MessageSquareQuote, Minus, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPLAIN } from "../copy";
import { formatNumber } from "../format";
import type { CompetitorData } from "../types";
import { Bar, Card, Pill, Stars } from "../ui";

export function CompetitorsSection({ data }: { data: CompetitorData }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Scores data={data} />
        <Insights data={data} />
      </div>
      <Comparison data={data} />
      <Reviews data={data} />
    </div>
  );
}

function Scores({ data }: { data: CompetitorData }) {
  const scores = [...(data.public_scores ?? [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  if (scores.length === 0) return null;
  const place = scores.findIndex((entry) => entry.is_self) + 1;
  return (
    <Card title="Listing strength" icon={Trophy} explain={EXPLAIN.competitorScore}>
      {place > 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          You are <span className="font-semibold text-foreground">#{place} of {scores.length}</span> nearby businesses.
        </p>
      ) : null}
      <div className="space-y-2.5">
        {scores.map((entry) => (
          <Bar
            key={entry.name}
            label={entry.is_self ? `${entry.name} (you)` : entry.name}
            value={entry.score ?? 0}
            max={100}
            display={entry.score === null ? "—" : Math.round(entry.score)}
            color={entry.is_self ? "var(--primary)" : "color-mix(in oklch, var(--muted-foreground) 55%, white)"}
            highlight={entry.is_self}
          />
        ))}
      </div>
    </Card>
  );
}

function Insights({ data }: { data: CompetitorData }) {
  if (!data.insights?.length) return null;
  return (
    <Card title="What stands out" icon={Lightbulb}>
      <ul className="space-y-2.5">
        {data.insights.map((insight) => (
          <li key={insight} className="flex gap-3 rounded-xl border border-border bg-surface p-3 text-sm text-foreground">
            <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            {insight}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const Yes = ({ on }: { on: boolean }) =>
  on ? <Check aria-label="Yes" className="mx-auto size-4 text-success" /> : <Minus aria-label="No" className="mx-auto size-4 text-muted-foreground" />;

function Comparison({ data }: { data: CompetitorData }) {
  if (!data.table?.length) return null;
  return (
    <Card title="Side by side" icon={Users} bodyClassName="px-0 pb-2">
      <div className="data-grid-scroll">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-5 py-2 font-medium">Business</th>
              <th className="px-3 py-2 font-medium">Rating</th>
              <th className="px-3 py-2 text-right font-medium">Reviews</th>
              <th className="px-3 py-2 text-right font-medium">Photos</th>
              <th className="px-3 py-2 text-center font-medium">Hours</th>
              <th className="px-3 py-2 text-center font-medium">Website</th>
              <th className="px-5 py-2 text-center font-medium">Phone</th>
            </tr>
          </thead>
          <tbody>
            {data.table.map((row) => (
              <tr key={row.name} className={cn("border-t border-border/70", row.is_self ? "bg-brand-tint/70 font-medium" : "hover:bg-brand-tint/40")}>
                <td className="px-5 py-2.5">
                  <span className="text-foreground">{row.name}</span>
                  {row.is_self ? <Pill tone="brand" className="ml-2">You</Pill> : null}
                  {row.category ? <span className="block text-xs font-normal text-muted-foreground">{row.category}</span> : null}
                </td>
                <td className="px-3 py-2.5">
                  {row.rating !== null ? (
                    <span className="inline-flex items-center gap-1.5 tabular">
                      {row.rating.toFixed(1)} <Stars rating={row.rating} />
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular">{formatNumber(row.reviews)}</td>
                <td className="px-3 py-2.5 text-right tabular">{row.photos === null || row.photos === undefined ? "—" : `${row.photos}${row.photos_capped ? "+" : ""}`}</td>
                <td className="px-3 py-2.5"><Yes on={row.has_hours} /></td>
                <td className="px-3 py-2.5"><Yes on={row.has_website} /></td>
                <td className="px-5 py-2.5"><Yes on={row.has_phone} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Reviews({ data }: { data: CompetitorData }) {
  const groups = (data.reviews ?? []).filter((group) => group.items.length > 0);
  if (groups.length === 0) return null;
  return (
    <Card title="Recent reviews around you" icon={MessageSquareQuote}>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.name} className={cn("rounded-xl border p-4", group.is_self ? "border-primary/30 bg-brand-tint/50" : "border-border bg-surface")}>
            <p className="mb-2 text-sm font-semibold text-foreground">
              {group.name} {group.is_self ? <Pill tone="brand">You</Pill> : null}
            </p>
            <ul className="space-y-3">
              {group.items.map((item, index) => (
                <li key={index} className="text-sm">
                  <Stars rating={item.rating} />
                  {item.text ? <p className="mt-1 line-clamp-4 text-foreground">“{item.text}”</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.author_uri && item.author ? (
                      <a href={item.author_uri} target="_blank" rel="nofollow noopener noreferrer" className="hover:underline">{item.author}</a>
                    ) : (
                      item.author ?? "A Google user"
                    )}
                    {item.when ? ` · ${item.when}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
