import { Fragment, type ReactNode } from "react";
import { format } from "date-fns";
import { Loader2, RotateCw } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AI_PLATFORM_LABEL,
  TOPIC_LABEL,
  type AiPlatform,
  type PromptCheck,
  type TrackedPrompt,
} from "@/lib/ai-visibility/ai-visibility";
import { cn } from "@/lib/utils";
import { PlatformIcon, SampleDataBadge } from "../visibility-ui";

/** Wraps each occurrence of `term` in a highlight. */
function highlight(text: string, term: string): ReactNode {
  if (!term) return text;
  const parts = text.split(term);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? (
        <mark className="rounded-sm bg-brand-tint-strong px-0.5 font-semibold text-foreground ring-1 ring-primary/30">{term}</mark>
      ) : null}
    </Fragment>
  ));
}

/** Renders plain-text AI answers: paragraphs, with "1. …" lines as an ordered list. */
function ResponseBody({ text, businessName }: { text: string; businessName: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i} className="list-decimal space-y-2 pl-5 marker:text-muted-foreground">
              {lines.map((line, j) => (
                <li key={j}>{highlight(line.replace(/^\d+\.\s/, ""), businessName)}</li>
              ))}
            </ol>
          );
        }
        return <p key={i}>{highlight(block, businessName)}</p>;
      })}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function PromptDetail({
  prompt,
  check,
  siblings,
  businessName,
  onSelectPlatform,
  onRunAgain,
  onClose,
}: {
  prompt: TrackedPrompt | null;
  check: PromptCheck | null;
  /** Results for the same prompt on other platforms. */
  siblings: PromptCheck[];
  businessName: string;
  onSelectPlatform: (platform: AiPlatform) => void;
  onRunAgain: () => void;
  onClose: () => void;
}) {
  const open = prompt !== null && check !== null;
  const running = check?.status === "checking";

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {prompt && check ? (
          <>
            <SheetHeader className="border-b border-border px-5 py-4 pr-12 text-left">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prompt</p>
              <SheetTitle className="text-base leading-snug">“{prompt.prompt}”</SheetTitle>
              <SheetDescription>{TOPIC_LABEL[prompt.topic]}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 px-5 py-4">
              {siblings.length > 1 ? (
                <div role="tablist" aria-label="AI platform" className="flex flex-wrap gap-1.5">
                  {siblings.map((s) => (
                    <button
                      key={s.platform}
                      type="button"
                      role="tab"
                      aria-selected={s.platform === check.platform}
                      onClick={() => onSelectPlatform(s.platform)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        s.platform === check.platform
                          ? "border-primary bg-brand-tint text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <PlatformIcon platform={s.platform} size="sm" className="size-5" />
                      {AI_PLATFORM_LABEL[s.platform]}
                    </button>
                  ))}
                </div>
              ) : null}

              <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface-strong p-4 sm:grid-cols-3">
                <Fact label="Checked">{check.checkedAt ? format(new Date(check.checkedAt), "MMMM d, yyyy") : "Pending"}</Fact>
                <Fact label="AI Platform">{AI_PLATFORM_LABEL[check.platform]}</Fact>
                <Fact label="Business Mentioned">
                  {check.mentioned === null ? "—" : check.mentioned ? <StatusBadge tone="success">Yes</StatusBadge> : <StatusBadge>No</StatusBadge>}
                </Fact>
                <Fact label="Position">{check.position ? `#${check.position}` : "—"}</Fact>
                <Fact label="Visibility">{check.visibility === null ? "—" : `${check.visibility}%`}</Fact>
                <Fact label="Check frequency">{prompt.frequency[0]!.toUpperCase() + prompt.frequency.slice(1)}</Fact>
              </dl>

              <section aria-labelledby="ai-response-heading">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="ai-response-heading" className="text-sm font-semibold text-foreground">
                    AI Response
                  </h3>
                  {check.response?.isSample ? <SampleDataBadge /> : null}
                </div>
                <div className={cn("rounded-lg border border-border bg-surface p-4 shadow-card", running && "opacity-60")}>
                  <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
                    <PlatformIcon platform={check.platform} size="sm" />
                    <span className="text-xs font-medium text-muted-foreground">{AI_PLATFORM_LABEL[check.platform]} answered</span>
                  </div>
                  {check.response ? (
                    <ResponseBody text={check.response.text} businessName={businessName} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No response has been collected yet.</p>
                  )}
                </div>
                {check.response?.isSample ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    This response is sample data shown for preview. Real answers appear once an AI provider is connected.
                  </p>
                ) : null}
              </section>

              <section aria-labelledby="mention-summary-heading" className="rounded-lg border border-border p-4">
                <h3 id="mention-summary-heading" className="text-sm font-semibold text-foreground">
                  Mention summary
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-4">
                  <Fact label="Business Mention">{check.mentioned === null ? "—" : check.mentioned ? "Yes" : "No"}</Fact>
                  <Fact label="Mention Position">{check.position ?? "—"}</Fact>
                </dl>
                <div className="mt-4">
                  <p className="text-[11px] text-muted-foreground">Competitors Mentioned</p>
                  {check.response && check.response.competitorsMentioned.length > 0 ? (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {check.response.competitorsMentioned.map((name) => (
                        <li key={name}>
                          <StatusBadge>{name}</StatusBadge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-0.5 text-sm text-foreground">None</p>
                  )}
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-surface px-5 py-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={onRunAgain} disabled={running}>
                {running ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
                {running ? "Running…" : "Run Again"}
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
