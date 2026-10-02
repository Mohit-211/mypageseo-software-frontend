import { useState } from "react";
import { formatMonth, formatShortDate } from "@/lib/datetime";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, Copy, ExternalLink, Globe, Phone } from "lucide-react";
import type { GbpProfile, GbpRange, GbpReport, PerformanceSection, PerformanceTotals, SearchKeywordsSection } from "@/api";
import { MetricCard, Panel, StatusBadge, TrendIndicator } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { GbpPageHeader, GbpReportError, SectionUnavailable } from "@/components/gbp/gbp-ui";
import { Button } from "@/components/ui/button";
import { attributeLabel, attributeValue, formatHours, formatPercentChange } from "@/lib/gbp/gbp-labels";
import { useGbpContext, useRangeParam } from "@/lib/gbp/gbp-context";
import { useGbpReport } from "@/lib/gbp/use-gbp-report";
import { formatRunDate } from "@/lib/rankings/format";
import { cn } from "@/lib/utils";

function formatPrice(price: { currency: string; amount: number }) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency }).format(price.amount);
  } catch {
    return `${price.amount} ${price.currency}`;
  }
}

const RANGE_LABEL: Record<GbpRange, string> = { "28d": "28 days", "90d": "90 days", "12m": "12 months" };

/** GBP Overview: how the profile performs on Google, what people search, and what the profile says. */
function LocationGbpOverviewPage() {
  const { location } = useGbpContext();
  const [range, setRange] = useRangeParam();
  const report = useGbpReport(location.location_id, range);

  return (
    <>
      <GbpPageHeader
        locationId={location.location_id}
        view="overview"
        title="GBP Overview"
        description="How the Google Business Profile performs on Google, what people search to find it, and what the profile shows."
        generatedAt={report.data?.generated_at}
        pending={report.data?.generation?.pending}
        gbpConnected={location.gbp_connected}
        actions={<RangeSwitch range={range} onChange={setRange} />}
      />
      {report.isPending ? (
        <PageSkeleton />
      ) : report.isError ? (
        <GbpReportError error={report.error} onRetry={() => void report.refetch()} gbpConnected={location.gbp_connected} />
      ) : (
        <OverviewContent report={report.data} range={range} />
      )}
    </>
  );
}

function RangeSwitch({ range, onChange }: { range: GbpRange; onChange: (range: GbpRange) => void }) {
  return (
    <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Period">
      {(Object.keys(RANGE_LABEL) as GbpRange[]).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={range === value}
          onClick={() => onChange(value)}
          className={cn("rounded px-2.5 py-1 text-xs font-medium", range === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {RANGE_LABEL[value]}
        </button>
      ))}
    </div>
  );
}

function OverviewContent({ report, range }: { report: GbpReport; range: GbpRange }) {
  return (
    <div className="space-y-6">
      {report.performance.available ? <Performance data={report.performance} range={range} /> : <Panel title="Profile performance"><SectionUnavailable section={report.performance} compact /></Panel>}
      {report.keywords.available ? <SearchTerms data={report.keywords} /> : <Panel title="What people searched"><SectionUnavailable section={report.keywords} compact /></Panel>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        {report.profile.available ? <ProfileDetails profile={report.profile} /> : <Panel title="Profile details"><SectionUnavailable section={report.profile} compact /></Panel>}
        <ProfileStatus report={report} />
      </div>
    </div>
  );
}

/* ----------------------------- Performance ----------------------------- */

function ChangeLine({ data, metric }: { data: PerformanceSection; metric: keyof PerformanceTotals }) {
  const previous = data.previous_period?.change[metric];
  const lastYear = data.same_period_last_year?.change[metric];
  const prev = formatPercentChange(previous);
  const year = formatPercentChange(lastYear);
  if (!prev && !year) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {prev && previous != null ? (
        <TrendIndicator direction={previous > 0 ? "up" : previous < 0 ? "down" : "flat"} value={`${prev.replace(/^[+−]/, "")} vs previous`} positive={previous > 0} />
      ) : null}
      {year ? <span className="text-xs text-muted-foreground">{year} vs last year</span> : null}
    </span>
  );
}

function Performance({ data, range }: { data: PerformanceSection; range: GbpRange }) {
  const t = data.totals;
  const extra: { key: keyof PerformanceTotals; label: string }[] = [
    { key: "conversations", label: "Messages" },
    { key: "bookings", label: "Bookings" },
    { key: "food_orders", label: "Food orders" },
    { key: "food_menu_clicks", label: "Menu clicks" },
  ];
  const shownExtra = extra.filter((entry) => (t[entry.key] ?? 0) > 0);
  const partialCoverage = data.coverage.days_with_data < data.coverage.days;

  return (
    <section aria-labelledby="gbp-performance" className="space-y-4">
      <div>
        <h2 id="gbp-performance" className="text-sm font-semibold text-foreground">Profile performance · last {RANGE_LABEL[range]}</h2>
        <p className="text-xs text-muted-foreground">
          {formatRunDate(data.start)} – {formatRunDate(data.end)} · Google's own numbers for this profile
          {partialCoverage ? ` · data for ${data.coverage.days_with_data} of ${data.coverage.days} days` : ""}
        </p>
      </div>
      <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-border">
        <MetricCard label="Profile views" value={t.impressions.toLocaleString()} trend={<ChangeLine data={data} metric="impressions" />} caption="Times the profile was shown on Google" />
        <MetricCard label="Calls" value={t.calls.toLocaleString()} trend={<ChangeLine data={data} metric="calls" />} caption="Call button taps" />
        <MetricCard label="Website clicks" value={t.website_clicks.toLocaleString()} trend={<ChangeLine data={data} metric="website_clicks" />} caption="Visits to the website" />
        <MetricCard label="Directions" value={t.direction_requests.toLocaleString()} trend={<ChangeLine data={data} metric="direction_requests" />} caption="Direction requests" />
        <MetricCard
          label="Actions per 1,000 views"
          value={data.actions_per_1000_impressions == null ? "—" : data.actions_per_1000_impressions.toFixed(1)}
          trend={<ChangeLine data={data} metric="actions" />}
          caption={`${t.actions.toLocaleString()} actions in total`}
        />
      </div>
      {shownExtra.length > 0 ? (
        <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
          {shownExtra.map((entry) => (
            <MetricCard key={entry.key} label={entry.label} value={(t[entry.key] ?? 0).toLocaleString()} trend={<ChangeLine data={data} metric={entry.key} />} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Profile views per day" description="Where the profile was seen: Google Maps or Google Search.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.by_day} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value: string) => formatShortDate(value)} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip labelFormatter={(value) => formatRunDate(String(value))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="maps" name="Maps" stackId="views" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.35} />
                <Area type="monotone" dataKey="search" name="Search" stackId="views" stroke="var(--color-chart-3)" fill="var(--color-chart-3)" fillOpacity={0.35} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Actions per day" description="Calls, website clicks and direction requests.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.by_day} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value: string) => formatShortDate(value)} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip labelFormatter={(value) => formatRunDate(String(value))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="calls" name="Calls" stroke="var(--color-chart-2)" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="website_clicks" name="Website" stroke="var(--color-chart-1)" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="direction_requests" name="Directions" stroke="var(--color-chart-5)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SplitBar title="Maps vs Search" parts={[{ label: "Google Maps", value: data.by_surface.maps, className: "bg-chart-1" }, { label: "Google Search", value: data.by_surface.search, className: "bg-chart-3" }]} />
        <SplitBar title="Mobile vs Desktop" parts={[{ label: "Mobile", value: data.by_device.mobile, className: "bg-chart-4" }, { label: "Desktop", value: data.by_device.desktop, className: "bg-chart-5" }]} />
      </div>
    </section>
  );
}

function SplitBar({ title, parts }: { title: string; parts: { label: string; value: number; className: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <Panel title={title}>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No views in this period.</p>
      ) : (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {parts.map((part) => (
              <div key={part.label} className={part.className} style={{ width: `${(part.value / total) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {parts.map((part) => (
              <li key={part.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2"><span aria-hidden className={cn("size-2.5 rounded-sm", part.className)} />{part.label}</span>
                <span className="tabular text-muted-foreground">{part.value.toLocaleString()} · {Math.round((part.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/* ----------------------------- Search terms ----------------------------- */

function SearchTerms({ data }: { data: SearchKeywordsSection }) {
  const monthLabel = formatMonth(data.latest_month, data.latest_month);
  return (
    <Panel
      title="What people searched to find the profile"
      description={`Google's search terms for ${monthLabel}, compared with the month before.`}
      actions={<TermWithTip term={<span className="sr-only">Search terms</span>}>Google reports small numbers as “fewer than N” to protect privacy. “Not tracked” terms aren't in your ranking keywords yet.</TermWithTip>}
    >
      {data.top.length === 0 ? (
        <p className="text-sm text-muted-foreground">No search terms reported for this month.</p>
      ) : (
        <div className="-m-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-border bg-surface-strong text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Search term</th>
                <th className="px-3 py-2.5 text-right font-medium">Searches</th>
                <th className="px-3 py-2.5 text-right font-medium">Change</th>
                <th className="px-3 py-2.5 font-medium">Rank tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.top.map((term) => (
                <tr key={term.keyword}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{term.keyword}</td>
                  <td className="px-3 py-2.5 text-right tabular">{term.value !== null ? term.value.toLocaleString() : term.threshold !== null ? `< ${term.threshold}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular text-muted-foreground">
                    {term.change === null ? "—" : `${term.change > 0 ? "+" : ""}${term.change.toLocaleString()}`}
                  </td>
                  <td className="px-3 py-2.5">{term.tracked ? <StatusBadge tone="success">Tracked</StatusBadge> : <span className="text-xs text-muted-foreground">Not tracked</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ----------------------------- Profile ----------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[150px_1fr]">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function ProfileDetails({ profile }: { profile: GbpProfile }) {
  const hours = formatHours(profile.regular_hours);
  const reviewLink = profile.new_review_uri;

  return (
    <Panel
      title="Profile details"
      description={profile.taken_at ? `As on Google, ${formatRunDate(profile.taken_at, true)}` : "As on Google"}
      actions={profile.maps_uri ? (
        <Button asChild variant="outline" size="sm">
          <a href={profile.maps_uri} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> View on Google Maps</a>
        </Button>
      ) : undefined}
    >
      <dl className="divide-y divide-border">
        <Field label="Name">{profile.title ?? "—"}</Field>
        <Field label="Categories">
          {profile.primary_category ? <span className="font-medium">{profile.primary_category}</span> : "—"}
          {profile.additional_categories.length > 0 ? <span className="text-muted-foreground"> · {profile.additional_categories.join(", ")}</span> : null}
        </Field>
        <Field label="Description">
          {profile.description ? (
            <>
              <span className="whitespace-pre-line">{profile.description}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{profile.description.length} characters</span>
            </>
          ) : (
            <span className="text-muted-foreground">No description</span>
          )}
        </Field>
        <Field label="Phone">
          {profile.primary_phone ? <span className="inline-flex items-center gap-1.5"><Phone aria-hidden className="size-3.5 text-muted-foreground" />{profile.primary_phone}</span> : "—"}
          {profile.additional_phones.length > 0 ? <span className="block text-xs text-muted-foreground">Also {profile.additional_phones.join(", ")}</span> : null}
        </Field>
        <Field label="Website">
          {profile.website ? (
            <a href={profile.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all text-primary hover:underline">
              <Globe aria-hidden className="size-3.5 shrink-0" />{profile.website}
            </a>
          ) : "—"}
        </Field>
        <Field label="Opening hours">
          {profile.regular_hours.length === 0 ? (
            <span className="text-muted-foreground">No hours set</span>
          ) : (
            <ul className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-0.5">
              {hours.map((entry) => (
                <li key={entry.day} className="contents"><span className="text-muted-foreground">{entry.day}</span><span>{entry.hours}</span></li>
              ))}
            </ul>
          )}
          {profile.special_hour_dates.length > 0 ? (
            <span className="mt-1 block text-xs text-muted-foreground">Special hours set for {profile.special_hour_dates.length} date{profile.special_hour_dates.length === 1 ? "" : "s"}</span>
          ) : null}
        </Field>
        {profile.service_area && (profile.service_area.place_count > 0 || profile.service_area.business_type) ? (
          <Field label="Service area">
            {profile.service_area.place_count > 0 ? `${profile.service_area.place_count} area${profile.service_area.place_count === 1 ? "" : "s"} served` : "—"}
            {profile.service_area.business_type ? <span className="block text-xs text-muted-foreground">{profile.service_area.business_type.replace(/_/g, " ").toLowerCase()}</span> : null}
          </Field>
        ) : null}
        <Field label="Services">
          {profile.service_items.length === 0 ? (
            <span className="text-muted-foreground">No services listed</span>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {profile.service_items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="rounded-md border border-border px-2 py-0.5 text-xs" title={item.description ?? undefined}>
                  {item.name ?? "Unnamed service"}
                  {item.price ? <span className="ml-1 text-muted-foreground">{formatPrice(item.price)}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="Attributes">
          {profile.attributes.length === 0 ? <span className="text-muted-foreground">None set</span> : <Attributes attributes={profile.attributes} />}
        </Field>
        {reviewLink ? (
          <Field label="Review link">
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-all text-xs text-muted-foreground">{reviewLink}</span>
              <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(reviewLink).then(() => toast.success("Review link copied"))}>
                <Copy aria-hidden /> Copy
              </Button>
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">Send this to customers to ask for a review.</span>
          </Field>
        ) : null}
      </dl>
    </Panel>
  );
}

/** One attribute's value: Google's labels (links for URL attributes), else a readable form of the raw values. */
function AttributeValue({ attribute }: { attribute: GbpProfile["attributes"][number] }) {
  const labels = attribute.value_labels;
  if (!labels || labels.length === 0) return <>{attributeValue(attribute.values)}</>;
  return (
    <>
      {labels.map((label, index) => (
        <span key={`${label}-${index}`}>
          {index > 0 ? ", " : null}
          {/^https?:\/\//i.test(label) ? (
            <a href={label} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{label}</a>
          ) : (
            label
          )}
        </span>
      ))}
    </>
  );
}

/** Attributes grouped as Google groups them (Accessibility, Payments…); ungrouped ones last. */
function Attributes({ attributes }: { attributes: GbpProfile["attributes"] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? attributes : attributes.slice(0, 10);
  const groups = new Map<string, typeof attributes>();
  for (const attribute of visible) {
    const group = attribute.group ?? "Other";
    groups.set(group, [...(groups.get(group) ?? []), attribute]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));
  // A yes/no attribute's label is already a sentence ("Has wheelchair accessible entrance"), so it stands alone.
  const sentence = (attribute: GbpProfile["attributes"][number]) => attribute.value_type === "BOOL" && Boolean(attribute.value_labels?.length);

  return (
    <div className="space-y-3">
      {ordered.map(([group, items]) => (
        <div key={group}>
          {ordered.length > 1 || group !== "Other" ? <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p> : null}
          <ul className="space-y-0.5">
            {items.map((attribute) => (
              <li key={attribute.name} className="flex justify-between gap-3">
                {sentence(attribute) ? (
                  <span><AttributeValue attribute={attribute} /></span>
                ) : (
                  <>
                    <span>{attribute.display_name ?? attributeLabel(attribute.name)}</span>
                    <span className="min-w-0 text-right text-muted-foreground"><AttributeValue attribute={attribute} /></span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {attributes.length > 10 ? (
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setShowAll((open) => !open)}>
          {showAll ? "Show fewer" : `Show all ${attributes.length}`}
        </button>
      ) : null}
    </div>
  );
}

/** Google's verification states in plain words. */
const VERIFICATION_STATE_LABEL: Record<string, string> = {
  verified: "Verified",
  verification_required: "Verification needed",
  verification_pending: "Verification pending",
  waiting_for_voice_of_merchant: "Waiting for Google",
  ownership_conflict: "Ownership conflict",
  comply_with_guidelines: "Action needed",
};

function ProfileStatus({ report }: { report: GbpReport }) {
  const verification = report.verification;
  const edits = report.pending_google_edits;
  const sync = report.sync;
  const openStatus = report.profile.available ? report.profile.open_status : null;
  return (
    <div className="space-y-6">
      <Panel title="Profile status">
        <dl className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Verification</dt>
              <dd className="text-right">
                {verification.available ? (
                  <StatusBadge tone={verification.verified ? "success" : verification.state === "verification_pending" ? "warning" : "critical"}>
                    {verification.verified ? <BadgeCheck aria-hidden className="size-3" /> : null}
                    {VERIFICATION_STATE_LABEL[verification.state ?? ""] ?? (verification.verified ? "Verified" : "Not verified")}
                  </StatusBadge>
                ) : (
                  <span className="text-muted-foreground">Unknown</span>
                )}
              </dd>
            </div>
            {verification.available ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                {verification.verified && verification.verified_at ? (
                  <p>
                    Verified {formatRunDate(verification.verified_at)}
                    {verification.latest?.method ? ` by ${verification.latest.method.replace(/_/g, " ").toLowerCase()}` : ""}
                  </p>
                ) : null}
                {verification.guidance ? <p className="text-warning-foreground">Google says: {verification.guidance}</p> : null}
                {!verification.verified && verification.latest?.state ? (
                  <p>
                    Latest attempt: {verification.latest.state.replace(/_/g, " ").toLowerCase()}
                    {verification.latest.create_time ? ` (${formatRunDate(verification.latest.create_time)})` : ""}
                  </p>
                ) : null}
                {verification.stale ? (
                  <p className="text-warning-foreground">
                    Couldn't refresh this with Google{verification.checked_at ? `; last checked ${formatRunDate(verification.checked_at, true)}` : ""}.
                    {verification.error ? ` ${verification.error}` : ""}
                  </p>
                ) : null}
              </div>
            ) : "message" in verification && verification.message ? (
              <p className="text-xs text-muted-foreground">{verification.message}</p>
            ) : null}
          </div>
          {openStatus ? (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Business status</dt>
              <dd className="text-right">{openStatus === "OPEN" ? <StatusBadge tone="success">Open</StatusBadge> : <StatusBadge tone="warning">{openStatus.replace(/_/g, " ").toLowerCase()}</StatusBadge>}</dd>
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">
              <TermWithTip term="Edits suggested by Google">Google sometimes changes a profile based on user suggestions. Review them on Google so the profile shows what you want.</TermWithTip>
            </dt>
            <dd className="text-right">
              {edits.available ? (
                edits.has_pending ? (
                  <span>
                    <StatusBadge tone="warning">Pending</StatusBadge>
                    {edits.pending_fields.length > 0 ? <span className="mt-1 block text-xs text-muted-foreground">{edits.pending_fields.map((field) => field.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}</span> : null}
                  </span>
                ) : (
                  <StatusBadge tone="success">None</StatusBadge>
                )
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Google data" description="When each part was last fetched from Google.">
        {"types" in sync ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Last synced {sync.last_synced_at ? formatRunDate(sync.last_synced_at, true) : "never"}</p>
            <ul className="space-y-1">
              {Object.entries(sync.types).map(([type, entry]) => (
                <li key={type} className="flex items-start justify-between gap-3">
                  <span className="capitalize">{type.replace(/_/g, " ")}</span>
                  <span className="text-right">
                    <StatusBadge tone={entry.status === "ok" ? "success" : entry.status === "not_available" ? "neutral" : "warning"}>{entry.status.replace(/_/g, " ")}</StatusBadge>
                    {entry.message ? <span className="mt-0.5 block max-w-48 text-xs text-muted-foreground">{entry.message}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <SectionUnavailable section={sync} compact />
        )}
      </Panel>
    </div>
  );
}

export default LocationGbpOverviewPage;
