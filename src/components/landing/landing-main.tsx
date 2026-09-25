import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Compass,
  FileBarChart,
  ListChecks,
  MapPin,
  Ruler,
  Search,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import { LandingHeader } from "./landing-header";
import { LandingFooter } from "./landing-footer";
/** Restrained static preview of the product interface, using the app's own visual language. */
function ProductPreview() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-border bg-surface shadow-raised"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-strong px-3 py-2">
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="ml-3 truncate rounded border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          mypageseo.com/locations/riverside-dental
        </span>
      </div>
      <div className="flex">
        {/* Mini sidebar */}
        <div className="hidden w-36 shrink-0 border-r border-border bg-sidebar p-2.5 sm:block">
          <div className="flex items-center gap-1.5 px-1 pb-2.5">
            <span className="grid size-5 place-items-center rounded bg-sidebar-primary text-[9px] font-bold text-sidebar-primary-foreground">M</span>
            <span className="text-[11px] font-semibold text-sidebar-foreground">Mypageseo</span>
          </div>
          {["Dashboard", "Locations", "Rankings", "GBP", "Citations", "Reports"].map((item, i) => (
            <div
              key={item}
              className={cn(
                "rounded px-1.5 py-1 text-[11px]",
                i === 0
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70",
              )}
            >
              {item}
            </div>
          ))}
        </div>
        {/* Mini dashboard */}
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">Riverside Dental — North Austin</p>
              <p className="text-[10px] text-muted-foreground">Google Business Profile · Austin, TX</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded border border-success/30 bg-success-surface px-1.5 py-0.5 text-[10px] font-medium text-success">
              <TrendingUp className="size-2.5" /> Improving
            </span>
          </div>
          {/* Metrics */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Visibility score", value: "72" },
              { label: "Avg. position", value: "4.3" },
              { label: "GBP health", value: "Good" },
              { label: "Review rating", value: "4.7" },
            ].map((m) => (
              <div key={m.label} className="rounded-md border border-border bg-surface p-2">
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                <p className="tabular mt-0.5 text-sm font-semibold text-foreground">{m.value}</p>
              </div>
            ))}
          </div>
          {/* Chart + action */}
          <div className="mt-2 grid gap-2 sm:grid-cols-5">
            <div className="rounded-md border border-border bg-surface p-2 sm:col-span-3">
              <p className="text-[10px] font-medium text-foreground">Average Google position</p>
              <svg viewBox="0 0 200 56" className="mt-1 h-14 w-full" preserveAspectRatio="none">
                <polyline
                  points="0,44 25,40 50,42 75,32 100,30 125,22 150,24 175,14 200,10"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                />
              </svg>
              <p className="text-[9px] text-muted-foreground">Lower is better · last 12 weeks</p>
            </div>
            <div className="rounded-md border border-border bg-surface p-2 sm:col-span-2">
              <p className="text-[10px] font-medium text-foreground">Recommended action</p>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Respond to 3 unanswered reviews to improve GBP engagement.
              </p>
              <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">
                Review queue <ArrowRight className="size-2.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const accentChip = [
  "bg-brand-tint text-primary",
  "bg-info-surface text-info",
  "bg-success-surface text-success",
  "bg-warning-surface text-warning-foreground",
  "bg-brand-accent-surface text-critical",
] as const;

const workflow = [
  {
    icon: Search,
    title: "Collect",
    text: "Track keyword rankings, local grid positions, reviews, and profile data for every location you manage.",
  },
  {
    icon: Compass,
    title: "Understand",
    text: "See what changed, where you stand against competitors, and which locations need attention first.",
  },
  {
    icon: ClipboardCheck,
    title: "Recommend",
    text: "Get prioritized, explainable actions — not generic checklists — tied to what actually moved.",
  },
  {
    icon: Workflow,
    title: "Execute",
    text: "Work through GBP improvements, citation gaps, and review follow-up from a single queue.",
  },
  {
    icon: Ruler,
    title: "Measure",
    text: "Report the outcome with ranking history, visibility trends, and client-ready reporting.",
  },
];

const capabilities = [
  {
    icon: TrendingUp,
    title: "Local Rankings",
    text: "Keyword rankings, ranking distribution, top movers, map rankings, and local search grids per location.",
  },
  {
    icon: Building2,
    title: "Google Business Profile",
    text: "Profile health, structured audits, reviews, and posts — with clear findings and next steps.",
  },
  {
    icon: ListChecks,
    title: "Citations",
    text: "Track citation coverage and consistency for each location's name, address, and phone data.",
  },
  {
    icon: Users,
    title: "Competitors",
    text: "Compare tracked rankings and GBP audit results against the competitors that matter locally.",
  },
  {
    icon: FileBarChart,
    title: "Reports",
    text: "Client-ready reporting built from the rankings, reviews, and profile data already in the platform.",
  },
  {
    icon: Workflow,
    title: "Automations",
    text: "Recurring checks and workflows that keep locations monitored without manual effort.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main id="main">
        {/* Hero */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Local SEO management
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Local SEO, without the guesswork.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                Mypageseo helps businesses and agencies manage local search visibility in one place:
                keyword rankings, Google Business Profiles, citations, competitors, and reporting —
                organized around the locations you actually operate.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild>
                  <Link to="/signup">
                    Get Started <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* Workflow */}
        <section id="product" className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              How the product works
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Mypageseo follows the way local SEO work actually happens: gather the data, understand
              what changed, decide what to do, do it, and show the result.
            </p>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {workflow.map((step, i) => (
                <li key={step.title} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <span className={`grid size-8 place-items-center rounded-md ${accentChip[i % accentChip.length]}`}>
                      <step.icon className="size-4" aria-hidden />
                    </span>
                    <span className="tabular text-xs font-medium text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Who it's for */}
        <section id="who" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Built for businesses and agencies
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-6 border-t-2 border-t-primary">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" aria-hidden />
                  <h3 className="text-sm font-semibold text-foreground">For businesses</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Manage your own locations and local search presence from one workspace. Track how
                  each Google Business Profile ranks, keep profiles healthy, stay on top of reviews,
                  and know exactly what to work on next.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-6 border-t-2 border-t-chart-2">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-chart-2" aria-hidden />
                  <h3 className="text-sm font-semibold text-foreground">For agencies</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Manage multiple clients and locations with portfolio-level visibility. Monitor
                  rankings, GBP health, competitors, and citations across every client, and turn the
                  work into clear reporting.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              One platform for local search operations
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Each area of Mypageseo covers a core part of local SEO work, all tied back to your
              locations.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((cap, i) => (
                <div key={cap.title} className="rounded-lg border border-border bg-background p-5">
                  <span className={`grid size-8 place-items-center rounded-md ${accentChip[i % accentChip.length]}`}>
                    <cap.icon className="size-4" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{cap.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{cap.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-y-2 border-b-border border-t-brand-accent bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Start managing local search properly.
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Create an account and connect your first location.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="accent" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
