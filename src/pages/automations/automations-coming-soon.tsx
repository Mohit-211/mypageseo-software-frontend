import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, PenLine, RefreshCw, Workflow, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { IconChip } from "@/components/layout/shared/icon-chip";
import type { ModuleTone } from "@/components/layout/shared/module-tone";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { useWriteBlock } from "@/lib/billing/write-block";
import { pickNavLocationId, resolveAppLink } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";

type Running = { icon: LucideIcon; tone: ModuleTone; title: string; text: string; link?: { label: string; to: string } };

/**
 * Automations aren't built yet (the routes stay for old links). The page says so and shows the
 * work that already runs on its own, with a way to each.
 */
export function AutomationsComingSoon() {
  const workspace = useWorkspace();
  const access = useAccess();
  const block = useWriteBlock();
  const navLocationId = pickNavLocationId({ activeLocationId: workspace.activeLocation?.id ?? null, locationIds: workspace.locations.map((location) => location.id) });
  // Agency staff set up monthly emails on White Label, everyone else on Reports. People who can
  // schedule one land on the open "Schedule an email" form; read-only people just see the list.
  const canSchedule = access.can("workspace.edit") && !block.blocked;
  const schedules = `${access.can("clients.view") ? "/white-label" : "/reports"}${canSchedule ? "?create=schedule" : ""}#schedules`;
  const running: Running[] = [
    { icon: RefreshCw, tone: "rankings", title: "Monthly refresh", text: "Rankings, profile data and citations update every month, for free." },
    {
      icon: PenLine,
      tone: "ai",
      title: "Auto-posts",
      text: "AI Posts can draft posts on a schedule for you to approve.",
      // Straight to the Auto-posts section, below the post ideas.
      link: { label: "Open auto-posts", to: resolveAppLink("/ai/posts#auto", navLocationId) },
    },
    {
      icon: CalendarClock,
      tone: "reports",
      title: "Monthly emails",
      text: "A fresh PDF report emails itself to you or your clients after each monthly refresh.",
      link: { label: access.can("workspace.edit") ? "Schedule an email" : "See monthly emails", to: schedules },
    },
  ];

  return (
    <>
      <PageHeader icon={Workflow} tone="settings" title="Automations" description="Rules that act on your ranking, review and profile changes for you." />
      <EmptyState
        variant="coming-soon"
        icon={Workflow}
        tone="settings"
        title="Automations are on the way"
        description="Custom rules aren't available yet. Some of the work already runs on its own; see below."
      />
      <section aria-labelledby="automations-running" className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h2 id="automations-running" className="text-[15px] font-semibold text-foreground">
          Already running on its own
        </h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {running.map((item) => (
            <li key={item.title} className="flex flex-col gap-3 rounded-lg bg-surface-strong p-3.5">
              <div className="flex items-start gap-3">
                <IconChip icon={item.icon} tone={item.tone} size="sm" className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </div>
              </div>
              {item.link ? (
                <Button asChild size="sm" variant="outline" className="mt-auto w-fit">
                  <Link to={item.link.to}>
                    {item.link.label} <ArrowRight aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
