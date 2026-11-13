import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Copy, ExternalLink, Eye, Plus, Stamp } from "lucide-react";
import { getWhiteLabelLink, isApiError } from "@/api";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/lib/datetime";
import { displayUrl } from "@/lib/locations/location-text";
import { CLIENT_LINK_REPORT_LABEL, isClientLinksUnavailable, whiteLabelLinkKey } from "@/lib/white-label/client-links";
import { cn } from "@/lib/utils";

/** 4xx answers (no access, plan without client links) are states, not failures to retry. */
const retry = (count: number, error: unknown) => !(isApiError(error) && error.status < 500) && count < 2;

/**
 * The location's white-label client link (agency owners and members): whether it's live, the
 * address to copy, how often the client opened it, and the way to manage it on the White Label
 * page. Hidden for plans without client links.
 */
export function ClientLinkCard({ locationId, className }: { locationId: string; className?: string }) {
  const state = useQuery({
    queryKey: whiteLabelLinkKey(locationId),
    queryFn: ({ signal }) => getWhiteLabelLink(locationId, signal),
    retry,
  });
  if (isClientLinksUnavailable(state.error)) return null;

  const link = state.data?.link ?? null;
  const manage = `/white-label?link=${encodeURIComponent(locationId)}#links`;

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Client link copied", { description: "Paste it into an email or message to your client." });
    } catch {
      toast.error("The link couldn't be copied. Select it and copy it instead.");
    }
  };

  return (
    <section aria-labelledby="client-link-title" className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-card shadow-card", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        {/* The chip sits beside the title line, not beside a description that wraps on phones. */}
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={Stamp} tone="reports" size="md" className="-mt-0.5" />
          <div className="min-w-0">
            <h2 id="client-link-title" className="text-[15px] font-semibold leading-6 text-foreground">
              Client link
            </h2>
            <p className="text-[13px] text-muted-foreground">A branded page with this location's reports</p>
          </div>
        </div>
        {state.isPending ? null : link ? (
          <StatusBadge tone="success" dot>
            Live
          </StatusBadge>
        ) : state.isError ? null : (
          <StatusBadge tone="neutral">Not shared yet</StatusBadge>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        {state.isPending ? (
          <div aria-hidden className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
        ) : state.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">The client link couldn't be loaded.</p>
            <Button variant="outline" size="sm" onClick={() => void state.refetch()}>
              Try again
            </Button>
          </div>
        ) : link ? (
          <>
            <div className="flex min-w-0 items-center gap-1 rounded-lg border border-border bg-surface-strong py-1 pl-3 pr-1">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={link.url}>
                {displayUrl(link.url)}
              </span>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => void copy(link.url)} aria-label="Copy client link">
                <Copy aria-hidden />
              </Button>
              <Button asChild variant="ghost" size="icon" className="size-8 shrink-0">
                <a href={link.url} target="_blank" rel="noreferrer" aria-label="Open the client link in a new tab">
                  <ExternalLink aria-hidden />
                </a>
              </Button>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <Eye aria-hidden className="size-4 text-primary" />
              <span>
                <span className="font-semibold text-foreground">{link.views.toLocaleString()}</span> {link.views === 1 ? "view" : "views"}
                {link.last_viewed_at ? ` · last opened ${formatShortDate(link.last_viewed_at)}` : " · not opened yet"}
              </span>
            </p>
            {link.reports.length > 0 ? (
              <ul aria-label="Reports on the link" className="flex flex-wrap gap-1.5">
                {link.reports.map((report) => (
                  <li key={report}>
                    <StatusBadge tone="brand" size="sm">
                      {CLIENT_LINK_REPORT_LABEL[report] ?? report}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            ) : null}
            {/* Outline: the page header's PDF report (or the status banner's fix) is the page's one primary action. */}
            <div className="mt-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void copy(link.url)}>
                <Copy aria-hidden /> Copy link
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to={manage}>
                  Manage <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Share a page with your logo and the reports you choose. It stays up to date after every check, so your client always sees the latest.
            </p>
            <div className="mt-auto">
              <Button asChild size="sm" variant="outline">
                <Link to={manage}>
                  <Plus aria-hidden /> Create client link
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
