import { Check, Images, Lightbulb, MessageSquareQuote, Minus, Scale, Star, Trophy } from "lucide-react";
import type { CompetitorRow, CompetitorsSection } from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { TableBody, TableHead, TableRow, TableScroll, Th, tdClass, tdNumberClass } from "@/components/layout/shared/data-table";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { FixButton } from "@/components/gbp/gbp-ui";
import { TrackCompetitorButton } from "@/components/ranking/track-competitor-button";
import { formatRunDate } from "@/lib/rankings/format";
import { insightFix, type FixContext } from "@/lib/gbp/gbp-labels";
import { byNumber, byText, sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  self: "You",
  tracking: "Your competitor",
  area: "Top in your area",
  map_list: "Nearby business",
};

const SOURCE_TIP: Record<string, string> = {
  area: "Among the businesses ranking highest across your whole grid in the latest ranking check",
  map_list: "Near the top of Google's list at your address (from older ranking checks)",
};

const NUMBER = new Intl.NumberFormat();

/** Best public score first, businesses without a score last; "You" stays in its place. */
function rankedRows(section: CompetitorsSection): CompetitorRow[] {
  return sortRows(
    section.rows,
    byNumber((row) => row.public_score?.score, "desc"),
    byText((row) => row.name),
  );
}

function photos(row: CompetitorRow): string {
  if (row.photo_count == null) return "—";
  return row.photos_capped ? "10+" : String(row.photo_count);
}

function average(values: (number | null | undefined)[]): number | null {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
}

/* -------------------------------------------------------------------------- */
/* Headline numbers                                                            */
/* -------------------------------------------------------------------------- */

/** Where you stand: your public score and rank, rating, reviews and photos against the others. */
export function ComparisonKpis({ section }: { section: CompetitorsSection }) {
  const rows = rankedRows(section);
  const self = rows.find((row) => row.is_self) ?? null;
  const others = rows.filter((row) => !row.is_self);
  if (!self) return null;

  const scored = rows.filter((row) => row.public_score);
  const position = scored.findIndex((row) => row.is_self) + 1;
  const leader = others.find((row) => row.public_score) ?? null;
  const mostReviews = others.reduce<CompetitorRow | null>((best, row) => ((row.user_rating_count ?? -1) > (best?.user_rating_count ?? -1) ? row : best), null);
  const avgRating = average(others.map((row) => row.rating));
  const avgPhotos = average(others.map((row) => row.photo_count));

  return (
    <section aria-label="How you compare" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <KpiTile
        label="Your public score"
        icon={Trophy}
        tone="gbp"
        value={self.public_score ? self.public_score.score : "—"}
        hint={
          <>
            {position > 0 ? (
              <span className="block font-medium text-foreground">
                {position === 1 ? "Top of" : `#${position} of`} {scored.length} businesses
              </span>
            ) : null}
            {leader && position !== 1 ? (
              <span className="block truncate">
                Leader: {leader.name ?? "Unnamed"} ({leader.public_score?.score})
              </span>
            ) : null}
          </>
        }
      />
      <KpiTile
        label="Your rating"
        icon={Star}
        tone="reputation"
        value={self.rating != null ? self.rating.toFixed(1) : "—"}
        hint={avgRating != null ? `Others average ${avgRating.toFixed(1)}` : undefined}
      />
      <KpiTile
        label="Your reviews"
        icon={MessageSquareQuote}
        tone="reputation"
        value={self.user_rating_count != null ? NUMBER.format(self.user_rating_count) : "—"}
        hint={
          mostReviews?.user_rating_count != null ? (
            <span className="block truncate">
              Most nearby: {NUMBER.format(mostReviews.user_rating_count)} ({mostReviews.name ?? "Unnamed"})
            </span>
          ) : undefined
        }
      />
      <KpiTile
        label="Your photos"
        icon={Images}
        tone="gbp"
        value={photos(self)}
        hint={
          avgPhotos != null
            ? // Google returns at most 10 photo references, so a capped average is a floor.
              `Others average ${Math.round(avgPhotos)}${others.some((row) => row.photos_capped) ? " or more" : ""}`
            : undefined
        }
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Side by side                                                                */
/* -------------------------------------------------------------------------- */

function Present({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  return value ? <Check aria-label="Yes" className="mx-auto size-4 text-success" /> : <Minus aria-label="No" className="mx-auto size-4 text-muted-foreground" />;
}

function ScoreBar({ row, max }: { row: CompetitorRow; max: number }) {
  const score = row.public_score?.score ?? null;
  return (
    <span className="inline-flex items-center justify-end gap-2.5">
      <span className="text-base font-semibold tabular-nums text-foreground">{score ?? "—"}</span>
      <span aria-hidden className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted sm:block">
        {score !== null ? (
          <span className={cn("block h-full rounded-full", row.is_self ? "bg-chart-1" : "bg-muted-foreground")} style={{ width: `${(score / Math.max(max, 1)) * 100}%` }} />
        ) : null}
      </span>
    </span>
  );
}

function BusinessCell({ row, locationId }: { row: CompetitorRow; locationId: string }) {
  const closed = row.public_score?.flag;
  return (
    <div className="min-w-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{row.name ?? "Unnamed business"}</span>
        {row.is_self ? (
          <StatusBadge tone="brand" size="sm">
            You
          </StatusBadge>
        ) : null}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {row.is_self ? null : <span title={SOURCE_TIP[row.source]}>{SOURCE_LABEL[row.source] ?? row.source}</span>}
        {row.source === "area" || row.source === "map_list" ? <TrackCompetitorButton locationId={locationId} placeId={row.place_id} name={row.name} /> : null}
        {closed ? (
          <StatusBadge tone="critical" size="sm">
            {closed === "closed_permanently" ? "Closed" : "Temporarily closed"}
          </StatusBadge>
        ) : null}
        {row.stale ? (
          <StatusBadge tone="warning" size="sm">
            Details may be outdated
          </StatusBadge>
        ) : null}
      </span>
    </div>
  );
}

function RatingValue({ row }: { row: CompetitorRow }) {
  if (row.rating == null) return <>—</>;
  return (
    <span className="inline-flex items-center gap-1">
      <Star aria-hidden className="size-3.5 fill-warning-bright text-warning" />
      {row.rating.toFixed(1)}
    </span>
  );
}

/**
 * Every business in a table, ranked by public score with you highlighted in place; cards on phones.
 * `attribution` (the report's Google Maps credit) is shown under the names and ratings it covers.
 */
export function ComparisonTable({ section, locationId, attribution }: { section: CompetitorsSection; locationId: string; attribution?: string | null | undefined }) {
  const rows = rankedRows(section);
  const max = Math.max(...rows.map((row) => row.public_score?.score ?? 0), 0);
  // Scored rows come first, so a row's place in the list is its rank.
  const ranked = rows.map((row, index) => ({ row, rank: row.public_score ? index + 1 : null }));

  return (
    <Panel
      title="Side by side"
      description={`Public details from Google, updated ${formatRunDate(section.generated_at)}. Ranked by public score.`}
      icon={Scale}
      tone="gbp"
      actions={
        <TermWithTip term={<span className="text-sm font-medium text-muted-foreground">What's the public score?</span>}>
          Public score (0–100) uses only what anyone can see on Google, the same way for every business: rating (25), number of reviews (20) and five profile details (category,
          hours, website, phone, editorial summary; 5 each), scaled to 100.
        </TermWithTip>
      }
    >
      {/* One bleed wrapper for the table, the phone list and the credit, so nothing overlaps. */}
      <div className="-m-4">
        <div className="hidden md:block">
          <TableScroll minWidth={900} label="Businesses compared">
            <TableHead>
              <Th className="w-12 text-center">#</Th>
              <Th>Business</Th>
              <Th align="right">Public score</Th>
              <Th align="right">Rating</Th>
              <Th align="right">Reviews</Th>
              <Th>Category</Th>
              <Th className="text-center">Hours</Th>
              <Th className="text-center">Website</Th>
              <Th className="text-center">Phone</Th>
              <Th align="right">
                <TermWithTip term="Photos">Google returns up to 10 photo references, so 10 shows as "10+".</TermWithTip>
              </Th>
            </TableHead>
            <TableBody>
              {ranked.map(({ row, rank: position }) => (
                <TableRow key={row.place_id} selected={row.is_self} className={row.is_self ? "shadow-[inset_3px_0_0_var(--color-primary)]" : undefined}>
                  <td className={cn(tdClass, "text-center font-semibold tabular-nums text-muted-foreground")}>{position ?? "—"}</td>
                  <td className={tdClass}>
                    <BusinessCell row={row} locationId={locationId} />
                  </td>
                  <td className={tdNumberClass}>
                    <ScoreBar row={row} max={max} />
                  </td>
                  <td className={tdNumberClass}>
                    <RatingValue row={row} />
                  </td>
                  <td className={tdNumberClass}>{row.user_rating_count != null ? NUMBER.format(row.user_rating_count) : "—"}</td>
                  <td className={cn(tdClass, "text-muted-foreground")}>{row.primary_type_label ?? "—"}</td>
                  <td className={cn(tdClass, "text-center")}>
                    <Present value={row.fetched_at ? row.has_hours : null} />
                  </td>
                  <td className={cn(tdClass, "text-center")}>
                    <Present value={row.fetched_at ? row.has_website : null} />
                  </td>
                  <td className={cn(tdClass, "text-center")}>
                    <Present value={row.fetched_at ? row.has_phone : null} />
                  </td>
                  <td className={tdNumberClass}>{photos(row)}</td>
                </TableRow>
              ))}
            </TableBody>
          </TableScroll>
        </div>

        <ol className="divide-y divide-border md:hidden">
          {ranked.map(({ row, rank: position }) => (
            <li key={row.place_id} className={cn("px-4 py-3.5", row.is_self && "bg-brand-tint shadow-[inset_3px_0_0_var(--color-primary)]")}>
              <div className="flex items-start gap-3">
                <span className="w-6 shrink-0 pt-0.5 text-center text-sm font-semibold tabular-nums text-muted-foreground">{position ?? "—"}</span>
                <div className="min-w-0 flex-1">
                  <BusinessCell row={row} locationId={locationId} />
                  <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Score</dt>
                      <dd className="text-sm font-semibold tabular-nums text-foreground">{row.public_score?.score ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Rating</dt>
                      <dd className="text-sm tabular-nums text-foreground">
                        <RatingValue row={row} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Reviews</dt>
                      <dd className="text-sm tabular-nums text-foreground">{row.user_rating_count != null ? NUMBER.format(row.user_rating_count) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Photos</dt>
                      <dd className="text-sm tabular-nums text-foreground">{photos(row)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {attribution ? <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Business names, ratings and reviews: {attribution}</p> : null}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* What stands out                                                             */
/* -------------------------------------------------------------------------- */

/** Gaps against the others, most important first, each with the step that closes it. */
export function Insights({ section, ctx }: { section: CompetitorsSection; ctx: FixContext }) {
  const insights = [...section.insights].sort((a, b) => b.impact - a.impact || a.message.localeCompare(b.message));
  return (
    <Panel title="What stands out" description="Gaps against the businesses above, most important first." icon={Lightbulb} tone="gbp">
      {insights.length === 0 ? (
        <EmptyState
          variant="all-done"
          compact
          title="No notable gaps"
          description="You're level with or ahead of the businesses above on what Google shows. Keep the reviews and photos coming."
          className="border-0"
        />
      ) : (
        <ul className="-m-4 divide-y divide-border">
          {insights.map((insight) => {
            const fix = insightFix(insight.id, ctx);
            return (
              <li key={`${insight.id}-${insight.place_id ?? ""}`} className="flex flex-wrap items-start gap-3 px-4 py-3.5">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning-surface text-warning ring-1 ring-inset ring-warning/25">
                  <Lightbulb className="size-4" />
                </span>
                <p className="min-w-0 flex-[1_1_14rem] pt-1 text-sm text-foreground">{insight.message}</p>
                {fix ? <FixButton fix={fix} className="ml-11 sm:ml-0" /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* What customers say                                                          */
/* -------------------------------------------------------------------------- */

/** Up to two recent Google reviews per business; `attribution` credits Google Maps under them. */
export function RecentReviews({ rows, attribution }: { rows: CompetitorRow[]; attribution?: string | null | undefined }) {
  const withReviews = rows.filter((row) => row.reviews.length > 0);
  return (
    <Panel title="What customers say" description="Recent Google reviews of each business (up to two each)." icon={MessageSquareQuote} tone="reputation">
      {withReviews.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Google didn't return any reviews for these businesses.</p>
      ) : (
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {withReviews.map((row) => (
            <section key={row.place_id} aria-label={row.name ?? "Unnamed business"} className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {row.name ?? "Unnamed business"}
                {row.is_self ? (
                  <StatusBadge tone="brand" size="sm">
                    You
                  </StatusBadge>
                ) : null}
              </h3>
              <ul className="mt-2 space-y-2">
                {row.reviews.slice(0, 2).map((review, index) => (
                  <li key={index} className="rounded-lg border border-border bg-surface-strong p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {review.rating != null ? (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                          <Star aria-hidden className="size-3.5 fill-warning-bright text-warning" />
                          {review.rating}
                          <span className="sr-only"> stars</span>
                        </span>
                      ) : null}
                      {review.author?.name ? (
                        review.author.uri ? (
                          <a href={review.author.uri} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">
                            {review.author.name}
                          </a>
                        ) : (
                          <span className="font-medium text-foreground">{review.author.name}</span>
                        )
                      ) : null}
                      {review.relative_time ? <span>{review.relative_time}</span> : null}
                    </p>
                    {review.text ? <p className="mt-1.5 line-clamp-4 leading-6 text-foreground">{review.text}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {attribution ? <p className="-mx-4 -mb-4 mt-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">Reviews from {attribution}</p> : null}
    </Panel>
  );
}
