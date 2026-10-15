import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  HelpCircle,
  History,
  Info,
  LayoutDashboard,
  LoaderCircle,
  MousePointerClick,
  RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { REPORT_ICON, REPORT_META, unavailableText } from "./copy";
import { pdfUrl, useClientPage } from "./data";
import { formatDate, hostOf } from "./format";
import { OverviewSection } from "./sections/overview";
import { applyBranding } from "./theme";
import { isAvailable, type ClientPageData, type ClientReportType } from "./types";
import { NotAvailable } from "./ui";

// Each report loads when its tab is first opened (the charts library only with the tabs that chart).
const RankTrackerSection = lazy(() => import("./sections/rank-tracker").then((module) => ({ default: module.RankTrackerSection })));
const GbpAuditSection = lazy(() => import("./sections/gbp-audit").then((module) => ({ default: module.GbpAuditSection })));
const CompetitorsSection = lazy(() => import("./sections/competitors").then((module) => ({ default: module.CompetitorsSection })));
const CitationsSection = lazy(() => import("./sections/citations").then((module) => ({ default: module.CitationsSection })));
const ReputationSection = lazy(() => import("./sections/reputation").then((module) => ({ default: module.ReputationSection })));

type Tab = "overview" | ClientReportType;

const tabFromHash = (): Tab => (window.location.hash.slice(1) || "overview") as Tab;

export function App() {
  const { state, edition, open, retry } = useClientPage();

  useEffect(() => {
    if (state.status === "ready") applyBranding(state.data);
  }, [state]);

  if (state.status === "loading") return <LoadingPage />;
  if (state.status === "not_found") return <Notice title="Report not available" text="This link is no longer active. Please ask your account manager for a new one." />;
  if (state.status === "rate_limited") return <Notice title="Too many requests" text="Please wait a minute and try again." action={<RetryButton onClick={retry} />} />;
  if (state.status === "error") return <Notice title="The report couldn't be loaded" text="Check your connection and try again." action={<RetryButton onClick={retry} />} />;

  const page = state.data;
  // A different edition is loading while the current one stays on screen.
  const switching = (edition ?? page.latest_key) !== page.edition.key;
  return <ReportPage page={page} switching={switching} onEdition={open} />;
}

function ReportPage({ page, switching, onEdition }: { page: ClientPageData; switching: boolean; onEdition: (key: string | null) => void }) {
  const showOverview = page.reports.length > 1;
  const tabs = useMemo<Tab[]>(() => (showOverview ? ["overview", ...page.reports] : page.reports), [showOverview, page.reports]);
  const [tab, setTab] = useState<Tab>(() => {
    const fromHash = tabFromHash();
    return tabs.includes(fromHash) ? fromHash : (tabs[0] ?? "overview");
  });
  const [guide, setGuide] = useState(false);
  const active: Tab = tabs.includes(tab) ? tab : (tabs[0] ?? "overview");

  useEffect(() => {
    const onHash = () => {
      const next = tabFromHash();
      if (tabs.includes(next)) setTab(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [tabs]);

  const go = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${next}`);
    document.getElementById("report-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const isLatest = page.edition.key === page.latest_key;
  const index = tabs.indexOf(active);
  const previous = index > 0 ? tabs[index - 1] : undefined;
  const next = index < tabs.length - 1 ? tabs[index + 1] : undefined;
  const editionParam = isLatest ? null : page.edition.key;

  return (
    <div className="min-h-screen">
      <TopBar page={page} onGuide={() => setGuide(true)} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-4 sm:px-6">
        <Hero page={page} switching={switching} onEdition={onEdition} />

        {!isLatest ? (
          <div className="fade-up flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning-surface px-4 py-3 text-sm text-warning-foreground">
            <History aria-hidden className="size-4" />
            <span className="flex-1">You're looking at an earlier report, from {formatDate(page.edition.generated_at)}.</span>
            <button type="button" onClick={() => onEdition(null)} className="rounded-lg bg-white/70 px-3 py-1.5 font-medium shadow-sm hover:bg-white">
              See the latest
            </button>
          </div>
        ) : null}

        {tabs.length > 1 ? (
          <nav id="report-tabs" aria-label="Report sections" className="no-print sticky top-16 z-20 -mx-4 scroll-mt-20 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
            <div className="track-inset flex gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none]">
              {tabs.map((entry) => {
                const Icon = entry === "overview" ? LayoutDashboard : REPORT_ICON[entry];
                return (
                  <button
                    key={entry}
                    type="button"
                    aria-current={entry === active ? "true" : undefined}
                    onClick={() => go(entry)}
                    className="tab-raised flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <Icon aria-hidden className="size-4" />
                    {entry === "overview" ? "Overview" : REPORT_META[entry].short}
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}

        <div key={`${active}-${page.edition.key}`} className={cn("fade-up space-y-6 transition-opacity", switching && "pointer-events-none opacity-50")}>
          {active === "overview" ? (
            <>
              <SectionHeading title="At a glance" intro="The headline numbers from each part of your report. Tap one to see the details." />
              <OverviewSection page={page} onOpen={go} />
            </>
          ) : (
            <>
              <SectionHeading
                title={REPORT_META[active].label}
                intro={REPORT_META[active].intro}
                action={
                  <a
                    href={pdfUrl(active, editionParam)}
                    className="card-3d card-lift inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <Download aria-hidden className="size-4" /> Download PDF
                  </a>
                }
              />
              <Suspense fallback={<SectionLoading />}>
                <ReportBody type={active} page={page} />
              </Suspense>
            </>
          )}
        </div>

        {tabs.length > 1 ? (
          <div className="no-print flex items-center justify-between gap-3 pt-2">
            {previous ? <StepButton direction="back" label={previous === "overview" ? "Overview" : REPORT_META[previous].short} onClick={() => go(previous)} /> : <span />}
            {next ? <StepButton direction="next" label={next === "overview" ? "Overview" : REPORT_META[next].short} onClick={() => go(next)} /> : null}
          </div>
        ) : null}
      </main>
      <Footer page={page} />
      <Guide open={guide} onClose={() => setGuide(false)} page={page} />
    </div>
  );
}

function ReportBody({ type, page }: { type: ClientReportType; page: ClientPageData }) {
  const part = page.data[type];
  if (!part || !isAvailable(part)) return <NotAvailable>{unavailableText((part as { reason?: string } | undefined)?.reason ?? "no_data")}</NotAvailable>;
  switch (type) {
    case "rank_tracker":
      return isAvailable(page.data.rank_tracker) ? <RankTrackerSection data={page.data.rank_tracker} /> : null;
    case "gbp_audit":
      return isAvailable(page.data.gbp_audit) ? <GbpAuditSection data={page.data.gbp_audit} /> : null;
    case "competitor_analysis":
      return isAvailable(page.data.competitor_analysis) ? <CompetitorsSection data={page.data.competitor_analysis} /> : null;
    case "citation":
      return isAvailable(page.data.citation) ? <CitationsSection data={page.data.citation} /> : null;
    case "reputation":
      return isAvailable(page.data.reputation) ? <ReputationSection data={page.data.reputation} /> : null;
  }
}

function Logo({ page, className }: { page: ClientPageData; className?: string }) {
  const [failed, setFailed] = useState(false);
  const { branding } = page;
  if (!branding.logo_url || failed) {
    return (
      <span className={cn("bevel size-9 text-sm font-bold", className)} aria-hidden>
        {branding.name.trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  return <img src={branding.logo_url} alt={branding.name} onError={() => setFailed(true)} className={cn("h-9 max-w-36 object-contain", className)} />;
}

function TopBar({ page, onGuide }: { page: ClientPageData; onGuide: () => void }) {
  const { branding } = page;
  return (
    <header className="no-print sticky top-0 z-30 border-b border-white/60 bg-background/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <span className="card-3d flex items-center rounded-xl px-2 py-1.5">
          <Logo page={page} />
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{branding.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onGuide}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-brand-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <HelpCircle aria-hidden className="size-4" /> <span className="hidden sm:inline">How to read this</span>
          </button>
          {branding.website_url ? (
            <a
              href={branding.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-3d card-lift hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-primary sm:inline-flex"
            >
              {hostOf(branding.website_url)} <ExternalLink aria-hidden className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function Hero({ page, switching, onEdition }: { page: ClientPageData; switching: boolean; onEdition: (key: string | null) => void }) {
  const { location, branding } = page;
  const address = [location.address, location.city, location.state, location.country].filter(Boolean).join(", ");
  return (
    <section className="hero-3d fade-up px-5 py-7 sm:px-8 sm:py-9">
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">Local search report</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{location.name}</h1>
          {address ? <p className="mt-1 text-sm opacity-85">{address}</p> : null}
          <p className="mt-3 max-w-xl text-sm opacity-90">
            Prepared for you by {branding.name}. It updates on its own every month, so this link always shows your latest results.
          </p>
        </div>
        <EditionPicker page={page} switching={switching} onEdition={onEdition} />
      </div>
    </section>
  );
}

function EditionPicker({ page, switching, onEdition }: { page: ClientPageData; switching: boolean; onEdition: (key: string | null) => void }) {
  const isLatest = page.edition.key === page.latest_key;
  return (
    <div className="shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-3.5 py-2.5 text-sm font-medium shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_20px_-10px_rgb(0_0_0/0.4)] backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {switching ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <CalendarDays aria-hidden className="size-4" />}
            <span>
              <span className="block text-[11px] font-normal opacity-80">{isLatest ? "Latest update" : "Earlier report"}</span>
              {formatDate(page.edition.generated_at)}
            </span>
            {page.editions.length > 1 ? <ChevronDown aria-hidden className="size-4 opacity-80" /> : null}
          </button>
        </DropdownMenuTrigger>
        {page.editions.length > 1 ? (
          <DropdownMenuContent align="end" className="max-h-80 w-60 overflow-y-auto">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Open an earlier report</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {page.editions.map((entry) => (
              <DropdownMenuItem key={entry.key} onSelect={() => onEdition(entry.key === page.latest_key ? null : entry.key)} className="justify-between">
                <span>{formatDate(entry.generated_at)}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {entry.key === page.latest_key ? "Latest" : null}
                  {entry.key === page.edition.key ? <Check aria-hidden className="size-3.5 text-primary" /> : null}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        ) : null}
      </DropdownMenu>
    </div>
  );
}

function SectionHeading({ title, intro, action }: { title: string; intro: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
      </div>
      {action}
    </div>
  );
}

function StepButton({ direction, label, onClick }: { direction: "back" | "next"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "card-3d card-lift inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        direction === "next" && "ml-auto",
      )}
    >
      {direction === "back" ? <ArrowLeft aria-hidden className="size-4 text-primary" /> : null}
      <span>
        <span className="block text-left text-[11px] text-muted-foreground">{direction === "back" ? "Previous" : "Next"}</span>
        {label}
      </span>
      {direction === "next" ? <ArrowRight aria-hidden className="size-4 text-primary" /> : null}
    </button>
  );
}

function Footer({ page }: { page: ClientPageData }) {
  const { branding } = page;
  return (
    <footer className="border-t border-border/70 bg-surface/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{branding.name}</p>
          {branding.contact_text ? <p>{branding.contact_text}</p> : null}
          {branding.website_url ? (
            <a href={branding.website_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
              {hostOf(branding.website_url)}
            </a>
          ) : null}
        </div>
        <div className="space-y-1 sm:max-w-md sm:text-right">
          {branding.footer_text ? <p>{branding.footer_text}</p> : null}
          {/* A bare source name ("Google Maps") gets a label; a full sentence is shown as it is. */}
          {page.attribution ? <p>{page.attribution.includes(":") ? page.attribution : `Business details and reviews: ${page.attribution}`}</p> : null}
        </div>
      </div>
    </footer>
  );
}

function Guide({ open, onClose, page }: { open: boolean; onClose: () => void; page: ClientPageData }) {
  const steps = [
    { icon: LayoutDashboard, title: "Start with the overview", text: "It shows the headline number from each part of your report, plus what went well and what's worth doing next." },
    { icon: MousePointerClick, title: "Use the tabs to go deeper", text: "Each tab is one part of your report. The Previous and Next buttons at the bottom walk you through them in order." },
    { icon: Info, title: "Tap the ⓘ for an explanation", text: "Every number has a short explanation in plain words, including whether higher or lower is better." },
    { icon: RefreshCw, title: "It updates every month", text: "Keep this link: it always shows your latest results. Earlier reports are in the date menu at the top." },
    { icon: Download, title: "Need a copy?", text: "Each tab has a Download PDF button you can save or print." },
  ];
  return (
    <Dialog open={open} onOpenChange={(value) => (value ? undefined : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>How to read this report</DialogTitle>
          <DialogDescription>Five things to know. Questions? Contact {page.branding.name}{page.branding.contact_text ? ` (${page.branding.contact_text})` : ""}.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="flex gap-3">
                <span className="bevel size-9 shrink-0">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{step.title}</span>
                  <span className="block text-sm text-muted-foreground">{step.text}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function SectionLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-strong" />)}
      <div className="h-72 animate-pulse rounded-2xl bg-surface-strong sm:col-span-2 lg:col-span-4" />
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pt-20 sm:px-6" aria-busy="true" aria-label="Loading the report">
      <div className="h-44 animate-pulse rounded-[1.25rem] bg-brand-tint-strong" />
      <div className="h-12 animate-pulse rounded-2xl bg-surface-strong" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface-strong" />)}
      </div>
    </div>
  );
}

function Notice({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card-3d max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card-3d card-lift inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-primary">
      <RefreshCw aria-hidden className="size-4" /> Try again
    </button>
  );
}
