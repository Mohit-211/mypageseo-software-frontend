/**
 * "Change it" (Phase 25a): the inline box where the user tells the AI what to change in a reply draft
 * (1–500 characters). The AI rewrites the draft through the same checks as a new draft and leaves out
 * the parts that would break the reply rules ("We left out: …"). Since 2026-11-17 it uses one of the
 * location's AI replies (a token buys a block of 10 when none is left).
 *
 * The card owns the call (`POST …/reviews/:reviewId/draft/revise`) and its busy state; this box keeps
 * what was typed and shows the inline answers the card hands back (all of it left out, a change
 * already running, the draft changed meanwhile). On success the card closes the box.
 */
import { useId, useState, type KeyboardEvent } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CreditCost } from "@/lib/reviews/reply-credits";
import { CHANGE_IT_MAX_CHARS } from "@/lib/reviews/reply-checks";
import type { InlineNotice } from "@/lib/reviews/review-errors";
import { cn } from "@/lib/utils";
import { DraftNote } from "./draft-checks";
import { ReplyCostChip } from "./reply-cost-chip";

export type ChangeItBoxProps = {
  /** The reviewer's name, for the field's accessible name. */
  reviewer: string;
  /** What one rewrite costs: one of the location's AI replies (`creditCost(1, credits, reply_drafts_per_10)`). */
  cost: CreditCost;
  balance?: number;
  /** `ai.canRun`; when false, `reason` says why (Rewrite stays visible, disabled). */
  canRun: boolean;
  reason?: string;
  /** The rewrite is running. */
  pending: boolean;
  /** Runs the rewrite; resolves with a notice to show here (the box stays open), or null (done, or reported in a toast). */
  onSubmit: (instructions: string) => Promise<InlineNotice | null>;
  onCancel: () => void;
  className?: string;
};

export function ChangeItBox({ reviewer, cost, balance, canRun, reason, pending, onSubmit, onCancel, className }: ChangeItBoxProps) {
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState<InlineNotice | null>(null);
  const id = useId();
  const fieldId = `${id}-instructions`;
  const hintId = `${id}-hint`;
  const counterId = `${id}-counter`;
  const instructions = value.trim();
  const blocked = !canRun;
  const ready = instructions.length > 0 && instructions.length <= CHANGE_IT_MAX_CHARS && !pending && !blocked;

  const submit = async () => {
    if (!ready) return;
    setNotice(null);
    setNotice(await onSubmit(instructions));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/⌘ + Enter rewrites; Escape closes the box.
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    } else if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div role="group" aria-labelledby={`${id}-title`} className={cn("rounded-lg border border-ai/30 bg-card p-3", className)}>
      <p id={`${id}-title`} className="flex items-center gap-1.5 text-sm font-semibold text-ai">
        <Sparkles aria-hidden className="size-4" />
        Change it
      </p>
      <label htmlFor={fieldId} className="mt-1 block text-sm text-foreground">
        What should the AI change?<span className="sr-only"> In the reply to {reviewer}</span>
      </label>
      <p id={hintId} className="text-xs text-muted-foreground">
        It rewrites this draft as you ask and keeps to the reply rules. Anything that breaks them, like offers or other contact details, is left out.
      </p>
      <Textarea
        id={fieldId}
        // The box opens from a click on "Change it", so the field takes the focus.
        autoFocus
        rows={2}
        maxLength={CHANGE_IT_MAX_CHARS}
        value={value}
        disabled={pending}
        placeholder="e.g. Make it warmer and mention the new sink"
        aria-describedby={`${hintId} ${counterId}`}
        onChange={(event) => {
          setValue(event.target.value);
          if (notice) setNotice(null);
        }}
        onKeyDown={onKeyDown}
        className="mt-2"
      />
      <p id={counterId} className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
        {value.length.toLocaleString()} / {CHANGE_IT_MAX_CHARS.toLocaleString()}
        <span className="sr-only"> characters</span>
      </p>
      {notice ? (
        <DraftNote tone={notice.tone} role="alert" className="mt-2">
          {notice.message}
        </DraftNote>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ai" disabled={!ready} aria-busy={pending || undefined} title={blocked ? reason : undefined} onClick={() => void submit()}>
          {pending ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Sparkles aria-hidden />}
          {pending ? "Rewriting…" : "Rewrite"}
          <ReplyCostChip cost={cost} variant="inverse" balance={balance} />
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        {blocked && reason ? <span className="text-xs text-muted-foreground">{reason}</span> : null}
      </div>
      {pending ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          The AI rewrites it and checks it again. This can take up to a minute and a half.
        </p>
      ) : null}
    </div>
  );
}
