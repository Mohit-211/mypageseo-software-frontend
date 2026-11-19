/**
 * Replies v3 (Phase 25b): the judge's score of the AI's text (`draft.quality`), next to the draft.
 * - `QualityBadge`: "AI score 4.4/5"; "Score before the AI's edit 4.0/5" when the judge read the text before its
 *   targeted edit (`scored_text: "candidate"`); "The AI's version scored 4.4/5" once a person edited the draft (the
 *   score still describes the AI's text). Nothing when no judge ran (`score` null) or the draft has no quality.
 * - `QualityNotes`: the judge's notes on the criteria scored under 4 ("What could be better"), lowest first.
 */
import { Gauge } from "lucide-react";
import type { ReviewDraft } from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { qualityView, type QualityView } from "@/lib/reviews/draft-view";
import { cn } from "@/lib/utils";

function badgeLabel(view: QualityView): string {
  const score = `${view.display}/5`;
  if (view.beforeEdit) return `Score before the AI's edit ${score}`;
  if (view.ofAiText) return `The AI's version scored ${score}`;
  return `AI score ${score}`;
}

function badgeTitle(view: QualityView): string {
  const base = "An AI checker graded the AI's reply on what the reviewer said, warmth, tone, facts and Google's rules (1 to 5; 4 or more is good).";
  if (view.beforeEdit) return `${base} This score is of the text before the AI's last edit: the checker couldn't read the edited text in time.`;
  if (view.ofAiText) return `${base} It describes the AI's text, not your edits.`;
  return base;
}

export function QualityBadge({ draft, className }: { draft: Pick<ReviewDraft, "quality" | "edited" | "source">; className?: string }) {
  const view = qualityView(draft);
  if (!view) return null;
  const title = badgeTitle(view);
  return (
    <span title={title} className={cn("inline-flex", className)}>
      <StatusBadge tone={view.good && !view.beforeEdit ? "success" : "neutral"} icon={Gauge} size="sm">
        {badgeLabel(view)}
      </StatusBadge>
      <span className="sr-only">. {title}</span>
    </span>
  );
}

export function QualityNotes({ draft, className }: { draft: Pick<ReviewDraft, "quality" | "edited" | "source">; className?: string }) {
  const view = qualityView(draft);
  if (!view || view.notes.length === 0) return null;
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs font-semibold text-muted-foreground">What the checker would improve</p>
      <ul className="mt-1 space-y-1">
        {view.notes.map((note) => (
          <li key={note.key} className="flex min-w-0 gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
            <span className="min-w-0 break-words">
              <span className="font-medium text-foreground">{note.label}</span> ({note.score}/5): {note.note}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
