import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { KeywordGroup } from "@/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { groupErrorText, useGroupMutations } from "@/lib/keywords/groups";
import { keywordKey } from "@/lib/keywords/keywords";

/**
 * Create or edit a keyword group: a name and the tracked keywords in it (in the saved order).
 * `preset` ticks keywords for a new group ("New group with this keyword").
 */
export function GroupDialog({
  locationId,
  group,
  preset,
  tracked,
  onClose,
}: {
  locationId: string;
  /** The group to edit; null for a new one. */
  group: KeywordGroup | null;
  preset?: readonly string[];
  /** Tracked keywords in the saved order. */
  tracked: readonly string[];
  onClose: () => void;
}) {
  const groups = useGroupMutations(locationId);
  const [name, setName] = useState(group?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(() => new Set((group?.keywords ?? preset ?? []).map(keywordKey)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    const keywords = tracked.filter((keyword) => selected.has(keywordKey(keyword)));
    if (!trimmed || trimmed.length > 60) return setError("Give the group a name (up to 60 characters).");
    if (keywords.length === 0) return setError("Pick at least one keyword.");
    setSaving(true);
    setError(null);
    try {
      if (group) await groups.update({ groupId: group.group_id, name: trimmed, keywords });
      else await groups.create({ name: trimmed, keywords });
      toast.success(group ? "Group saved" : `“${trimmed}” created`, {
        description: `${keywords.length} keyword${keywords.length === 1 ? "" : "s"}. Filter the ranking pages by it any time.`,
      });
      onClose();
    } catch (err) {
      setError(groupErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  const all = tracked.length > 0 && tracked.every((keyword) => selected.has(keywordKey(keyword)));

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{group ? `Edit “${group.name}”` : "New keyword group"}</DialogTitle>
          <DialogDescription>
            Group related keywords, for example by service, to filter the ranking pages and compare groups. Groups are free and a keyword can be in several.
          </DialogDescription>
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
            <Input
              id="group-name"
              value={name}
              maxLength={60}
              placeholder="Emergency services"
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
          </div>
          <div role="group" aria-labelledby="group-keywords-label" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p id="group-keywords-label" className="text-sm font-medium text-foreground">
                Keywords <span className="font-normal text-muted-foreground">({selected.size} selected)</span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected(all ? new Set() : new Set(tracked.map(keywordKey)))}
              >
                {all ? "Clear all" : "Select all"}
              </Button>
            </div>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {tracked.map((keyword, index) => {
                const id = `group-keyword-${index}`;
                const key = keywordKey(keyword);
                return (
                  <li key={key} className="flex min-h-11 items-center gap-3 px-3 hover:bg-accent/60">
                    <Checkbox
                      id={id}
                      checked={selected.has(key)}
                      onCheckedChange={(value) => {
                        setError(null);
                        setSelected((current) => {
                          const next = new Set(current);
                          if (value === true) next.add(key);
                          else next.delete(key);
                          return next;
                        });
                      }}
                    />
                    <label htmlFor={id} className="flex-1 cursor-pointer py-2.5 text-sm text-foreground">
                      {keyword}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-critical">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} {group ? "Save group" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
