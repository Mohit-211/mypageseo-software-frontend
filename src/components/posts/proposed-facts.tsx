/**
 * "Add as a fact" (post writer v2): statements the user asked for that the AI couldn't use because no fact says
 * so ("we've been open 40 years"). Each one can be added as an owner fact for the AI (`POST …/ai/facts`,
 * `kind: "fact"`, through AI Settings' own mutation, so the facts list and the readiness checklist follow), then
 * the post written again. Owners and members only (a client user's run has none).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Check, LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { factErrorText } from "@/lib/ai-settings/errors";
import { useAiFactMutations } from "@/lib/ai-settings/use-ai-settings";
import { locationPath } from "@/lib/mypageseo/section-links";
import { cn } from "@/lib/utils";

/** A fact's text is at most 300 characters. */
const FACT_MAX = 300;

export function ProposedFacts({
  locationId,
  facts,
  newTab = false,
  className,
}: {
  locationId: string;
  facts: readonly string[];
  /** Open AI Settings in a new tab (inside the post editor, leaving would drop unsaved changes). */
  newTab?: boolean;
  className?: string;
}) {
  const canEdit = useCanEdit();
  // AI Settings' own mutation: the new fact goes into the cached facts list and the readiness checklist is read again.
  const { create } = useAiFactMutations(locationId);
  const [state, setState] = useState<Record<string, "adding" | "added">>({});
  const shown = facts.map((fact) => fact.trim()).filter(Boolean);
  if (!canEdit || shown.length === 0) return null;

  const add = async (text: string) => {
    setState((current) => ({ ...current, [text]: "adding" }));
    try {
      await create.mutateAsync({ kind: "fact", text: text.slice(0, FACT_MAX) });
      setState((current) => ({ ...current, [text]: "added" }));
      toast.success("Added to the AI's facts", { description: "Write or change the post again to use it." });
    } catch (err) {
      setState(({ [text]: _failed, ...rest }) => rest);
      toast.error(factErrorText(err, "The fact couldn't be added. Try again."));
    }
  };

  const settings = locationPath(locationId, "ai/settings", "#facts");
  return (
    <div className={cn("rounded-lg border border-info/25 bg-info-surface px-3 py-2.5", className)}>
      <p className="text-sm font-medium text-foreground">The AI couldn't use {shown.length === 1 ? "this" : "these"}: no fact says so</p>
      <p className="text-xs text-muted-foreground">Add {shown.length === 1 ? "it" : "them"} as a fact for the AI, then write or change the post again.</p>
      <ul className="mt-2 space-y-1.5">
        {shown.map((fact) => {
          const status = state[fact];
          return (
            <li key={fact} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 break-words text-sm text-foreground [overflow-wrap:anywhere]">“{fact}”</span>
              {status === "added" ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <Check aria-hidden className="size-3.5" /> Added
                </span>
              ) : (
                <Button type="button" size="sm" variant="outline" disabled={status === "adding"} onClick={() => void add(fact)}>
                  {status === "adding" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Plus aria-hidden />} Add as a fact
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0 py-1 text-xs">
        {newTab ? (
          <a href={settings} target="_blank" rel="noreferrer">
            Your facts in AI Settings<span className="sr-only"> (opens in a new tab)</span> <ArrowRight aria-hidden />
          </a>
        ) : (
          <Link to={settings}>
            Your facts in AI Settings <ArrowRight aria-hidden />
          </Link>
        )}
      </Button>
    </div>
  );
}
