import { useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink, MoreHorizontal } from "lucide-react";
import type { BriefEvidence, BriefSource } from "@/api";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { evidenceOf, isWebUrl, pageLabel } from "@/lib/ai-brief/brief";
import { cn } from "@/lib/utils";

/** A link to a page outside the app (a page of the website), opening in a new tab. */
export function ExternalTextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <ExternalLink aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * The quotes an item was found with ("…" with its page), the first one shown and the rest a click away: the proof
 * that the AI didn't make it up.
 */
export function EvidenceQuotes({ evidence, sources, label = "Found on your website" }: { evidence: readonly BriefEvidence[] | null | undefined; sources: readonly BriefSource[] | null | undefined; label?: string }) {
  const [open, setOpen] = useState(false);
  const quotes = evidenceOf(evidence, sources);
  if (quotes.length === 0) return null;
  const shown = open ? quotes : quotes.slice(0, 1);
  return (
    <div className="mt-2 space-y-1.5">
      <p className="sr-only">{label}:</p>
      {shown.map((quote, index) => (
        <figure key={`${index}-${quote.quote.slice(0, 24)}`} className="border-l-2 border-ai/30 pl-3 text-xs">
          <blockquote className="break-words text-muted-foreground">“{quote.quote}”</blockquote>
          {isWebUrl(quote.url) ? (
            <figcaption className="mt-0.5">
              <ExternalTextLink href={quote.url} className="text-xs">
                {quote.title ?? pageLabel(quote.url)}
              </ExternalTextLink>
            </figcaption>
          ) : null}
        </figure>
      ))}
      {quotes.length > 1 ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="relative h-auto gap-1 p-0 text-xs font-medium after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-[''] [&_svg]:size-3.5"
        >
          {open ? "Show one quote" : `${quotes.length - 1} more ${quotes.length - 1 === 1 ? "quote" : "quotes"}`}
          <ChevronDown aria-hidden className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </Button>
      ) : null}
    </div>
  );
}

export type ItemAction = { label: string; onSelect: () => void; destructive?: boolean; icon?: ReactNode };

/** "More actions" for one item (Edit, Use the website's words, Remove), as a menu that keeps rows calm. */
export function ItemActionsMenu({ label, actions, disabled }: { label: string; actions: readonly ItemAction[]; disabled?: boolean }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-1 size-9 shrink-0 text-muted-foreground" aria-label={label} disabled={disabled}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onSelect={action.onSelect}
            className={cn(action.destructive && "text-critical focus:bg-critical-surface focus:text-critical")}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
