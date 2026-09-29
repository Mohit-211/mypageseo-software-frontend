import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, PenLine, RotateCw, Send, ShieldAlert, Sparkles } from "lucide-react";
import { ComparisonControl } from "@/components/layout/shared/data-display";
import { FieldMessage } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  REPLY_TONES,
  REPLY_TONE_LABEL,
  awaitingReply,
  isNegativeReview,
  reviewActions,
  type ReplySettings,
  type ReplyTone,
  type Review,
} from "@/lib/reviews/review-management";
import { cn } from "@/lib/utils";
import { ApprovalRequiredBadge, SentimentBadge, StarRating } from "./review-ui";

export type ReplyMode = "ai" | "manual";

const TONE_OPTIONS = REPLY_TONES.map((t) => ({ value: t, label: REPLY_TONE_LABEL[t] }));

/**
 * Generate, edit and approve a reply. The parent remounts it (via `key`) for
 * each review so its state always starts from that review's draft or reply.
 */
export function AIReplySuggestion({
  review,
  mode: initialMode,
  settings,
  onClose,
}: {
  review: Review | null;
  mode: ReplyMode;
  settings: ReplySettings;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ReplyMode>(initialMode);
  const [tone, setTone] = useState<ReplyTone>(review?.draft?.tone ?? settings.defaultTone);
  const [text, setText] = useState(initialMode === "manual" ? (review?.reply?.text ?? review?.draft?.text ?? "") : (review?.draft?.text ?? ""));
  const [editing, setEditing] = useState(initialMode === "manual");
  // Opens straight into a suggestion when there is no saved draft yet.
  const [autoGenerate] = useState(() => review !== null && initialMode === "ai" && !review.draft);
  const [generating, setGenerating] = useState(autoGenerate);
  const [publishing, setPublishing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [copied, setCopied] = useState(false);
  // Only the newest generation request may write its result.
  const requestRef = useRef(0);
  const variantRef = useRef(0);

  /** Resolves a suggestion; state only changes once the request settles. */
  const requestReply = async (nextTone: ReplyTone) => {
    if (!review) return;
    const request = ++requestRef.current;
    try {
      const reply = await reviewActions.generateReply(review.id, nextTone, variantRef.current++);
      if (request !== requestRef.current) return;
      setText(reply);
      setEditing(false);
    } catch {
      if (request === requestRef.current) toast.error("Couldn't generate a reply", { description: "Try again in a moment." });
    } finally {
      if (request === requestRef.current) setGenerating(false);
    }
  };

  const generate = (nextTone: ReplyTone) => {
    setGenerating(true);
    setApproved(false);
    void requestReply(nextTone);
  };

  useEffect(() => {
    if (autoGenerate) void requestReply(tone);
    return () => {
      requestRef.current += 1;
    };
    // Runs once per mount; the parent remounts for each review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!review) return null;

  const negative = isNegativeReview(review);
  const aiWritten = mode === "ai";
  // Negative reviews are never answered without a person confirming the AI reply.
  const needsApproval = negative && aiWritten;
  const trimmed = text.trim();
  const tooLong = text.length > settings.maxLength;
  const canPublish = trimmed.length > 0 && !tooLong && !generating && !publishing && (!needsApproval || approved);
  const isUpdate = !awaitingReply(review.responseStatus);

  const changeTone = (next: ReplyTone) => {
    setTone(next);
    if (mode === "ai") generate(next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the reply", { description: "Select the text and copy it manually." });
    }
  };

  const saveDraft = () => {
    reviewActions.saveDraft(review.id, trimmed, tone);
    toast.success("Draft saved", { description: negative ? "It's waiting for approval before it can be published." : "You can publish it any time." });
    onClose();
  };

  const publish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    try {
      await reviewActions.publishReply(review.id, { text: trimmed, source: aiWritten ? "ai" : "manual" });
      toast.success(isUpdate ? "Reply updated" : "Reply published", { description: `Your reply to ${review.customerName} was posted to Google.` });
      onClose();
    } catch {
      toast.error("Reply couldn't be published", { description: "Your text is kept here so you can try again." });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !publishing && onClose()}>
      <DialogContent className="gap-5 sm:max-w-2xl">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {mode === "ai" ? <Sparkles className="size-4 text-primary" aria-hidden /> : <PenLine className="size-4 text-primary" aria-hidden />}
            {mode === "ai" ? "AI Reply Suggestion" : isUpdate ? "Edit Reply" : "Write Reply"}
          </DialogTitle>
          <DialogDescription>
            {mode === "ai" ? "Review the suggestion, adjust the tone or edit it, then approve it to publish." : `Reply to ${review.customerName} on Google.`}
          </DialogDescription>
        </DialogHeader>

        <section aria-label="Customer review" className="rounded-lg border border-border bg-surface-strong p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{review.customerName}</span>
              <StarRating rating={review.rating} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <SentimentBadge sentiment={review.analysis?.sentiment ?? null} />
              {negative ? <ApprovalRequiredBadge /> : null}
            </div>
          </div>
          <p className="mt-2 max-h-28 overflow-y-auto text-sm leading-relaxed text-foreground">“{review.text}”</p>
        </section>

        {negative ? (
          <div className="flex gap-3 rounded-lg border border-warning/35 bg-warning-surface p-3 text-sm text-warning-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-semibold">Approval required.</span> Replies to negative reviews are never sent automatically. Read the reply carefully and
              confirm before it's published.
            </p>
          </div>
        ) : null}

        {mode === "ai" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[13px] font-medium text-foreground" id="reply-tone-label">
              Tone
            </span>
            <div className="max-w-full overflow-x-auto" aria-labelledby="reply-tone-label">
              <ComparisonControl value={tone} options={TONE_OPTIONS} onChange={changeTone} ariaLabel="Reply tone" />
            </div>
          </div>
        ) : null}

        <section aria-labelledby="reply-text-label">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label id="reply-text-label" htmlFor="reply-text" className="text-[13px] font-medium text-foreground">
              {mode === "ai" ? "AI Suggested Reply" : "Your Reply"}
            </Label>
            <span className={cn("text-xs tabular", tooLong ? "font-medium text-critical" : "text-muted-foreground")}>
              {text.length}/{settings.maxLength}
            </span>
          </div>

          {generating ? (
            <div role="status" className="rounded-md border border-border bg-surface p-3">
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                Generating reply…
              </p>
              <div className="mt-3 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ) : editing ? (
            <Textarea
              id="reply-text"
              value={text}
              rows={6}
              autoFocus
              placeholder={`Write a reply to ${review.customerName}…`}
              aria-invalid={tooLong ? true : undefined}
              aria-describedby="reply-text-message"
              onChange={(e) => {
                setText(e.target.value);
                setApproved(false);
              }}
            />
          ) : (
            <div
              id="reply-text"
              className="min-h-24 whitespace-pre-line rounded-md border border-primary/25 bg-brand-tint p-3 text-sm leading-relaxed text-foreground"
            >
              {text || <span className="text-muted-foreground">No reply generated yet.</span>}
            </div>
          )}
          <FieldMessage id="reply-text-message" error={tooLong ? `Shorten the reply to ${settings.maxLength} characters or fewer.` : null} />

          <div className="mt-2 flex flex-wrap gap-2">
            {mode === "ai" ? (
              <Button variant="outline" size="sm" onClick={() => generate(tone)} disabled={generating || publishing}>
                <RotateCw aria-hidden /> Regenerate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={generating || publishing}
                onClick={() => {
                  setMode("ai");
                  generate(tone);
                }}
              >
                <Sparkles aria-hidden /> Generate with AI
              </Button>
            )}
            {mode === "ai" ? (
              <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)} disabled={generating || publishing || !text}>
                {editing ? <Check aria-hidden /> : <PenLine aria-hidden />}
                {editing ? "Done Editing" : "Edit Reply"}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void copy()} disabled={generating || !text}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </section>

        {needsApproval ? (
          <label htmlFor="reply-approved" className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3 text-sm text-foreground has-data-[state=checked]:border-primary/40 has-data-[state=checked]:bg-brand-tint">
            <Checkbox id="reply-approved" checked={approved} disabled={generating || !trimmed} onCheckedChange={(c) => setApproved(c === true)} className="mt-0.5" />
            I've read this reply and approve it for publishing on Google.
          </label>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={publishing}>
            Cancel
          </Button>
          {!isUpdate ? (
            <Button variant="outline" onClick={saveDraft} disabled={!trimmed || tooLong || generating || publishing}>
              Save Draft
            </Button>
          ) : null}
          <Button onClick={() => void publish()} disabled={!canPublish}>
            {publishing ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {publishing ? "Publishing…" : mode === "ai" ? "Approve & Reply" : isUpdate ? "Update Reply" : "Publish Reply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
