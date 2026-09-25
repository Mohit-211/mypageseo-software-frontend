import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail, Search } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, SectionHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { countArticles, getHelp, searchHelp } from "@/lib/mypageseo/help";
import { useAccountType } from "@/lib/mypageseo/workspace";

const DESCRIPTION =
  "Find answers about using Mypageseo, or see how to reach support when you need help.";



const QUICK_LINKS = [
  { label: "Integrations", to: "/settings/integrations", hint: "Google Business Profile connection" },
  { label: "Billing", to: "/settings/billing", hint: "Plan, usage and invoices" },
  { label: "General settings", to: "/settings", hint: "Organization defaults" },
  { label: "Notification settings", to: "/settings/notifications", hint: "Which events reach you" },
  { label: "Setup", to: "/onboarding", hint: "Finish or revisit workspace setup" },
] as const;

function HelpPage() {
  const accountType = useAccountType();
  const [query, setQuery] = useState("");
  const help = useMemo(() => getHelp(accountType), [accountType]);

  const categories = help.status === "ready" ? help.categories : [];
  const filtered = useMemo(() => searchHelp(categories, query), [categories, query]);
  const trimmed = query.trim();

  return (
    <AppShell>
      <PageHeader title="Help & Support" description={DESCRIPTION} />

      {help.status === "loading" ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : help.status === "error" ? (
        <ErrorState description={help.message} onRetry={() => window.location.reload()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
              <label htmlFor="help-search" className="text-sm font-semibold text-foreground">
                Search help topics
              </label>
              <div className="relative mt-2">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="help-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search rankings, citations, reports…"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {trimmed
                  ? `${countArticles(filtered)} of ${countArticles(categories)} articles match “${trimmed}”.`
                  : `${countArticles(categories)} articles across ${categories.length} product areas.`}
              </p>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No help topics match that search"
                description="Try a shorter term such as “keywords”, “citations” or “billing”, or clear the search to browse every category."
                action={
                  <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              filtered.map((category) => (
                <section key={category.id}>
                  <SectionHeader title={category.label} description={category.description} />
                  <Accordion
                    type="multiple"
                    className="overflow-hidden rounded-lg border border-border bg-surface shadow-card"
                  >
                    {category.articles.map((article) => (
                      <AccordionItem
                        key={article.id}
                        value={article.id}
                        className="border-b border-border px-4 last:border-b-0"
                      >
                        <AccordionTrigger className="py-3 text-left hover:no-underline">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-foreground">
                              {article.title}
                            </span>
                            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                              {article.summary}
                            </span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                            {article.body.map((paragraph) => (
                              <p key={paragraph}>{paragraph}</p>
                            ))}
                          </div>
                          {article.link ? (
                            <Button variant="outline" size="sm" className="mt-3" asChild>
                              <Link to={article.link.to}>
                                {article.link.label}
                                <ArrowRight className="size-3.5" />
                              </Link>
                            </Button>
                          ) : null}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
            <Panel title="Contact support" description="How to reach the Mypageseo team.">
              {help.support.email ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Email support with your organization name, the location involved and the screen
                    you were on. That is usually enough to resolve an issue in one reply.
                  </p>
                  {help.support.responseTime ? (
                    <p className="text-xs text-muted-foreground">{help.support.responseTime}</p>
                  ) : null}
                  <Button size="sm" asChild>
                    <a href={`mailto:${help.support.email}`}>
                      <Mail className="size-3.5" /> Email support
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No support address is configured for this workspace yet, so support cannot be
                    contacted from this screen.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    When you do report a problem, include your organization name, the location, the
                    screen you were on and what you expected to happen.
                  </p>
                  <Button size="sm" disabled>
                    <Mail className="size-3.5" /> Email support
                  </Button>
                </div>
              )}
            </Panel>

            <Panel title="Quick links" description="Jump to the settings people ask about most.">
              <ul className="divide-y divide-border">
                {QUICK_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{link.label}</span>
                        <span className="block text-xs text-muted-foreground">{link.hint}</span>
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

export default HelpPage;
