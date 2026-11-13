/**
 * `AiNextActions`: AI Studio's "Next best actions" list. Rows come from `buildAiNextActions`
 * (`@/lib/ai/ai-next-actions`), so each one is backed by real data and leads to the exact place
 * that does it. AI actions get the violet button and their price; plain steps get an outline
 * button. With nothing to do it celebrates instead ("You're all caught up").
 */
import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarX2,
  CheckCircle2,
  Lightbulb,
  Lock,
  MessageSquareReply,
  PenLine,
  PlugZap,
  Send,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { IconChip } from "@/components/layout/shared/icon-chip";
import type { ModuleTone, StatusTone } from "@/components/layout/shared/module-tone";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiNextAction, AiNextActionId } from "@/lib/ai/ai-next-actions";
import { cn } from "@/lib/utils";
import { AiCostChip } from "./ai-cost-chip";

const LOOK: Record<AiNextActionId, { icon: LucideIcon; tone: ModuleTone; aiTone?: ModuleTone; statusTone?: StatusTone }> = {
  // A read-only or suspended account: a status (amber, with a lock), not a product area.
  account_blocked: { icon: Lock, tone: "settings", statusTone: "warning" },
  connect_google: { icon: PlugZap, tone: "gbp" },
  draft_replies: { icon: MessageSquareReply, tone: "reputation", aiTone: "ai" },
  send_drafts: { icon: Send, tone: "reputation" },
  post_ideas: { icon: PenLine, tone: "posts", aiTone: "ai" },
  series_problem: { icon: CalendarX2, tone: "posts" },
  add_keywords: { icon: Tags, tone: "keywords" },
  insights: { icon: Lightbulb, tone: "ai" },
};

export type AiNextActionsProps = {
  items: readonly AiNextAction[];
  loading?: boolean;
  /** Opens the Google connect dialog (the "connect_google" row). */
  onConnect?: () => void;
  /** The token balance, so price chips warn when it isn't enough. */
  balance?: number;
  title?: string;
  description?: ReactNode;
  className?: string;
};

export function AiNextActions({
  items,
  loading = false,
  onConnect,
  balance,
  title = "Next best actions",
  description = "What to do next for this location, from your reviews, posts and keywords.",
  className,
}: AiNextActionsProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cn("min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 id={titleId} className="flex items-center gap-2 text-[15px] font-semibold leading-6 text-foreground">
            {title}
            {!loading && items.length > 0 ? (
              <span className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-ai px-1.5 text-xs font-semibold tabular-nums text-ai-foreground">
                {items.length}
              </span>
            ) : null}
          </h2>
          {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      {loading ? (
        <ul aria-label="Loading next actions" className="divide-y divide-border">
          {[0, 1, 2].map((row) => (
            <li key={row} className="flex items-center gap-4 px-4 py-4 sm:px-5">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </div>
              <Skeleton className="hidden h-8 w-28 rounded-lg sm:block" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-4 px-4 py-6 sm:px-5">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-success-surface text-success ring-1 ring-inset ring-success/20">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">You're all caught up</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Every review has a reply or a draft, and nothing else needs AI right now.</p>
          </div>
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {items.map((item) => {
            const look = LOOK[item.id];
            const tone = item.ai && look.aiTone ? look.aiTone : look.tone;
            const label = (
              <>
                {item.cta}
                <ArrowRight aria-hidden />
              </>
            );
            return (
              <li key={item.id} className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  <IconChip icon={look.icon} tone={tone} statusTone={look.statusTone} size="md" />
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3 pl-[52px] sm:pl-0">
                  {item.cost !== undefined ? <AiCostChip tokens={item.cost} {...(balance === undefined ? {} : { balance })} /> : null}
                  {item.to ? (
                    <Button asChild size="sm" variant={item.ai ? "ai" : "outline"}>
                      <Link to={item.to}>{label}</Link>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={onConnect} disabled={!onConnect}>
                      {label}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
