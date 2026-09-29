import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, PenLine, RefreshCw, Sparkles } from "lucide-react";
import { ComparisonControl, Panel } from "@/components/layout/shared/data-display";
import { FieldMessage, FormTextField } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AI_TONE_LABEL, GBP_POST_MAX_CHARS, generateAiPostCopy, type AiTone } from "@/lib/gbp/ai-posts";
import type { LocationSummary } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";
import { AiIndicator } from "../post-ui";
import { FORM_TOAST, type FormSectionProps } from "./form-model";

const TONES: AiTone[] = ["friendly", "professional", "promotional"];

export function AIContentGenerator({
  form,
  onChange,
  errors,
  location,
}: FormSectionProps & { location: LocationSummary | null }) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [variant, setVariant] = useState(0);
  const hasContent = form.content.trim().length > 0 || editing;
  const blockedReason = !location ? "Choose a business profile first." : !form.topic.trim() ? "Add a post topic first." : null;
  const count = form.content.length;
  const over = count > GBP_POST_MAX_CHARS;

  const generate = async () => {
    if (!location || blockedReason) {
      toast.error("Can't generate yet", { ...FORM_TOAST, description: blockedReason ?? undefined });
      return;
    }
    setGenerating(true);
    setEditing(false);
    try {
      const copy = await generateAiPostCopy({
        topic: form.topic,
        type: form.type,
        businessName: location.businessName,
        area: location.area,
        tone: form.tone,
        variant,
      });
      setVariant((v) => v + 1);
      onChange({ title: copy.title, content: copy.content, aiGenerated: true });
      toast.success(hasContent ? "New version generated" : "Post text generated", {
        ...FORM_TOAST,
        description: "Review the copy before scheduling.",
      });
    } catch {
      toast.error("AI couldn't generate the post", { ...FORM_TOAST, description: "Try again in a moment." });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Panel
      title="Post content"
      description="Let AI write the post, then fine-tune it."
      actions={<AiIndicator label="AI writer" />}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Tone</span>
          <ComparisonControl
            ariaLabel="Writing tone"
            value={form.tone}
            onChange={(tone) => onChange({ tone })}
            options={TONES.map((value) => ({ value, label: AI_TONE_LABEL[value] }))}
          />
        </div>

        {generating ? (
          <div role="status" className="space-y-3 rounded-md border border-primary/20 bg-brand-tint p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Writing your post…
            </p>
            <Skeleton className="h-4 w-2/3 bg-brand-tint-strong" />
            <Skeleton className="h-3 w-full bg-brand-tint-strong" />
            <Skeleton className="h-3 w-full bg-brand-tint-strong" />
            <Skeleton className="h-3 w-4/5 bg-brand-tint-strong" />
          </div>
        ) : !hasContent ? (
          <div
            className={cn(
              "flex flex-col items-center rounded-md border border-dashed px-6 py-8 text-center",
              errors.content ? "border-critical/50 bg-critical-surface/40" : "border-primary/25 bg-brand-tint",
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-foreground">Let AI write your post</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              We'll write an on-brand Google post from your topic, type and tone.
            </p>
            <Button className="mt-4" size="lg" onClick={generate} disabled={blockedReason !== null}>
              <Sparkles aria-hidden /> Generate with AI
            </Button>
            {blockedReason ? <p className="mt-2 text-xs text-muted-foreground">{blockedReason}</p> : null}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-3 text-xs font-medium text-primary hover:underline"
            >
              or write it yourself
            </button>
            <FieldMessage error={errors.content} />
          </div>
        ) : (
          <div className="space-y-4">
            <FormTextField
              id="post-title"
              label="Title"
              required
              value={form.title}
              onChange={(title) => onChange({ title })}
              error={errors.title}
              placeholder="Short, specific post title"
              maxLength={80}
            />
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  Post text{" "}
                  <span className="text-critical" aria-hidden>
                    *
                  </span>
                  {form.aiGenerated ? <AiIndicator label="AI generated" /> : null}
                </span>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
                    {editing ? <Check aria-hidden /> : <PenLine aria-hidden />}
                    {editing ? "Done" : "Edit text"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={generate} disabled={blockedReason !== null}>
                    <RefreshCw aria-hidden /> Regenerate
                  </Button>
                </div>
              </div>
              {editing ? (
                <Textarea
                  id="post-content"
                  aria-label="Post text"
                  rows={8}
                  autoFocus
                  value={form.content}
                  onChange={(e) => onChange({ content: e.target.value })}
                  aria-invalid={errors.content || over ? true : undefined}
                  className="mt-1.5"
                  placeholder="What should customers know?"
                />
              ) : (
                <div
                  className="mt-1.5 cursor-text whitespace-pre-line rounded-md border border-border bg-surface-strong/60 px-3 py-2.5 text-sm leading-relaxed text-foreground"
                  onDoubleClick={() => setEditing(true)}
                >
                  {form.content}
                </div>
              )}
              <div className="mt-1.5 flex items-start justify-between gap-3">
                <FieldMessage
                  error={errors.content ?? (over ? "Google limits posts to 1,500 characters." : null)}
                  hint="Tip: keep key details in the first 100 characters."
                />
                <span className={cn("shrink-0 text-xs tabular", over ? "font-medium text-critical" : "text-muted-foreground")}>
                  {count.toLocaleString()} / {GBP_POST_MAX_CHARS.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
