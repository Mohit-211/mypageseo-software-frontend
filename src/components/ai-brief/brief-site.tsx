import { useState } from "react";
import { ChevronDown, Globe, Loader2 } from "lucide-react";
import type { BusinessBriefView } from "@/api";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { briefIsBuilding, briefWarnings, isWebUrl, pageLabel, siteStatusText, warningText } from "@/lib/ai-brief/brief";
import { cn } from "@/lib/utils";
import { ExternalTextLink } from "./brief-parts";

/**
 * What to know about the brief right now: a build in progress ("Reading your website…", polled), a website that
 * couldn't be read (`site.status`), and what the read noticed (`warnings`: JavaScript-only pages, robots.txt, spam).
 */
export function BriefStatusNotes({ view }: { view: BusinessBriefView }) {
  const building = briefIsBuilding(view);
  const site = siteStatusText(view.site?.status);
  const warnings = briefWarnings(view);
  return (
    <>
      {building ? (
        <div role="status" className="flex items-start gap-2.5 rounded-lg border border-ai/25 bg-ai-surface px-3.5 py-3 text-sm text-foreground">
          <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-ai" />
          <div className="min-w-0">
            <p className="font-semibold">{view.brief ? "Reading your website again" : "Reading your website"}</p>
            <p className="mt-0.5 text-muted-foreground">
              {view.status === "queued" ? "It starts in a moment." : "The AI is reading your pages and checking what it finds."} This can take a few minutes. You can leave this
              page.
            </p>
          </div>
        </div>
      ) : null}
      {site ? (
        <FormAlert tone="warning" title="Your website couldn't be read the last time">
          {site} {view.brief ? "The brief keeps what it found before." : null}
        </FormAlert>
      ) : null}
      {warnings.length > 0 ? (
        <FormAlert tone="warning" title="What we noticed on your website">
          <ul className="list-disc space-y-0.5 pl-4">
            {warnings.slice(0, 8).map((warning) => (
              <li key={`${warning.code}-${warning.url ?? ""}`} className="break-words">
                {warningText(warning)}
              </li>
            ))}
          </ul>
        </FormAlert>
      ) : null}
    </>
  );
}

const PAGE_KIND_COPY: Record<string, string> = {
  home: "Home page",
  service: "Service",
  services: "Services",
  faq: "FAQ",
  about: "About",
  contact: "Contact",
  location: "Location",
  areas: "Areas",
  blog: "Blog",
  pricing: "Prices",
  team: "Team",
  reviews: "Reviews",
};

const kindText = (kind: string | null | undefined) => (kind ? (PAGE_KIND_COPY[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1).replace(/_/g, " ")) : null);

/** The pages the brief was read from, and when (and the web research's date), folded away by default. */
export function BriefPagesRead({ view }: { view: BusinessBriefView }) {
  const [open, setOpen] = useState(false);
  const pages = view.site?.pages ?? [];
  const research = view.research?.configured ? view.brief?.researched_at ?? view.research.researched_at : null;
  if (!view.site && !research) return null;
  return (
    <section aria-labelledby="brief-pages-title" className="min-w-0 rounded-xl border border-border bg-card shadow-card">
      <div className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5", open && "border-b border-border")}>
        <div className="flex min-w-0 items-start gap-2.5">
          <Globe aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h2 id="brief-pages-title" className="text-sm font-semibold text-foreground">
              Where this comes from
            </h2>
            <p className="text-xs text-muted-foreground">
              {view.site
                ? `${pages.length} ${pages.length === 1 ? "page" : "pages"} of ${isWebUrl(view.site.url) ? pageLabel(view.site.url) : "your website"}, read ${formatDateTime(view.site.read_at)}.`
                : "Your website hasn't been read yet."}
              {research ? ` Web research ${formatDate(research)}.` : ""}
            </p>
          </div>
        </div>
        {pages.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" aria-expanded={open} aria-controls="brief-pages-list" onClick={() => setOpen((value) => !value)} className="text-muted-foreground hover:text-foreground">
            {open ? "Hide pages" : "Show pages"} <ChevronDown aria-hidden className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")} />
          </Button>
        ) : null}
      </div>
      {open ? (
        <ul id="brief-pages-list" className="divide-y divide-border">
          {pages.map((page) => (
            <li key={page.url} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{page.title?.trim() || pageLabel(page.url)}</p>
                {isWebUrl(page.url) ? (
                  <ExternalTextLink href={page.url} className="text-xs">
                    {pageLabel(page.url)}
                  </ExternalTextLink>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {[kindText(page.kind), page.spam ? "Left out: looks like spam" : null].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
