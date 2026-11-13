import { FolderTree } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGroupParam } from "@/lib/rankings/rankings-context";
import { useKeywordGroups } from "@/lib/rankings/use-rankings";
import { byText, sortRows } from "@/lib/sort";

/**
 * Filters a ranking page (Rank Overview, Rank Tracker, Local Search Grid) to one keyword group
 * (`?group=`). Groups are managed on the Keywords page. Hidden when the location has no groups.
 */
export function GroupFilter({ locationId }: { locationId: string }) {
  const groups = useKeywordGroups(locationId);
  const [group, setGroup] = useGroupParam();
  const list = sortRows(groups.data?.groups ?? [], byText((entry) => entry.name));
  if (list.length === 0) return null;
  return (
    <Select value={group ?? "all"} onValueChange={(value) => setGroup(value === "all" ? undefined : value)}>
      <SelectTrigger className="h-9 w-full justify-start sm:w-52 [&>svg:last-child]:ml-auto" aria-label="Keyword group">
        <FolderTree aria-hidden className="size-4 text-muted-foreground" />
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
