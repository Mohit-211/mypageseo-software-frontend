import { useState } from "react";
import { Link } from "react-router-dom";
import { Filter, FolderPlus, FolderTree, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { GroupSummary, KeywordGroup, RankStatusText } from "@/api";
import { SectionHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { AvgRankPill, RankChange } from "@/components/ranking/rank-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { groupErrorText, useGroupMutations } from "@/lib/keywords/groups";
import { keywordKey } from "@/lib/keywords/keywords";
import { rankingsPagePath } from "@/lib/keywords/paths";
import { formatRate } from "@/lib/rankings/format";
import { byNumber, sortRows } from "@/lib/sort";

/** One of a group card's three footer actions (equal cells, the whole cell is the target). */
const FOOTER_ACTION =
  "flex min-h-10 cursor-pointer items-center justify-center gap-1 px-2 py-2 text-center text-primary outline-hidden transition-colors first:rounded-bl-xl last:rounded-br-xl hover:bg-accent hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/**
 * Keyword groups (`#groups`): named sets of keywords, A–Z, each with how it ranks in the latest run
 * and links to the ranking pages filtered to it. Creating and editing open `GroupDialog` (owned by
 * the page, so the keyword table can open it too).
 */
export function KeywordGroupsSection({
  locationId,
  groups,
  limit,
  loading,
  error,
  onRetry,
  summaries,
  statusText,
  tracked,
  canEdit,
  onNew,
  onEdit,
  onShowInList,
}: {
  locationId: string;
  /** A–Z. */
  groups: readonly KeywordGroup[];
  limit: number;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** The latest run's group summaries. */
  summaries: readonly GroupSummary[];
  statusText?: RankStatusText | undefined;
  /** Tracked keywords in the saved order (keyword chips follow it). */
  tracked: readonly string[];
  canEdit: boolean;
  onNew: () => void;
  onEdit: (group: KeywordGroup) => void;
  onShowInList: (group: KeywordGroup) => void;
}) {
  const mutations = useGroupMutations(locationId);
  const [deleting, setDeleting] = useState<KeywordGroup | null>(null);
  const full = groups.length >= limit;
  const position = new Map(tracked.map((keyword, index) => [keywordKey(keyword), index]));

  const remove = async (group: KeywordGroup) => {
    try {
      await mutations.remove(group.group_id);
      toast.success(`“${group.name}” deleted`, { description: "Its keywords are still tracked." });
    } catch (err) {
      toast.error(groupErrorText(err, "The group couldn't be deleted. Try again."));
    }
  };

  return (
    <section id="groups" aria-label="Keyword groups" className="scroll-mt-20">
      <SectionHeader
        icon={FolderTree}
        tone="keywords"
        title="Keyword groups"
        description={
          <>
            Group keywords, for example by service, to filter the ranking pages and compare groups. Free, up to {limit}.
            {groups.length > 0 ? <span className="ml-1 tabular-nums">({groups.length} of {limit})</span> : null}
          </>
        }
        actions={
          canEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onNew}
              disabled={tracked.length === 0 || full}
              title={full ? `You have the maximum of ${limit} groups.` : tracked.length === 0 ? "Add keywords first." : undefined}
            >
              <FolderPlus aria-hidden /> New group
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <ListSkeleton rows={2} />
      ) : error ? (
        <ErrorState compact description="Keyword groups couldn't be loaded." onRetry={onRetry} />
      ) : groups.length === 0 ? (
        <EmptyState
          compact
          icon={FolderTree}
          tone="keywords"
          title="No groups yet"
          description={
            tracked.length === 0
              ? "Add keywords first, then group them."
              : "For example “Emergency” and “Cosmetic”. Then filter the Rank Tracker and the Local Search Grid by group and compare how each one ranks."
          }
          action={
            canEdit && tracked.length > 0 ? (
              <Button size="sm" onClick={onNew}>
                <FolderPlus aria-hidden /> Create a group
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const summary = summaries.find((entry) => entry.group_id === group.group_id);
            const self = summary?.summary.self;
            const keywords = sortRows(group.keywords, byNumber((keyword) => position.get(keywordKey(keyword)) ?? null));
            return (
              <li key={group.group_id} className="flex min-w-0 flex-col rounded-xl border border-border bg-card shadow-card">
                <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold leading-6 text-foreground">{group.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {group.keywords.length} keyword{group.keywords.length === 1 ? "" : "s"}
                      {summary && summary.keywords_in_run !== group.keywords.length ? ` · ${summary.keywords_in_run} measured so far` : ""}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="-mr-1.5 flex shrink-0 items-center">
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${group.name}`} title="Edit group" onClick={() => onEdit(group)}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:bg-critical-surface hover:text-critical"
                        aria-label={`Delete ${group.name}`}
                        title="Delete group"
                        onClick={() => setDeleting(group)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-3 px-4 py-3">
                  {self ? (
                    <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <dt className="text-muted-foreground">Avg. rank</dt>
                        <dd>
                          <AvgRankPill value={self.avgRank} status={self.status} display={self.display} statusText={statusText} className="text-xs" />
                        </dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <dt className="text-muted-foreground">Change</dt>
                        <dd>
                          <RankChange change={self.change} />
                        </dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <dt className="text-muted-foreground">Top 3</dt>
                        <dd className="font-semibold tabular-nums text-foreground">{formatRate(self.top3Rate)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-xs text-muted-foreground">Ranks for this group show after the next ranking run.</p>
                  )}
                  <ul className="flex flex-wrap gap-1.5" aria-label={`Keywords in ${group.name}`}>
                    {keywords.map((keyword) => (
                      <li key={keyword}>
                        <Badge variant="neutral">{keyword}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-xs font-semibold">
                  <button type="button" onClick={() => onShowInList(group)} className={FOOTER_ACTION}>
                    <Filter aria-hidden className="size-3.5 shrink-0" /> Show in list
                  </button>
                  <Link to={rankingsPagePath(locationId, "rankings/tracker", { group: group.group_id })} className={FOOTER_ACTION}>
                    Rank Tracker
                  </Link>
                  <Link to={rankingsPagePath(locationId, "rankings/grid", { group: group.group_id })} className={FOOTER_ACTION}>
                    Local Search Grid
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="Only the group goes: its keywords stay tracked, and nothing is charged."
        confirmLabel="Delete group"
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void remove(target);
        }}
      />
    </section>
  );
}
