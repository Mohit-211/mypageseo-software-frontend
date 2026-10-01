import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderPlus, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import {
  apiErrorData,
  createKeywordGroup,
  deleteKeywordGroup,
  isApiError,
  updateKeywordGroup,
  type KeywordGroup,
} from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { EditKeywordsButton } from "@/components/ranking/keyword-controls";
import { RankingsPageHeader } from "@/components/ranking/rank-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRankingsContext } from "@/lib/rankings/rankings-context";
import { rankingsKey, useKeywordGroups, useTracking } from "@/lib/rankings/use-rankings";

/** Named sets of tracked keywords, for filtering rankings and group summaries. */
function RankingsGroupsPage() {
  const { location } = useRankingsContext();
  const locationId = location.location_id;
  const queryClient = useQueryClient();
  const groups = useKeywordGroups(locationId);
  const tracking = useTracking(locationId);
  const [editing, setEditing] = useState<KeywordGroup | "new" | null>(null);
  const [deleting, setDeleting] = useState<KeywordGroup | null>(null);

  const tracked = tracking.data?.tracking.keywords.map((keyword) => keyword.text) ?? [];
  const list = groups.data?.groups ?? [];
  const limit = groups.data?.limit ?? 20;

  const remove = async (group: KeywordGroup) => {
    try {
      await deleteKeywordGroup(locationId, group.group_id);
      await queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      toast.success(`“${group.name}” deleted`);
    } catch (err) {
      toast.error(isApiError(err) && err.reason === "read_only" ? "Your access is read-only." : "The group couldn't be deleted. Try again.");
    }
  };

  return (
    <>
      <RankingsPageHeader
        locationId={locationId}
        view="groups"
        title="Keyword groups"
        description="Group related keywords (for example by service) to filter rankings and compare groups. Groups are free and don't change your keywords."
        actions={
          <>
            <EditKeywordsButton locationId={locationId} />
            <Button size="sm" onClick={() => setEditing("new")} disabled={tracked.length === 0 || list.length >= limit}>
              <FolderPlus aria-hidden /> New group
            </Button>
          </>
        }
      />
      {groups.isPending || tracking.isPending ? (
        <PageSkeleton />
      ) : groups.isError ? (
        <ErrorState description="Keyword groups couldn't be loaded." onRetry={() => void groups.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="No keyword groups yet"
          description={tracked.length === 0 ? "Add keywords first, then group them." : "Create a group, then filter the Rank Tracker, Keywords and grid by it."}
          action={tracked.length > 0 ? <Button size="sm" onClick={() => setEditing("new")}><FolderPlus aria-hidden /> New group</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((group) => (
            <Panel
              key={group.group_id}
              title={group.name}
              description={`${group.keywords.length} keyword${group.keywords.length === 1 ? "" : "s"}`}
              actions={
                <>
                  <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${group.name}`} onClick={() => setEditing(group)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-critical" aria-label={`Delete ${group.name}`} onClick={() => setDeleting(group)}>
                    <Trash2 aria-hidden />
                  </Button>
                </>
              }
            >
              <ul className="flex flex-wrap gap-1.5">
                {group.keywords.map((keyword) => (
                  <li key={keyword}><Badge variant="secondary">{keyword}</Badge></li>
                ))}
              </ul>
              <div className="mt-3 flex gap-3 text-sm">
                <Link className="font-medium text-primary hover:underline" to={{ pathname: "..", search: `?group=${group.group_id}` }} relative="path">Rank Tracker</Link>
                <Link className="font-medium text-primary hover:underline" to={{ pathname: "../grid", search: `?group=${group.group_id}` }} relative="path">Grid</Link>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {list.length >= limit ? <p className="mt-3 text-xs text-muted-foreground">You have the maximum of {limit} groups.</p> : null}

      {editing ? (
        <GroupDialog
          locationId={locationId}
          group={editing === "new" ? null : editing}
          tracked={tracked}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="Only the group is removed; its keywords stay tracked."
        confirmLabel="Delete group"
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void remove(target);
        }}
      />
    </>
  );
}

function groupErrorText(err: unknown): string {
  if (!isApiError(err)) return "The group couldn't be saved. Try again.";
  switch (err.reason) {
    case "group_name_taken":
      return "Another group already has this name.";
    case "unknown_keyword": {
      const keywords = apiErrorData(err).keywords;
      return `These keywords aren't tracked anymore: ${Array.isArray(keywords) ? keywords.join(", ") : "some of the selection"}.`;
    }
    case "too_many_groups":
      return `You can have up to ${String(apiErrorData(err).limit ?? 20)} groups.`;
    case "group_not_found":
      return "This group was deleted in the meantime.";
    case "read_only":
      return "Your access is read-only.";
    default:
      return err.message || "The group couldn't be saved. Try again.";
  }
}

function GroupDialog({
  locationId,
  group,
  tracked,
  onClose,
}: {
  locationId: string;
  group: KeywordGroup | null;
  tracked: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(group?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((group?.keywords ?? []).map((keyword) => keyword.toLowerCase())),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    const keywords = tracked.filter((keyword) => selected.has(keyword.toLowerCase()));
    if (!trimmed || trimmed.length > 60) return setError("Give the group a name (up to 60 characters).");
    if (keywords.length === 0) return setError("Pick at least one keyword.");
    setSaving(true);
    setError(null);
    try {
      if (group) await updateKeywordGroup(locationId, group.group_id, { name: trimmed, keywords });
      else await createKeywordGroup(locationId, { name: trimmed, keywords });
      await queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      toast.success(group ? "Group saved" : `“${trimmed}” created`);
      onClose();
    } catch (err) {
      setError(groupErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? "Edit group" : "New keyword group"}</DialogTitle>
          <DialogDescription>A keyword can be in several groups.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input id="group-name" value={name} maxLength={60} placeholder="Emergency services" onChange={(e) => setName(e.target.value)} />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Keywords</legend>
            <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
              {tracked.map((keyword) => {
                const id = `group-kw-${keyword}`;
                const key = keyword.toLowerCase();
                return (
                  <li key={keyword} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={selected.has(key)}
                      onCheckedChange={(value) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (value === true) next.add(key);
                          else next.delete(key);
                          return next;
                        })
                      }
                    />
                    <label htmlFor={id} className="cursor-pointer text-sm text-foreground">{keyword}</label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} {group ? "Save group" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default RankingsGroupsPage;
