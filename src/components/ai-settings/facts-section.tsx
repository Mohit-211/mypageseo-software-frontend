import { useEffect, useRef, useState, type RefObject } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgePercent,
  BookOpenText,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  Lightbulb,
  Pencil,
  Plus,
  Ticket,
  Trash2,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { AiFact, AiFactKind, AiFactsList } from "@/api";
import { ErrorState, ListSkeleton, EmptyState } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog, FormAlert } from "@/components/layout/shared/form-fields";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { factErrorText, isFactGone, isNotAvailableYet } from "@/lib/ai-settings/errors";
import {
  FACT_KINDS,
  FACT_KIND_COPY,
  FACT_LIMITS,
  FACT_TIMING_COPY,
  factHeadline,
  formatFactDates,
  hiddenReason,
  isDatedKind,
  isFromBrief,
  offersRefusedText,
} from "@/lib/ai-settings/fact-form";
import { useAiFactMutations } from "@/lib/ai-settings/use-ai-settings";
import { cn } from "@/lib/utils";
import { FactDialog } from "./fact-dialog";

const KIND_ICON: Record<AiFactKind, LucideIcon> = { fact: Lightbulb, offer: BadgePercent, event: CalendarDays, contest: Trophy };

/**
 * True when keyboard focus has nowhere useful to be: on <body>, on an element that was removed, still
 * in the closing "Delete this …?" dialog, or on the page's heading (where dialogs send it when the
 * button that opened them is gone).
 */
function focusIsLost(): boolean {
  const active = document.activeElement;
  return (
    !active ||
    active === document.body ||
    !active.isConnected ||
    active.closest('[role="alertdialog"]') !== null ||
    active.matches("[data-page-header] h1")
  );
}

/**
 * After a delete, once its row is gone: focus the next row's Edit, else "Add" (when it can be used),
 * else the section's heading. `focus()` scrolls it into view, so focus never lands off screen. Focus
 * the user has since moved somewhere else stays where it is.
 */
function focusAfterDelete(root: HTMLElement | null, nextId: string | null): void {
  if (!root || !focusIsLost()) return;
  const next = nextId ? root.querySelector<HTMLElement>(`[data-fact-edit="${CSS.escape(nextId)}"]`) : null;
  const add = root.querySelector<HTMLElement>("[data-facts-add]:not(:disabled)");
  const section = root.closest("section[aria-labelledby]");
  const heading = section ? document.getElementById(section.getAttribute("aria-labelledby") ?? "") : null;
  (next ?? add ?? heading)?.focus();
}

/**
 * True while `ref`'s text is cut off by its line clamp, measured as the box is laid out or resized
 * (`text` measures it again after an edit). Not measured while `measure` is false (shown in full).
 */
function useClamped(ref: RefObject<HTMLElement | null>, text: string | null | undefined, measure: boolean): boolean {
  const [clamped, setClamped] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !text || !measure) return;
    // A pixel of slack: fractional line heights never quite match.
    const observer = new ResizeObserver(() => setClamped(element.scrollHeight > element.clientHeight + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, text, measure]);
  return clamped;
}

/**
 * "Facts for the AI" (`#facts`): the business's own facts, offers, events and contests, newest
 * first. Each shows its dates and timing, whether the AI sees it now (and why not: switched off,
 * over, or an offer the AI can't use, `offer_refusal`), a "From the brief" tag for a fact confirmed
 * from the business brief, and a switch that keeps it from the AI; Add / Edit / Delete for people who
 * can edit. Offers are left out of "Add" where Google refuses them (lodging, a regulated product).
 */
export function FactsSection({ locationId, facts, canEdit }: { locationId: string; facts: UseQueryResult<AiFactsList, unknown>; canEdit: boolean }) {
  const { update, remove } = useAiFactMutations(locationId);
  const [dialog, setDialog] = useState<{ kind: AiFactKind; fact: AiFact | null } | null>(null);
  // The fact asked about stays set while the dialog closes, so its words don't change mid-animation.
  const [deleting, setDeleting] = useState<AiFact | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Facts whose switch is being saved (each toggle is its own request).
  const [switching, setSwitching] = useState<ReadonlySet<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  // A delete takes its row, and the focused Delete button, away: which fact is going and the one after
  // it, so focus can move on once the row has left the list (see `focusAfterDelete`).
  const deleteFocus = useRef<{ deleted: string; next: string | null } | null>(null);

  // Data first: a failed background refresh keeps the list on screen.
  const list = facts.data;
  const shown = list?.facts;
  useEffect(() => {
    const pending = deleteFocus.current;
    if (!pending || !shown || shown.some((fact) => fact.fact_id === pending.deleted)) return;
    deleteFocus.current = null;
    focusAfterDelete(rootRef.current, pending.next);
  }, [shown]);

  if (!list) {
    if (!facts.isError) return <ListSkeleton rows={3} className="shadow-none" />;
    return isNotAvailableYet(facts.error) ? (
      <EmptyState
        variant="unavailable"
        tone="ai"
        compact
        title="Facts for the AI arrive with the next update"
        description="You can add your facts, offers, events and contests here once it's live."
      />
    ) : (
      <ErrorState compact className="shadow-none" description="Your facts for the AI couldn't be loaded. Nothing was changed." onRetry={() => void facts.refetch()} />
    );
  }

  const limit = list.limit || FACT_LIMITS.perLocation;
  const full = list.total >= limit;
  const refused = offersRefusedText(list.offers);
  const kinds = FACT_KINDS.filter((kind) => kind !== "offer" || list.offers.allowed);
  const seen = list.facts.filter((fact) => fact.in_fact_sheet).length;

  // `mutateAsync` answers every call (a second toggle doesn't swallow the first one's result).
  const setActive = async (fact: AiFact, active: boolean) => {
    setSwitching((current) => new Set(current).add(fact.fact_id));
    try {
      const next = await update.mutateAsync({ factId: fact.fact_id, patch: { active } });
      toast.success(active ? `The AI may use “${factHeadline(next)}”.` : `The AI won't use “${factHeadline(next)}”.`, {
        description: active && !next.in_fact_sheet ? "It's over, so the AI still won't see it." : undefined,
      });
    } catch (err) {
      toast.error(factErrorText(err, "This couldn't be switched. Try again."));
    } finally {
      setSwitching((current) => {
        const next = new Set(current);
        next.delete(fact.fact_id);
        return next;
      });
    }
  };

  const addMenu = canEdit ? (
    <AddMenu kinds={kinds} disabled={full} onPick={(kind) => setDialog({ kind, fact: null })} />
  ) : null;

  return (
    <div ref={rootRef} className="space-y-4">
      {list.facts.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{list.total.toLocaleString()}</span> of {limit} ·{" "}
            <span className="font-semibold tabular-nums text-foreground">{seen.toLocaleString()}</span> the AI can use now
          </p>
          {addMenu}
        </div>
      ) : null}

      {canEdit && full ? <FormAlert tone="info">You can keep up to {limit}. Delete one to add another.</FormAlert> : null}
      {canEdit && refused ? <FormAlert tone="info">{refused}</FormAlert> : null}

      {list.facts.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          tone="ai"
          compact
          title="No facts for the AI yet"
          description={
            canEdit
              ? "Prices, percentages, offer dates and staff names in AI text come only from here. Add the facts, offers, events and contests the AI may use."
              : "Prices, percentages, offer dates and staff names in AI text come only from here. Your agency adds them."
          }
          action={addMenu}
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {list.facts.map((fact) => (
            <FactRow
              key={fact.fact_id}
              fact={fact}
              list={list}
              canEdit={canEdit}
              switching={switching.has(fact.fact_id)}
              onActive={(active) => void setActive(fact, active)}
              onEdit={() => setDialog({ kind: fact.kind, fact })}
              onDelete={() => {
                setDeleting(fact);
                setConfirmDelete(true);
              }}
            />
          ))}
        </ul>
      )}

      {dialog ? (
        <FactDialog
          key={dialog.fact?.fact_id ?? dialog.kind}
          locationId={locationId}
          kind={dialog.kind}
          fact={dialog.fact}
          today={list.now?.date ?? list.today ?? null}
          nowTime={list.now?.time ?? null}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={deleting ? `Delete this ${FACT_KIND_COPY[deleting.kind].label.toLowerCase()}?` : "Delete it?"}
        description={deleting ? `“${factHeadline(deleting)}” is removed and the AI stops using it. This can't be undone.` : ""}
        confirmLabel="Delete"
        pending={remove.isPending}
        onConfirm={() => {
          const target = deleting;
          if (!target) return;
          const at = list.facts.findIndex((fact) => fact.fact_id === target.fact_id);
          deleteFocus.current = { deleted: target.fact_id, next: at >= 0 ? (list.facts[at + 1]?.fact_id ?? null) : null };
          remove.mutate(target.fact_id, {
            onSuccess: () => toast.success(`${FACT_KIND_COPY[target.kind].label} deleted.`),
            onError: (err) => {
              // Still listed: focus stays on its Delete button. Deleted elsewhere: the list is read
              // again, its row goes, and focus moves on as after a delete.
              if (!isFactGone(err)) deleteFocus.current = null;
              toast.error(factErrorText(err, "It couldn't be deleted. Try again."));
            },
          });
        }}
      />
    </div>
  );
}

/** "Add" with the kinds this business may add (no offers where Google refuses them). */
function AddMenu({ kinds, disabled, onPick }: { kinds: readonly AiFactKind[]; disabled: boolean; onPick: (kind: AiFactKind) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled} data-facts-add="">
          <Plus aria-hidden /> Add <ChevronDown aria-hidden className="-mr-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
        {kinds.map((kind) => {
          const Icon = KIND_ICON[kind];
          return (
            <DropdownMenuItem key={kind} onSelect={() => onPick(kind)} className="items-start py-2.5">
              <Icon aria-hidden className="mt-0.5" />
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{FACT_KIND_COPY[kind].label}</span>
                <span className="block text-xs text-muted-foreground">{FACT_KIND_COPY[kind].description}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FactRow({
  fact,
  list,
  canEdit,
  switching,
  onActive,
  onEdit,
  onDelete,
}: {
  fact: AiFact;
  list: AiFactsList;
  canEdit: boolean;
  switching: boolean;
  onActive: (active: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const headline = factHeadline(fact);
  const timing = fact.timing ? FACT_TIMING_COPY[fact.timing] : null;
  const dates = formatFactDates(fact.start, fact.end, list.now?.date ?? list.today);
  const hidden = hiddenReason(fact, list.offers);
  const details = (isDatedKind(fact.kind) ? fact.text?.trim() : null) || null;
  const terms = fact.terms?.trim() || null;
  const switchId = `fact-active-${fact.fact_id}`;
  // Details (up to 300 characters) and an offer's terms (up to 5,000) are clamped to two lines and one;
  // "Show more" opens both in full. Everyone gets it: a client user has no Edit dialog to read them in.
  const [expanded, setExpanded] = useState(false);
  const detailsRef = useRef<HTMLParagraphElement>(null);
  const termsRef = useRef<HTMLSpanElement>(null);
  const detailsCut = useClamped(detailsRef, details, !expanded);
  const termsCut = useClamped(termsRef, terms, !expanded);
  const canExpand = expanded || (details !== null && detailsCut) || (terms !== null && termsCut);
  const detailsId = `fact-${fact.fact_id}-details`;
  const termsId = `fact-${fact.fact_id}-terms`;
  const moreLabel = expanded ? "Show less" : "Show more";

  return (
    <li className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconChip icon={KIND_ICON[fact.kind]} tone="posts" size="md" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {FACT_KIND_COPY[fact.kind].label}
              {fact.kind === "fact" && fact.topic ? ` · ${fact.topic}` : ""}
            </span>
            {timing ? (
              <StatusBadge tone={timing.tone} size="sm" dot>
                {timing.label}
              </StatusBadge>
            ) : null}
            {isFromBrief(fact) ? (
              <StatusBadge tone="neutral" size="sm" icon={BookOpenText}>
                From the brief
              </StatusBadge>
            ) : null}
            {fact.in_fact_sheet ? (
              <StatusBadge tone="ai" size="sm" icon={Eye}>
                AI sees this
              </StatusBadge>
            ) : (
              <>
                <StatusBadge tone="neutral" size="sm" icon={EyeOff}>
                  Hidden from the AI
                </StatusBadge>
                {hidden ? <span className="text-xs text-muted-foreground">{hidden}</span> : null}
              </>
            )}
          </div>
          <p className="mt-1 whitespace-pre-line break-words text-sm font-medium text-foreground">{headline}</p>
          {details ? (
            <p
              ref={detailsRef}
              id={detailsId}
              className={cn("mt-0.5 whitespace-pre-line break-words text-sm text-muted-foreground", !expanded && "line-clamp-2")}
            >
              {details}
            </p>
          ) : null}
          {dates || fact.coupon_code || fact.redeem_url || fact.terms_url || terms ? (
            // The links and "Show more" sit side by side, or a line of terms apart, which keeps their
            // invisible hit areas from overlapping.
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {dates ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays aria-hidden className="size-3.5 shrink-0" />
                  {dates}
                </span>
              ) : null}
              {fact.coupon_code ? (
                <span className="inline-flex items-center gap-1">
                  <Ticket aria-hidden className="size-3.5 shrink-0" />
                  Code <span className="font-mono font-medium text-foreground">{fact.coupon_code}</span>
                </span>
              ) : null}
              {fact.redeem_url ? <ExternalTextLink href={fact.redeem_url}>Redeem link</ExternalTextLink> : null}
              {fact.terms_url ? <ExternalTextLink href={fact.terms_url}>Rules</ExternalTextLink> : null}
              {terms ? (
                <span ref={termsRef} id={termsId} className={cn("max-w-full whitespace-pre-line break-words", !expanded && "line-clamp-1")}>
                  Terms: {terms}
                </span>
              ) : null}
              {canExpand ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  aria-expanded={expanded}
                  aria-controls={[details ? detailsId : null, terms ? termsId : null].filter(Boolean).join(" ") || undefined}
                  aria-label={`${moreLabel} of “${headline}”`}
                  onClick={() => setExpanded((value) => !value)}
                  // An inline link in small print: the invisible hit area makes it about 40px tall.
                  className="relative h-auto gap-1 p-0 text-xs font-medium after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-[''] [&_svg]:size-3.5"
                >
                  {moreLabel}
                  <ChevronDown aria-hidden className={cn("transition-transform motion-reduce:transition-none", expanded && "rotate-180")} />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/*
        Touch screens: the switch's invisible hit area reaches 10px above and below it, the links' and
        "Show more"'s 12px. The extra space keeps them from overlapping when this column sits under the
        text (phones), and keeps the switch's from overlapping Edit and Delete when they wrap below it.
      */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 pl-12 pointer-coarse:gap-y-3 max-sm:pointer-coarse:mt-2.5 sm:flex-col sm:items-end sm:pl-0">
        <div className="flex items-center gap-2">
          <label htmlFor={switchId} className="text-xs font-medium text-foreground">
            AI may use it
          </label>
          <Switch
            id={switchId}
            checked={fact.active}
            disabled={!canEdit || switching}
            aria-label={`AI may use “${headline}”`}
            onCheckedChange={onActive}
          />
        </div>
        {canEdit ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit “${headline}”`} data-fact-edit={fact.fact_id}>
              <Pencil aria-hidden /> Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete “${headline}”`} className="text-critical hover:bg-critical-surface hover:text-critical">
              <Trash2 aria-hidden /> Delete
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** A link in a row's small print; the invisible hit area (as on "Withdraw") makes it about 40px tall. */
function ExternalTextLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="relative inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-2 outline-hidden after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-[''] hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <ExternalLink aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
