import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Lightbulb, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { BriefSource } from "@/api";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/datetime";
import { isWebUrl, pageLabel, suggestionErrorText, suggestionKindText, type SuggestionRow } from "@/lib/ai-brief/brief";
import { useBriefMutations } from "@/lib/ai-brief/use-brief";
import { locationPath } from "@/lib/mypageseo/section-links";
import { cn } from "@/lib/utils";
import { EvidenceQuotes, ExternalTextLink } from "./brief-parts";

/**
 * Suggestions from the business brief: proof points the website claims (years, licences, awards, memberships) and
 * what web research found about the business on other sites. The AI states none of them until the owner confirms
 * one: it then becomes one of the owner's facts (AI Settings `#facts`, "From the brief"). "Dismiss" keeps it listed
 * so a rebuild never suggests it again. Waiting ones lead; decided ones fold away. A client user reads them.
 */
export function BriefSuggestions({
  locationId,
  pending,
  decided,
  sources,
  canEdit,
}: {
  locationId: string;
  pending: readonly SuggestionRow[];
  decided: readonly SuggestionRow[];
  sources: readonly BriefSource[];
  canEdit: boolean;
}) {
  const { decide } = useBriefMutations(locationId);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [showDecided, setShowDecided] = useState(false);
  const factsPath = locationPath(locationId, "ai/settings", "#facts");

  if (pending.length === 0 && decided.length === 0) return null;

  const run = async (row: SuggestionRow, action: "confirm" | "dismiss") => {
    setBusy((current) => new Set(current).add(row.id));
    try {
      await decide.mutateAsync({ itemId: row.id, action });
      if (action === "confirm") {
        toast.success("Added to your facts. The AI may say it now.", { action: { label: "See facts", onClick: () => navigate(factsPath) } });
      } else {
        toast.success("Dismissed. It won't be suggested again.");
      }
    } catch (err) {
      toast.error(suggestionErrorText(err).text);
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  };

  return (
    <section aria-labelledby="brief-suggestions-title" className="min-w-0 rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <IconChip icon={Lightbulb} tone="ai" size="sm" className="-mt-0.5" />
        <div className="min-w-0">
          <h2 id="brief-suggestions-title" className="text-[15px] font-semibold leading-6 text-foreground">
            {pending.length > 0 ? `Waiting for you · ${pending.length}` : "Suggestions"}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {canEdit
              ? "Claims from your website and what other sites say about you. The AI says none of them until you confirm one: it then becomes one of your facts."
              : "Claims from the website and what other sites say about the business. The AI says none of them until your agency confirms one."}
          </p>
        </div>
      </div>

      {pending.length > 0 ? (
        <ul className="divide-y divide-border">
          {pending.map((row) => (
            <SuggestionItem key={row.id} row={row} sources={sources}>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={busy.has(row.id)} aria-busy={busy.has(row.id) || undefined} onClick={() => void run(row, "confirm")}>
                    {busy.has(row.id) ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />} Confirm
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled={busy.has(row.id)} onClick={() => void run(row, "dismiss")}>
                    <X aria-hidden /> Dismiss
                  </Button>
                </div>
              ) : null}
            </SuggestionItem>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">Nothing waits for you.</p>
      )}

      {decided.length > 0 ? (
        <div className="border-t border-border px-4 py-2 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={showDecided}
            onClick={() => setShowDecided((value) => !value)}
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            Decided ({decided.length}) <ChevronDown aria-hidden className={cn("transition-transform motion-reduce:transition-none", showDecided && "rotate-180")} />
          </Button>
          {showDecided ? (
            <ul className="divide-y divide-border">
              {decided.map((row) => (
                <SuggestionItem key={row.id} row={row} sources={sources} quiet>
                  {row.status === "confirmed" ? (
                    <Link to={factsPath} className="inline-flex min-h-9 items-center text-sm font-medium text-primary underline-offset-2 hover:underline">
                      See it in your facts
                    </Link>
                  ) : canEdit ? (
                    <Button type="button" variant="outline" size="sm" disabled={busy.has(row.id)} onClick={() => void run(row, "confirm")}>
                      {busy.has(row.id) ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />} Confirm after all
                    </Button>
                  ) : null}
                </SuggestionItem>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SuggestionItem({ row, sources, quiet = false, children }: { row: SuggestionRow; sources: readonly BriefSource[]; quiet?: boolean; children?: ReactNode }) {
  const research = row.group === "research";
  return (
    <li className={cn("flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4", quiet ? "px-0" : "px-4 sm:px-5")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="neutral" size="sm">
            {suggestionKindText(row.kind)}
          </StatusBadge>
          <span className="text-xs text-muted-foreground">{research ? "Found on another website" : "Claimed on your website"}</span>
          {row.status === "confirmed" ? (
            <StatusBadge tone="success" size="sm" icon={Check}>
              In your facts{row.decided_at ? ` since ${formatDate(row.decided_at)}` : ""}
            </StatusBadge>
          ) : row.status === "dismissed" ? (
            <StatusBadge tone="neutral" size="sm" icon={X}>
              Dismissed
            </StatusBadge>
          ) : null}
        </div>
        <p className={cn("mt-1 break-words text-sm", quiet ? "text-muted-foreground" : "text-foreground")}>{row.text}</p>
        {research && isWebUrl(row.url) ? (
          <p className="mt-1 text-xs">
            <span className="text-muted-foreground">Source: </span>
            <ExternalTextLink href={row.url} className="text-xs">
              {pageLabel(row.url)}
            </ExternalTextLink>
          </p>
        ) : null}
        {quiet ? null : <EvidenceQuotes evidence={row.evidence} sources={sources} label={research ? "Found on another website" : "Found on your website"} />}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </li>
  );
}
