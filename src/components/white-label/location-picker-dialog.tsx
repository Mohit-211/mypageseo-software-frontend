import { MapPin, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { byText, sortRows } from "@/lib/sort";
import type { ClientLinkRow } from "@/lib/white-label/use-client-links";

/**
 * "New client link": pick a location that doesn't have a live link yet (searchable, grouped by
 * client, "No client" last). Picking one opens its link editor.
 */
export function LocationPickerDialog({
  open,
  onOpenChange,
  rows,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every location of the page (filters applied); those with a live link are left out. */
  rows: ClientLinkRow[];
  onPick: (row: ClientLinkRow) => void;
}) {
  const candidates = sortRows(
    rows.filter((row) => !row.link),
    byText((row) => row.name),
  );
  const groups = new Map<string, { label: string; rows: ClientLinkRow[] }>();
  for (const row of candidates) {
    const key = row.clientId ?? "";
    const group = groups.get(key) ?? { label: row.clientName ?? (row.clientId ? "Other client" : "No client"), rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  const ordered = [...groups.entries()]
    .sort(([a, ga], [b, gb]) => (a === "" ? 1 : b === "" ? -1 : ga.label.localeCompare(gb.label)))
    .map(([key, group]) => ({ key, ...group }));
  const grouped = ordered.length > 1 || (ordered[0]?.key ?? "") !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg sm:p-0">
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5 text-left">
          <DialogTitle>New client link</DialogTitle>
          <DialogDescription>Choose the location to make a live, branded page for.</DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium text-foreground">Every location has a client link</p>
            <p className="mt-1 text-sm text-muted-foreground">Add a location to make another one.</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/locations/add">
                <Plus aria-hidden /> Add location
              </Link>
            </Button>
          </div>
        ) : (
          <Command className="rounded-none">
            <CommandInput placeholder={grouped ? "Search locations or clients" : "Search locations"} />
            <CommandList className="max-h-[min(60vh,380px)]">
              <CommandEmpty>No location matches.</CommandEmpty>
              {ordered.map((group) => (
                <CommandGroup key={group.key || "none"} heading={grouped ? group.label : undefined}>
                  {group.rows.map((row) => (
                    <CommandItem
                      key={row.id}
                      value={`${row.name} ${row.area} ${row.clientName ?? ""} ${row.id}`}
                      onSelect={() => onPick(row)}
                      className="py-2.5"
                    >
                      <MapPin aria-hidden className="text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{row.name}</span>
                        {row.area ? <span className="block truncate text-xs text-muted-foreground">{row.area}</span> : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        )}
        <p className="border-t border-border bg-surface-strong px-5 py-2.5 text-xs text-muted-foreground">
          {candidates.length} location{candidates.length === 1 ? "" : "s"} without a link. Locations that have one are managed from the table.
        </p>
      </DialogContent>
    </Dialog>
  );
}
