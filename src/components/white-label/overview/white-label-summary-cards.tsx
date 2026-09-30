import type { ReactNode } from "react";
import { FileCheck2, Globe, Palette, Users, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { Skeleton } from "@/components/ui/skeleton";
import { DOMAIN_STATUS_LABEL, type WhiteLabelSummary } from "@/lib/white-label/white-label";
import { cn } from "@/lib/utils";
import { DomainStatusBadge } from "../white-label-ui";

type SummaryCard = {
  label: string;
  value: ReactNode;
  caption: string;
  status?: ReactNode;
  icon: LucideIcon;
  iconClassName: string;
};

export function WhiteLabelSummaryCards({ summary, brandingConfigured }: { summary: WhiteLabelSummary; brandingConfigured: boolean }) {
  const brandedShare = summary.published ? Math.round((summary.branded / summary.published) * 100) : 0;
  const cards: SummaryCard[] = [
    {
      label: "Active Clients",
      value: summary.activeClients,
      caption: `${summary.clientsWithReports} with a client report`,
      icon: Users,
      iconClassName: "bg-brand-tint text-primary",
    },
    {
      label: "Published Reports",
      value: summary.published,
      caption: [summary.drafts ? `${summary.drafts} draft` : null, summary.disabled ? `${summary.disabled} disabled` : null].filter(Boolean).join(" · ") || "Shared with clients",
      icon: FileCheck2,
      iconClassName: "bg-success-surface text-success",
    },
    {
      label: "Branded Reports",
      value: summary.branded,
      caption: summary.published ? `${brandedShare}% of published reports` : "No published reports yet",
      status: brandingConfigured ? <StatusBadge tone="brand">Agency branding</StatusBadge> : <StatusBadge tone="warning">Branding not set</StatusBadge>,
      icon: Palette,
      iconClassName: "bg-info-surface text-info",
    },
    {
      label: "Domain Status",
      value: DOMAIN_STATUS_LABEL[summary.domain.custom ? "connected" : summary.domainStatus],
      caption: summary.domain.hostname,
      status:
        !summary.domain.custom && summary.customDomainStatus !== "not_connected" ? (
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Custom domain <DomainStatusBadge status={summary.customDomainStatus} />
          </span>
        ) : (
          <StatusBadge>{summary.domain.custom ? "Custom domain" : "Default domain"}</StatusBadge>
        ),
      icon: Globe,
      iconClassName: "bg-warning-surface text-warning-foreground",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", card.iconClassName)}>
              <card.icon className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-1 text-2xl font-semibold tabular text-foreground">{card.value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={card.caption}>
            {card.caption}
          </p>
          {card.status ? <div className="mt-2.5">{card.status}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function WhiteLabelSummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="size-8 rounded-md" />
          </div>
          <Skeleton className="mt-1 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-36" />
          <Skeleton className="mt-3 h-5 w-24" />
        </div>
      ))}
    </div>
  );
}
