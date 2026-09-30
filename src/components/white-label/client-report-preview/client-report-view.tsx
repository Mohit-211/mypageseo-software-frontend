import type { ReactNode } from "react";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Download,
  Eye,
  Globe,
  Mail,
  MapPin,
  MessageSquareText,
  MousePointerClick,
  Navigation,
  Phone,
  Search,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { AgencyClient, ReportModule, ReportPreviewData, ReportTheme } from "@/lib/white-label/white-label";
import { cn } from "@/lib/utils";
import { brandedButton, themeStyle } from "../white-label-theme";
import { AgencyMark } from "../white-label-ui";

/**
 * The client-facing report, rendered entirely in agency branding.
 *
 * It never renders MyPageSEO assets; the only platform mention is the optional
 * "Powered by" credit, which the agency hides with the white-label toggle.
 * Layout uses container queries so it responds to its frame (device previews)
 * rather than the browser viewport.
 */
export function ClientReportView({
  theme,
  client,
  data,
  modules,
  allowDownload = true,
}: {
  theme: ReportTheme;
  client: AgencyClient;
  data: ReportPreviewData;
  modules: ReportModule[];
  allowDownload?: boolean;
}) {
  const has = (module: ReportModule) => modules.includes(module);
  const period = format(new Date(data.periodStart), "MMMM yyyy");

  const kpis: KpiProps[] = [];
  if (has("reviews")) kpis.push({ icon: Star, label: "Reviews", value: <>{data.rating.toFixed(1)} <Star className="inline size-5 -translate-y-0.5 fill-amber-400 text-amber-400" aria-label="stars" /></>, detail: `${data.totalReviews.toLocaleString()} total reviews` });
  if (has("ai_visibility")) kpis.push({ icon: Sparkles, label: "AI Score", value: data.aiScore, detail: "out of 100", change: data.aiScoreChange, suffix: " pts" });
  if (has("gbp") || has("posts")) kpis.push({ icon: MessageSquareText, label: "GBP Posts", value: data.postsPublished, detail: "published this month" });
  if (has("gbp")) kpis.push({ icon: Eye, label: "Profile Views", value: data.gbp.views.toLocaleString(), change: data.gbp.viewsChange, suffix: "%" });
  if (has("seo") && kpis.length < 4) kpis.push({ icon: Search, label: "Top 3 Keywords", value: data.seo.top3Keywords, detail: `of ${data.seo.trackedKeywords} tracked` });

  return (
    <div style={themeStyle(theme)} className="@container min-h-full bg-slate-50 text-slate-900 antialiased">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 @2xl:px-8">
          <AgencyMark theme={theme} showName />
          {theme.contactEmail ? (
            <a href={`mailto:${theme.contactEmail}`} className={cn(brandedButton.primary, "hidden @lg:inline-flex")} onClick={(e) => e.preventDefault()}>
              <Mail className="size-4" aria-hidden /> Contact us
            </a>
          ) : null}
        </div>
        <div aria-hidden className="h-1 bg-(--wl-primary)" />
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 @2xl:space-y-6 @2xl:px-8 @2xl:py-8">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 p-5 @2xl:flex-row @2xl:items-end @2xl:justify-between @2xl:p-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-(--wl-accent)">Client Report</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 @2xl:text-3xl">{client.name}</h1>
              <p className="mt-1 text-sm text-slate-600">Monthly Marketing Report · {period}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="size-3.5" aria-hidden /> {client.category}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {client.city}
                </span>
              </p>
            </div>
            {allowDownload ? (
              <button type="button" className={cn(brandedButton.secondary, "self-start @2xl:self-auto")}>
                <Download className="size-4" aria-hidden /> Download PDF
              </button>
            ) : null}
          </div>
          <div className="border-t border-slate-100 bg-(--wl-secondary) px-5 py-2.5 text-xs text-(--wl-secondary-fg) @2xl:px-6">
            Prepared by <span className="font-semibold">{theme.agencyName}</span>
          </div>
        </section>

        {kpis.length ? (
          <div className={cn("grid gap-3 @md:grid-cols-2", kpis.length >= 3 && "@3xl:grid-cols-3", kpis.length >= 4 && "@4xl:grid-cols-4")}>
            {kpis.map((kpi) => (
              <Kpi key={kpi.label} {...kpi} />
            ))}
          </div>
        ) : null}

        <div className="grid gap-5 @3xl:grid-cols-2 @2xl:gap-6">
          {has("gbp") ? <GbpSection data={data} /> : null}
          {has("ai_visibility") ? <AiSection data={data} /> : null}
          {has("reviews") ? <ReviewsSection data={data} /> : null}
          {has("posts") ? <PostsSection data={data} /> : null}
          {has("seo") ? <SeoSection data={data} /> : null}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-5 text-xs text-slate-500 @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <AgencyMark theme={theme} className="[&_img]:h-6 [&>span:first-child]:size-6 [&>span:first-child]:text-[10px]" />
            <span className="truncate">
              © {new Date(data.periodStart).getFullYear()} {theme.footerText || theme.agencyName}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {theme.contactEmail ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3.5" aria-hidden /> {theme.contactEmail}
              </span>
            ) : null}
            {theme.website ? (
              <span className="inline-flex items-center gap-1 font-medium text-(--wl-accent)">
                <Globe className="size-3.5" aria-hidden /> {theme.website.replace(/^https?:\/\//, "")}
              </span>
            ) : null}
            {theme.showPlatformCredit ? <span className="text-slate-400">Powered by MyPageSEO</span> : null}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type KpiProps = { icon: LucideIcon; label: string; value: ReactNode; detail?: string; change?: number; suffix?: string };

function Kpi({ icon: Icon, label, value, detail, change, suffix = "%" }: KpiProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-(--wl-radius) bg-(--wl-secondary) text-(--wl-primary)">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
        {change !== undefined ? <Change value={change} suffix={suffix} /> : null}
        {detail ?? (change !== undefined ? "vs last month" : null)}
      </p>
    </div>
  );
}

function Change({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", up ? "text-emerald-600" : "text-rose-600")}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

function ReportSection({ title, description, children, wide }: { title: string; description: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-slate-200 bg-white", wide && "@3xl:col-span-2")}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span aria-hidden className="h-4 w-1 rounded-full bg-(--wl-primary)" />
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, change }: { icon: LucideIcon; label: string; value: number; change?: number }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="size-3.5 text-(--wl-accent)" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value.toLocaleString()}</p>
      {change !== undefined ? (
        <p className="text-xs">
          <Change value={change} />
        </p>
      ) : null}
    </div>
  );
}

function GbpSection({ data }: { data: ReportPreviewData }) {
  const max = Math.max(...data.monthlyViews.map((m) => m.views));
  return (
    <ReportSection title="Google Business Profile" description="How customers found and contacted the business on Google." wide>
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        <Stat icon={Eye} label="Profile views" value={data.gbp.views} change={data.gbp.viewsChange} />
        <Stat icon={Phone} label="Calls" value={data.gbp.calls} change={data.gbp.callsChange} />
        <Stat icon={Navigation} label="Directions" value={data.gbp.directions} change={data.gbp.directionsChange} />
        <Stat icon={MousePointerClick} label="Website clicks" value={data.gbp.websiteClicks} change={data.gbp.websiteClicksChange} />
      </div>
      <div className="mt-5">
        <p className="text-xs font-medium text-slate-600">Profile views · last 6 months</p>
        <div className="mt-3 flex h-36 items-end gap-2 @2xl:gap-4" role="img" aria-label={`Profile views over the last six months, peaking at ${max.toLocaleString()}.`}>
          {data.monthlyViews.map((m, i) => (
            <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[10px] tabular-nums text-slate-500">{(m.views / 1000).toFixed(1)}k</span>
              <div
                className={cn("w-full max-w-12 rounded-t-[4px] bg-(--wl-primary)", i < data.monthlyViews.length - 1 && "opacity-45")}
                style={{ height: `${Math.max(8, (m.views / max) * 100)}%` }}
              />
              <span className="text-[10px] text-slate-500">{format(new Date(m.month), "MMM")}</span>
            </div>
          ))}
        </div>
      </div>
    </ReportSection>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-(--wl-accent)" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function AiSection({ data }: { data: ReportPreviewData }) {
  return (
    <ReportSection title="AI Visibility" description="How often AI assistants recommend the business.">
      <div className="flex items-center gap-4">
        <div
          className="relative flex size-20 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(var(--wl-primary) ${data.aiScore * 3.6}deg, #E2E8F0 0deg)` }}
        >
          <span className="flex size-15 flex-col items-center justify-center rounded-full bg-white">
            <span className="text-xl font-semibold tabular-nums text-slate-900">{data.aiScore}</span>
            <span className="text-[10px] text-slate-500">/ 100</span>
          </span>
        </div>
        <div className="min-w-0 text-sm text-slate-600">
          <p>
            Mentioned in <span className="font-semibold text-slate-900">{data.aiMentions}</span> AI answers this month.
          </p>
          <p className="mt-1 text-xs">
            <Change value={data.aiScoreChange} suffix=" pts" /> vs last month
          </p>
        </div>
      </div>
      <ul className="mt-5 space-y-3">
        {data.aiPlatforms.map((p) => (
          <li key={p.platform}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-slate-700">{p.platform}</span>
              <span className="tabular-nums text-slate-500">{p.visibility}%</span>
            </div>
            <Meter value={p.visibility} />
          </li>
        ))}
      </ul>
    </ReportSection>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("size-3.5", i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-300")} aria-hidden />
      ))}
    </span>
  );
}

function ReviewsSection({ data }: { data: ReportPreviewData }) {
  const max = Math.max(...data.ratingDistribution.map((d) => d.count));
  return (
    <ReportSection title="Review Performance" description="Ratings, new reviews and response activity.">
      <div className="flex flex-col gap-5 @md:flex-row">
        <div className="shrink-0">
          <p className="text-4xl font-semibold tabular-nums text-slate-900">{data.rating.toFixed(1)}</p>
          <Stars rating={data.rating} />
          <p className="mt-1 text-xs text-slate-500">{data.totalReviews.toLocaleString()} reviews</p>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {data.ratingDistribution.map((d) => (
            <li key={d.stars} className="flex items-center gap-2 text-xs">
              <span className="w-3 text-slate-600">{d.stars}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${(d.count / max) * 100}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums text-slate-500">{d.count}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat icon={MessageSquareText} label="New reviews" value={data.newReviews} />
        <div className="min-w-0 rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Response rate</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{data.responseRate}%</p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {data.recentReviews.map((r) => (
          <li key={r.id} className="rounded-lg border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-800">{r.author}</span>
              <Stars rating={r.rating} />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">“{r.text}”</p>
          </li>
        ))}
      </ul>
    </ReportSection>
  );
}

function PostsSection({ data }: { data: ReportPreviewData }) {
  return (
    <ReportSection title="Post Performance" description="Google Business Profile posts published this month.">
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={MessageSquareText} label="Posts" value={data.postsPublished} />
        <Stat icon={Eye} label="Views" value={data.postViews} />
        <Stat icon={MousePointerClick} label="Clicks" value={data.postClicks} />
      </div>
      <ul className="mt-4 divide-y divide-slate-100">
        {data.topPosts.map((post) => (
          <li key={post.id} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{post.title}</p>
              <p className="text-xs text-slate-500">{format(new Date(post.publishedAt), "MMM d")}</p>
            </div>
            <p className="shrink-0 text-right text-xs tabular-nums text-slate-500">
              <span className="font-medium text-slate-800">{post.views.toLocaleString()}</span> views
              <br />
              {post.clicks} clicks
            </p>
          </li>
        ))}
      </ul>
    </ReportSection>
  );
}

function SeoSection({ data }: { data: ReportPreviewData }) {
  return (
    <ReportSection title="SEO Performance" description="Local keyword rankings on Google.">
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={Search} label="Keywords" value={data.seo.trackedKeywords} />
        <Stat icon={ArrowUpRight} label="In top 3" value={data.seo.top3Keywords} />
        <div className="min-w-0 rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Avg. position</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{data.seo.averagePosition}</p>
          <p className="text-xs">
            {/* Lower is better for rank position, so a drop is shown as an improvement. */}
            <Change value={-data.seo.averagePositionChange} suffix="" />
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-slate-600">Keywords ranking in the top 3</span>
          <span className="tabular-nums text-slate-500">{Math.round((data.seo.top3Keywords / data.seo.trackedKeywords) * 100)}%</span>
        </div>
        <Meter value={(data.seo.top3Keywords / data.seo.trackedKeywords) * 100} />
      </div>
    </ReportSection>
  );
}
