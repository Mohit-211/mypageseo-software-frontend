import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, List, MapPinOff, Plus } from "lucide-react";
import { preloadPath } from "@/app/route-preload";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCanEdit } from "@/hooks/use-access";
import { locationSwitchTarget } from "@/lib/mypageseo/navigation";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useWorkspace, type LocationSummary } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";
import { initialsOf, preloadHandlers, useNavLocation } from "./use-shell-nav";

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

type LocationGroup = { key: string; heading: string | null; locations: LocationSummary[] };

/** Agencies: one group per client (A–Z) and "No client" last. Businesses: one unlabelled group. */
function groupLocations(locations: LocationSummary[], clients: { id: string; name: string }[], agency: boolean): LocationGroup[] {
  const sorted = [...locations].sort((a, b) => collator.compare(a.businessName, b.businessName));
  if (!agency) return [{ key: "all", heading: null, locations: sorted }];
  const groups = [...clients]
    .sort((a, b) => collator.compare(a.name, b.name))
    .map((client) => ({ key: client.id, heading: client.name, locations: sorted.filter((location) => location.clientId === client.id) }));
  const known = new Set(clients.map((client) => client.id));
  // Locations without a client, plus any whose client isn't in the list (e.g. still loading).
  const loose = sorted.filter((location) => !location.clientId || !known.has(location.clientId));
  return [...groups, { key: "none", heading: "No client", locations: loose }].filter((group) => group.locations.length > 0);
}

const FOOTER_LINK =
  "flex h-9 items-center gap-2 rounded-md px-2 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

/** Short screens (a 768px laptop): a slimmer card, so more of the menu fits under it. */
const CARD =
  "flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border p-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring [@media(max-height:820px)]:py-1.5";

/**
 * The location the location pages below it work on, at the top of that group. Opens a searchable
 * list (grouped by client for agencies). On a location page, picking another location opens the
 * same page for it; elsewhere it only changes where the location links point.
 */
export function SidebarLocationSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { organization, clients, locations, setActiveLocationId } = useWorkspace();
  const { navLocation, navLocationId, state } = useNavLocation();
  const canEdit = useCanEdit();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);

  if (state === "loading" || (state === "ready" && !navLocation)) {
    return (
      <div role="status" aria-label="Loading locations" className={cn(CARD, "pointer-events-none")}>
        <span className="size-8 shrink-0 rounded-lg bg-sidebar-accent motion-safe:animate-pulse" />
        <span className="min-w-0 flex-1 space-y-2">
          <span className="block h-3 w-28 rounded bg-sidebar-accent motion-safe:animate-pulse" />
          <span className="block h-2.5 w-20 rounded bg-sidebar-accent motion-safe:animate-pulse" />
        </span>
      </div>
    );
  }

  if (state === "empty" || state === "unavailable" || !navLocation) {
    const unavailable = state === "unavailable";
    if (!unavailable && !canEdit) {
      return (
        <div className={cn(CARD, "text-sm text-sidebar-muted")}>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-sidebar-icon">
            <MapPinOff aria-hidden className="size-4" />
          </span>
          No locations yet
        </div>
      );
    }
    const to = unavailable || !canEdit ? "/locations" : "/locations/add";
    return (
      <Link
        to={to}
        onClick={onNavigate}
        {...preloadHandlers(() => preloadPath(to))}
        className={cn(CARD, "border-dashed border-sidebar-primary/60 bg-sidebar-accent/30 hover:bg-sidebar-accent/60")}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          {unavailable ? <List aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-sidebar-accent-foreground">
            {unavailable ? "Locations didn't load" : "Add your first location"}
          </span>
          <span className="block text-xs text-sidebar-muted">{unavailable ? "Open the locations list" : "Connect Google or find it on Maps"}</span>
        </span>
      </Link>
    );
  }

  const agency = organization?.accountType === "agency";
  const clientName = (location: LocationSummary) =>
    location.clientId ? (clients.find((client) => client.id === location.clientId)?.name ?? null) : null;
  const cityOf = (location: LocationSummary) => location.city || location.area;
  const subline = [cityOf(navLocation), agency ? (clientName(navLocation) ?? "No client") : null].filter(Boolean).join(" · ");
  const groups = groupLocations(locations, clients, agency);
  const targetFor = (id: string) => locationSwitchTarget(pathname, id);

  const choose = (id: string) => {
    setOpen(false);
    setActiveLocationId(id);
    if (pathname === "/dashboard") {
      // On the dashboard the pick scopes the page too, like its own location picker (the period and
      // the table's sort stay, the table goes back to page 1), so the card and the page never show
      // two different locations.
      const params = new URLSearchParams(search);
      params.set("location", id);
      params.delete("ppage");
      navigate(`/dashboard?${params.toString()}`, { replace: true });
      // Same path, so the phone drawer wouldn't close by itself.
      onNavigate?.();
      return;
    }
    const target = targetFor(id);
    if (target && target !== pathname) navigate(target);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Location: ${navLocation.businessName}. Change location`}
          className={cn(CARD, "group bg-sidebar-accent/45 hover:bg-sidebar-accent/75 data-[state=open]:bg-sidebar-accent")}
        >
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
          >
            {initialsOf(navLocation.businessName)}
          </span>
          <span className="min-w-0 flex-1" title={subline ? `${navLocation.businessName}\n${subline}` : navLocation.businessName}>
            {/* One line, so the whole menu (AI and White Label included) fits a laptop screen. The
                full name is in the tooltip, the list this opens and the page header. On short
                screens the city and client line goes too (it is in the tooltip and the eyebrow). */}
            <span className="block truncate text-sm font-semibold leading-snug text-sidebar-accent-foreground">
              {navLocation.businessName}
            </span>
            {subline ? <span className="mt-0.5 block truncate text-xs text-sidebar-muted [@media(max-height:820px)]:hidden">{subline}</span> : null}
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-sidebar-icon transition-colors group-hover:text-sidebar-accent-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden p-0">
        <Command defaultValue={navLocationId ?? undefined} loop>
          <CommandInput placeholder="Search locations" aria-label="Search locations" />
          <CommandList className="max-h-[min(22rem,55vh)]">
            <CommandEmpty>No locations match.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.key} {...(group.heading ? { heading: group.heading } : {})}>
                {group.locations.map((location) => {
                  const current = location.id === navLocationId;
                  const city = cityOf(location);
                  return (
                    <CommandItem
                      key={location.id}
                      value={location.id}
                      keywords={[location.businessName, location.area, clientName(location) ?? "no client"]}
                      onSelect={() => choose(location.id)}
                      onPointerEnter={() => preloadPath(targetFor(location.id) ?? locationPath(location.id))}
                      aria-current={current ? "true" : undefined}
                      className="gap-2.5 py-2"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-md text-xs font-semibold",
                          current ? "bg-primary text-primary-foreground" : "bg-brand-tint text-brand",
                        )}
                      >
                        {initialsOf(location.businessName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{location.businessName}</span>
                        {city ? <span className="block truncate text-xs text-muted-foreground">{city}</span> : null}
                      </span>
                      <Check aria-hidden className={cn("text-primary", current ? "visible" : "invisible")} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        {/* Pinned under the list (it scrolls with many locations). */}
        <div className="border-t border-border p-1.5">
          <Link
            to="/locations"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            {...preloadHandlers(() => preloadPath("/locations"))}
            className={FOOTER_LINK}
          >
            <List aria-hidden className="size-4 text-muted-foreground" />
            All locations
          </Link>
          {canEdit ? (
            <Link
              to="/locations/add"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              {...preloadHandlers(() => preloadPath("/locations/add"))}
              className={FOOTER_LINK}
            >
              <Plus aria-hidden className="size-4 text-muted-foreground" />
              Add location
            </Link>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
