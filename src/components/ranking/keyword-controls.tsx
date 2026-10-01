import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { isApiError, updateTracking } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGroupParam } from "@/lib/rankings/rankings-context";
import { rankingsKey, useKeywordGroups, useTracking } from "@/lib/rankings/use-rankings";

const MAX_KEYWORDS = 20;

/** Filters the Rank Tracker, Keywords and grid pages to one keyword group (`?group=`). */
export function GroupFilter({ locationId }: { locationId: string }) {
  const groups = useKeywordGroups(locationId);
  const [group, setGroup] = useGroupParam();
  const list = groups.data?.groups ?? [];
  if (list.length === 0) return null;
  return (
    <Select value={group ?? "all"} onValueChange={(value) => setGroup(value === "all" ? undefined : value)}>
      <SelectTrigger className="w-full bg-background sm:w-52" aria-label="Keyword group">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All keywords</SelectItem>
        {list.map((entry) => (
          <SelectItem key={entry.group_id} value={entry.group_id}>
            {entry.name} ({entry.keywords.length})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "Edit keywords": the tracked keywords (`PUT tracking { keywords }`), used from the next run. */
export function EditKeywordsButton({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil aria-hidden /> Edit keywords
      </Button>
      {open ? <EditKeywordsDialog locationId={locationId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function EditKeywordsDialog({ locationId, onClose }: { locationId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const tracking = useTracking(locationId);
  const saved = tracking.data?.tracking.keywords.map((keyword) => keyword.text) ?? [];
  const [edited, setEdited] = useState<string[] | null>(null);
  const keywords = edited ?? saved;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const removed = saved.filter((keyword) => !keywords.some((entry) => entry.toLowerCase() === keyword.toLowerCase()));

  const add = () => {
    const value = draft.trim().replace(/\s+/g, " ");
    if (!value) return;
    if (value.length < 2 || value.length > 80) return setError("Each keyword needs 2–80 characters.");
    if (keywords.some((keyword) => keyword.toLowerCase() === value.toLowerCase())) return setError("That keyword is already in the list.");
    if (keywords.length >= MAX_KEYWORDS) return setError(`Up to ${MAX_KEYWORDS} keywords.`);
    setEdited([...keywords, value]);
    setDraft("");
    setError(null);
  };

  const save = async () => {
    if (keywords.length === 0) return setError("Keep at least one keyword.");
    setSaving(true);
    setError(null);
    try {
      await updateTracking(locationId, { keywords });
      await queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      toast.success("Keywords saved. They're measured from the next ranking run.");
      onClose();
    } catch (err) {
      setError(
        isApiError(err) && err.reason === "read_only"
          ? "Your access is read-only."
          : isApiError(err) && err.status === 400 && err.message
            ? err.message
            : "The keywords couldn't be saved. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tracked keywords</DialogTitle>
          <DialogDescription>
            Up to {MAX_KEYWORDS}. Changes show from the next ranking run (the monthly refresh, or Refresh rankings) and in reports made from it.
          </DialogDescription>
        </DialogHeader>
        {tracking.isPending ? (
          <LoaderCircle aria-label="Loading keywords" className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-3">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                add();
              }}
            >
              <Input
                aria-label="New keyword"
                value={draft}
                maxLength={80}
                placeholder="emergency plumber"
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError(null);
                }}
              />
              <Button type="submit" variant="outline"><Plus aria-hidden /> Add</Button>
            </form>
            <ul className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <li key={keyword}>
                  <Badge variant="secondary" className="gap-1 pr-1">
                    {keyword}
                    <button
                      type="button"
                      aria-label={`Remove ${keyword}`}
                      className="rounded p-0.5 hover:bg-muted"
                      onClick={() => setEdited(keywords.filter((item) => item !== keyword))}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{keywords.length} of {MAX_KEYWORDS}</p>
            {removed.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Removing {removed.length === 1 ? `"${removed[0]}"` : `${removed.length} keywords`} also takes {removed.length === 1 ? "it" : "them"} out of any keyword group. Past results are kept.
              </p>
            ) : null}
            {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving || edited === null}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save keywords
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
