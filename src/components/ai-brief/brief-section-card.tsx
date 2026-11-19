import { useState } from "react";
import { ChevronDown, Pencil, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { BriefFaq, BriefPillar, BriefSection, BriefService, BriefSource } from "@/api";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  BRIEF_SECTION_COPY,
  briefChangeErrorText,
  briefItemTitle,
  isWebUrl,
  itemOwnerTag,
  pageLabel,
  type BriefItem,
} from "@/lib/ai-brief/brief";
import { useBriefMutations } from "@/lib/ai-brief/use-brief";
import { cn } from "@/lib/utils";
import { BriefItemDialog } from "./brief-item-dialog";
import { EvidenceQuotes, ExternalTextLink, ItemActionsMenu, type ItemAction } from "./brief-parts";

/**
 * One section of the business brief (services, what sets the business apart, FAQs, who it serves, areas, post
 * themes, what never to say): its items with the quotes they were found with, the owner's tags ("Edited by you",
 * "Added by you"), and for owners and members Add, Edit, "Use the website's words" (reset) and Remove. A removed
 * website item stays under "Removed" (the AI never sees it; "Bring it back" hands it back to the AI); an item the
 * owner added is deleted, after a confirmation.
 */
export function BriefSectionCard({
  locationId,
  section,
  items,
  sources,
  canEdit,
  className,
}: {
  locationId: string;
  section: BriefSection;
  items: readonly BriefItem[];
  sources: readonly BriefSource[];
  canEdit: boolean;
  className?: string;
}) {
  const { patch } = useBriefMutations(locationId);
  const copy = BRIEF_SECTION_COPY[section];
  const [dialog, setDialog] = useState<{ item: BriefItem | null } | null>(null);
  const [deleting, setDeleting] = useState<BriefItem | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const shown = items.filter((item) => !item.removed);
  const removed = items.filter((item) => item.removed);
  const titleId = `brief-${section}-title`;

  const change = (item: BriefItem, kind: "remove" | "reset", success: string) =>
    patch.mutate(
      { items: [{ section, id: item.id, ...(kind === "remove" ? { remove: true as const } : { reset: true as const }) }] },
      {
        onSuccess: () => {
          setDeleting(null);
          toast.success(success);
        },
        onError: (err) => toast.error(briefChangeErrorText(err).text),
      },
    );

  const actionsFor = (item: BriefItem): ItemAction[] => {
    const actions: ItemAction[] = [{ label: "Edit", icon: <Pencil aria-hidden />, onSelect: () => setDialog({ item }) }];
    if (item.origin === "website" && item.locked) {
      actions.push({
        label: "Use the website's words",
        icon: <RotateCcw aria-hidden />,
        onSelect: () => change(item, "reset", "Back to the website's words. The next build words it afresh."),
      });
    }
    actions.push({
      label: "Remove",
      icon: <Trash2 aria-hidden />,
      destructive: true,
      onSelect: () =>
        item.origin === "owner"
          ? setDeleting(item)
          : change(item, "remove", "Removed. The AI won't use it, and rebuilds won't bring it back."),
    });
    return actions;
  };

  return (
    <section aria-labelledby={titleId} className={cn("min-w-0 rounded-xl border border-border bg-card shadow-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-[1_1_14rem]">
          <h2 id={titleId} className="text-[15px] font-semibold leading-6 text-foreground">
            {copy.title} <span className="font-medium text-muted-foreground">· {shown.length}</span>
          </h2>
          <p className="text-[13px] text-muted-foreground">{copy.description}</p>
        </div>
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ item: null })}>
            <Plus aria-hidden /> {copy.add}
          </Button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">{copy.empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <ItemBody section={section} item={item} />
                <EvidenceQuotes evidence={item.evidence} sources={sources} />
              </div>
              {canEdit ? <ItemActionsMenu label={`Actions for “${briefItemTitle(section, item)}”`} actions={actionsFor(item)} disabled={patch.isPending} /> : null}
            </li>
          ))}
        </ul>
      )}

      {removed.length > 0 ? (
        <div className="border-t border-border px-4 py-2 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={showRemoved}
            onClick={() => setShowRemoved((value) => !value)}
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            Removed ({removed.length}) <ChevronDown aria-hidden className={cn("transition-transform motion-reduce:transition-none", showRemoved && "rotate-180")} />
          </Button>
          {showRemoved ? (
            <ul className="mt-1 space-y-1 pb-2">
              {removed.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-strong px-3 py-2">
                  <span className="min-w-0 break-words text-sm text-muted-foreground">{briefItemTitle(section, item)}</span>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={patch.isPending}
                      onClick={() => change(item, "reset", "Brought back. The AI uses it again.")}
                    >
                      <Undo2 aria-hidden /> Bring it back
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {dialog ? <BriefItemDialog locationId={locationId} section={section} item={dialog.item} onClose={() => setDialog(null)} /> : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={`Delete this ${copy.noun}?`}
        description={deleting ? `“${briefItemTitle(section, deleting)}” is one you added, so it's deleted and the AI stops using it.` : ""}
        confirmLabel="Delete"
        pending={patch.isPending}
        onConfirm={() => (deleting ? change(deleting, "remove", "Deleted. The AI stops using it.") : undefined)}
      />
    </section>
  );
}

/** An item's words: a service with its details and page, a question with its answer, a theme, or a line. */
function ItemBody({ section, item }: { section: BriefSection; item: BriefItem }) {
  const tag = itemOwnerTag(item);
  const tagBadge = tag ? (
    <StatusBadge tone="info" size="sm">
      {tag}
    </StatusBadge>
  ) : null;

  if (section === "services") {
    const service = item as BriefService;
    const facts = [
      service.audience ? ["For", service.audience] : null,
      service.problems?.length ? ["Solves", service.problems.join("; ")] : null,
      service.seasonality ? ["When", service.seasonality] : null,
    ].filter((entry): entry is string[] => entry !== null);
    return (
      <>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
          <span className="min-w-0 break-words">{service.name}</span>
          {tagBadge}
        </p>
        {service.summary ? <p className="mt-0.5 break-words text-sm text-foreground">{service.summary}</p> : null}
        {service.details?.length ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted-foreground marker:text-border-strong">
            {service.details.map((detail) => (
              <li key={detail} className="break-words">
                {detail}
              </li>
            ))}
          </ul>
        ) : null}
        {facts.length ? (
          <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {facts.map(([term, value]) => (
              <div key={term} className="flex gap-1.5">
                <dt className="shrink-0 font-medium text-foreground">{term}:</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {isWebUrl(service.page_url) ? (
          <p className="mt-1 text-xs">
            <span className="text-muted-foreground">Its page: </span>
            <ExternalTextLink href={service.page_url} className="text-xs">
              {pageLabel(service.page_url)}
            </ExternalTextLink>
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">No page of its own yet: posts about it get no “Learn more” link.</p>
        )}
      </>
    );
  }
  if (section === "faqs") {
    const faq = item as BriefFaq;
    return (
      <>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
          <span className="min-w-0 break-words">{faq.question}</span>
          {tagBadge}
        </p>
        <p className="mt-0.5 break-words text-sm text-foreground">{faq.answer}</p>
      </>
    );
  }
  if (section === "pillars") {
    const pillar = item as BriefPillar;
    return (
      <>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
          <span className="min-w-0 break-words">{pillar.name}</span>
          {tagBadge}
        </p>
        <p className="mt-0.5 break-words text-sm text-muted-foreground">{pillar.description}</p>
      </>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
      <span className="min-w-0 break-words">{briefItemTitle(section, item)}</span>
      {tagBadge}
    </p>
  );
}
