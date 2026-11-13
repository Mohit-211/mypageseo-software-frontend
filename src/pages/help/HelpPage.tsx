import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building,
  Building2,
  Compass,
  CreditCard,
  FileBarChart,
  LifeBuoy,
  ListChecks,
  Mail,
  MapPin,
  MessageSquareHeart,
  MessagesSquare,
  PlugZap,
  Search,
  Sparkles,
  Stamp,
  Swords,
  Tags,
  TrendingUp,
  UserRound,
  Users,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { IconChip } from "@/components/layout/shared/icon-chip";
import type { ModuleTone } from "@/components/layout/shared/module-tone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAccess } from "@/hooks/use-access";
import type { Permission } from "@/lib/mypageseo/access";
import { countArticles, getHelp, searchHelp, type HelpCategoryId, type HelpLink } from "@/lib/mypageseo/help";
import { locationPath, pickNavLocationId, resolveAppLink } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";

const CATEGORY_LOOK: Record<HelpCategoryId, { icon: LucideIcon; tone: ModuleTone }> = {
  getting_started: { icon: Compass, tone: "brand" },
  locations: { icon: MapPin, tone: "locations" },
  keywords: { icon: Tags, tone: "keywords" },
  rankings: { icon: TrendingUp, tone: "rankings" },
  gbp: { icon: Building2, tone: "gbp" },
  reputation: { icon: MessageSquareHeart, tone: "reputation" },
  ai: { icon: Sparkles, tone: "ai" },
  citations: { icon: ListChecks, tone: "citations" },
  competitors: { icon: Swords, tone: "competitors" },
  reports: { icon: FileBarChart, tone: "reports" },
  white_label: { icon: Stamp, tone: "reports" },
  clients: { icon: Users, tone: "clients" },
  account: { icon: UserCog, tone: "settings" },
};

/** The settings people ask about most; each shows only to those who can open it. */
const QUICK_LINKS: { label: string; to: string; hint: string; icon: LucideIcon; permission?: Permission }[] = [
  { label: "Organization settings", to: "/settings", hint: "Name, country and usage", icon: Building, permission: "settings.manage" },
  { label: "Profile", to: "/settings/profile", hint: "Your name, email and password", icon: UserRound },
  { label: "Team", to: "/settings/team", hint: "Invite people and change access", icon: Users, permission: "team.view" },
  { label: "Billing and tokens", to: "/settings/billing", hint: "Plan, token packs and invoices", icon: CreditCard, permission: "billing.view" },
  { label: "Integrations", to: "/settings/integrations", hint: "Your Google accounts", icon: PlugZap, permission: "integrations.manage" },
  // Setup changes the workspace, so read-only people (client users) don't get sent there.
  { label: "Setup", to: "/onboarding", hint: "Finish or revisit setup", icon: Compass, permission: "workspace.edit" },
];

/** Opens Support with the new-ticket form already open. */
const NEW_TICKET_PATH = "/support?new=1";

// Opening every matching article helps a narrow search; a broad one stays folded.
const AUTO_OPEN_RESULTS = 4;

function HelpPage() {
  const access = useAccess();
  const workspace = useWorkspace();
  const [query, setQuery] = useState("");
  const help = getHelp(access.accountType, access.can);
  const navLocationId = pickNavLocationId({
    activeLocationId: workspace.activeLocation?.id ?? null,
    locationIds: workspace.locations.map((location) => location.id),
  });

  const categories = help.status === "ready" ? help.categories : [];
  const filtered = searchHelp(categories, query);
  const trimmed = query.trim();
  const matches = countArticles(filtered);
  const openIds = trimmed && matches <= AUTO_OPEN_RESULTS ? filtered.flatMap((category) => category.articles.map((article) => article.id)) : [];
  const supportEmail = help.status === "ready" ? help.support.email : null;

  /** Short app addresses become the current location's page, so a click lands straight on it. */
  const hrefFor = (link: HelpLink) => (link.section && navLocationId ? locationPath(navLocationId, link.section) : resolveAppLink(link.to, navLocationId));

  return (
    <>
      <PageHeader
        icon={LifeBuoy}
        tone="help"
        title="Help & support"
        description="Answers about using MyPageSEO, and a direct line to our team when you need one."
        actions={
          <Button asChild>
            <Link to={NEW_TICKET_PATH}>
              <MessagesSquare aria-hidden /> Contact support
            </Link>
          </Button>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <section aria-label="Search help" className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
            <label htmlFor="help-search" className="text-[15px] font-semibold text-foreground">
              What do you need help with?
            </label>
            <div className="relative mt-2.5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="help-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try “keywords” or “tokens”"
                className="h-11 pl-10 pr-10 text-base md:text-sm"
                autoComplete="off"
                aria-describedby="help-search-count"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground outline-hidden hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden className="size-4" />
                </button>
              ) : null}
            </div>
            <p id="help-search-count" className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {trimmed ? `${matches} of ${countArticles(categories)} articles match “${trimmed}”.` : `${countArticles(categories)} articles across ${categories.length} topics.`}
            </p>
            {!trimmed ? (
              <nav aria-label="Help topics" className="mt-4 flex flex-wrap gap-2">
                {categories.map((category) => {
                  const look = CATEGORY_LOOK[category.id];
                  const Icon = look.icon;
                  return (
                    <a
                      key={category.id}
                      href={`#help-${category.id}`}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-border-strong bg-card px-3 text-[13px] font-medium text-foreground outline-hidden transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Icon aria-hidden className={cn("size-4", look.tone === "ai" ? "text-ai" : "text-muted-foreground")} />
                      {category.label}
                    </a>
                  );
                })}
              </nav>
            ) : null}
          </section>

          {filtered.length === 0 ? (
            <EmptyState
              variant="no-results"
              title="No help articles match that search"
              description="Try a shorter word such as “keywords”, “citations” or “billing”, or ask our team directly."
              action={
                <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              }
              secondaryAction={
                <Button asChild size="sm" variant="outline">
                  <Link to={NEW_TICKET_PATH}>Contact support</Link>
                </Button>
              }
            />
          ) : (
            filtered.map((category) => {
              const look = CATEGORY_LOOK[category.id];
              return (
                <section key={category.id} id={`help-${category.id}`} aria-labelledby={`help-${category.id}-title`} className="scroll-mt-20">
                  <div className="mb-3 flex items-center gap-3">
                    <IconChip icon={look.icon} tone={look.tone} size="md" />
                    <div className="min-w-0">
                      <h2 id={`help-${category.id}-title`} className="text-base font-semibold tracking-tight text-foreground">
                        {category.label}
                      </h2>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                  <Accordion key={trimmed} type="multiple" defaultValue={openIds} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
                    {category.articles.map((article) => (
                      <AccordionItem key={article.id} value={article.id} className="border-b border-border px-4 last:border-b-0">
                        <AccordionTrigger className="py-3.5 text-left hover:no-underline">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-foreground">{article.title}</span>
                            <span className="mt-0.5 block text-sm font-normal text-muted-foreground">{article.summary}</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="max-w-3xl space-y-2 text-sm leading-relaxed text-muted-foreground">
                            {article.body.map((paragraph) => (
                              <p key={paragraph}>{paragraph}</p>
                            ))}
                          </div>
                          {article.link ? (
                            <Button variant="outline" size="sm" className="mt-3" asChild>
                              <Link to={hrefFor(article.link)}>
                                {article.link.label}
                                <ArrowRight aria-hidden />
                              </Link>
                            </Button>
                          ) : null}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              );
            })
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20" aria-label="Contact and shortcuts">
          <section aria-labelledby="help-contact" className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="bg-linear-to-br from-brand to-sidebar-deep px-4 py-4 text-brand-foreground">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-highlight">
                <LifeBuoy aria-hidden className="size-4" /> Support
              </p>
              <h2 id="help-contact" className="mt-1.5 text-base font-semibold">
                Ask the MyPageSEO team
              </h2>
              <p className="mt-1 text-sm text-sidebar-foreground">Open a ticket with the location and the screen you were on. We reply on the ticket and by email.</p>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {/* Outline: the header's "Contact support" is the page's one filled action. */}
              <Button asChild size="sm" variant="outline">
                <Link to={NEW_TICKET_PATH}>
                  <MessagesSquare aria-hidden /> Open a ticket
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/support">Your tickets</Link>
              </Button>
              {supportEmail ? (
                <Button asChild size="sm" variant="ghost">
                  <a href={`mailto:${supportEmail}`}>
                    <Mail aria-hidden /> Email
                  </a>
                </Button>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="help-quick-links" className="rounded-xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-4 py-3">
              <h2 id="help-quick-links" className="text-[15px] font-semibold text-foreground">
                Quick links
              </h2>
              <p className="text-[13px] text-muted-foreground">The settings people ask about most.</p>
            </div>
            <ul className="divide-y divide-border">
              {QUICK_LINKS.filter((link) => !link.permission || access.can(link.permission)).map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="group flex items-center gap-3 px-4 py-2.5 outline-hidden transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{link.label}</span>
                        <span className="block text-xs text-muted-foreground">{link.hint}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

export default HelpPage;
