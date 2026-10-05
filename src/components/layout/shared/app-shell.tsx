import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, matchPath, useLocation, useNavigate } from "react-router-dom";
import { Bell, Check, ChevronDown, CircleHelp, LogOut, Menu, Settings, Star, User, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "@/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/mypageseo/global-search";
import { TokenBalance } from "@/components/layout/shared/token-balance";
import logoUrl from "@/assets/logo.png";
import { navigationFor, type NavGroup } from "@/lib/mypageseo/navigation";
import { useAccountType, useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";

/**
 * The logo, centered on an off-white band (the logo is dark and would disappear on the
 * dark sidebar), with a thin brand-red line underneath. Same height as the page header.
 */
function Brand({ className }: { className?: string }) {
  return (
    <Link
      to="/dashboard"
      aria-label="Mypageseo dashboard"
      className={cn(
        "relative flex h-14 shrink-0 items-center justify-center bg-background px-4",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-gradient-to-r after:from-transparent after:via-brand-accent after:to-transparent after:content-['']",
        className,
      )}
    >
      <img src={logoUrl} alt="Mypageseo" className="h-12 w-auto object-contain" />
    </Link>
  );
}

const GROUP_ORDER: NavGroup[] = ["Overview", "Visibility", "Workspace"];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const accountType = useAccountType();
  const { pathname } = useLocation();
  const items = navigationFor(accountType);
  // A section that owns part of a location page (e.g. /locations/:id/rankings) wins over Locations.
  const owner = items.find(
    (entry) => entry.locationSection && matchPath(`/locations/:locationId/${entry.locationSection}/*`, pathname),
  );
  // Open/closed per section the user has toggled; untouched sections are open while you're in them.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    // Scrolls only on very short screens, without a visible scrollbar.
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Primary">
      {GROUP_ORDER.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group} className="mb-4 last:mb-0">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">{group}</p>
            <ul className="space-y-0.5">
              {groupItems.map((item) => {
                const active = owner ? owner === item : matchPath({ path: item.to, end: item.to === "/" }, pathname) !== null;
                const Icon = item.icon;
                const open = item.children ? (expanded[item.label] ?? active) : false;
                const rowClass = cn(
                  "group relative flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-left text-[13.5px] font-medium transition-all duration-150",
                  active
                    ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-brand-accent before:content-['']"
                    : "text-sidebar-foreground/90 hover:bg-white/[0.05] hover:text-white",
                );
                const rowContent = (
                  <>
                    <Icon
                      className={cn("size-[18px] shrink-0 transition-colors", active ? "text-brand-accent" : "text-sidebar-icon group-hover:text-white")}
                      aria-hidden
                    />
                    {item.label}
                  </>
                );
                return (
                  <li key={item.label}>
                    {item.children ? (
                      // A section with sub-pages only opens and closes its list; it doesn't navigate.
                      <button
                        type="button"
                        onClick={() => setExpanded((current) => ({ ...current, [item.label]: !open }))}
                        aria-expanded={open}
                        className={rowClass}
                      >
                        {rowContent}
                        <ChevronDown
                          aria-hidden
                          className={cn("ml-auto size-4 shrink-0 text-sidebar-icon transition-transform duration-200", open && "rotate-180")}
                        />
                      </button>
                    ) : (
                      <Link to={item.to} onClick={onNavigate} aria-current={active ? "page" : undefined} className={rowClass}>
                        {rowContent}
                      </Link>
                    )}
                    {open && item.children ? (
                      <ul className="mb-1.5 ml-[21px] mt-1 space-y-0.5 border-l border-white/15 pl-3">
                        {item.children.map((child) => {
                          // On a location page the child is current when the page is its location path.
                          const locationId = owner
                            ? matchPath(`/locations/:locationId/${item.locationSection}/*`, pathname)?.params.locationId
                            : undefined;
                          const childPath =
                            locationId !== undefined && child.locationPath !== undefined
                              ? `/locations/${locationId}/${item.locationSection}${child.locationPath ? `/${child.locationPath}` : ""}`
                              : null;
                          return (
                            <li key={child.to}>
                              <NavLink
                                to={childPath ?? child.to}
                                end
                                onClick={onNavigate}
                                className="relative block rounded-md px-2.5 py-1.5 text-[13px] text-sidebar-foreground/75 transition-colors hover:bg-white/[0.04] hover:text-white aria-[current=page]:font-medium aria-[current=page]:text-white aria-[current=page]:before:absolute aria-[current=page]:before:-left-[15.5px] aria-[current=page]:before:top-1/2 aria-[current=page]:before:size-1.5 aria-[current=page]:before:-translate-y-1/2 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-brand-accent aria-[current=page]:before:content-['']"
                              >
                                {child.label}
                              </NavLink>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** The workspace the user is in, at the foot of the sidebar; it's also the way into Settings. */
function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { organization } = useWorkspace();
  const { pathname } = useLocation();
  const inSettings = matchPath("/settings/*", pathname) !== null;
  if (!organization) return null;
  const initials = organization.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return (
    <div className="shrink-0 border-t border-white/10 p-3">
      <Link
        to="/settings"
        onClick={onNavigate}
        aria-current={inSettings ? "page" : undefined}
        aria-label={`${organization.name}: settings`}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
          inSettings ? "bg-white/[0.11] ring-1 ring-brand-accent/60" : "bg-white/[0.04] hover:bg-white/[0.08]",
        )}
      >
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-md bg-gradient-to-br from-brand-accent to-[oklch(0.45_0.16_27.5)] text-xs font-bold text-white shadow-sm">
          {initials || "M"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{organization.name}</span>
          <span className="block text-xs text-sidebar-muted">
            <span className="capitalize">{organization.accountType}</span> · Settings
          </span>
        </span>
        <Settings
          aria-hidden
          className={cn("size-4 shrink-0 transition-transform duration-300 group-hover:rotate-45", inSettings ? "text-brand-accent" : "text-sidebar-icon")}
        />
      </Link>
    </div>
  );
}

/** Persistent organization / client / location context in the global header. */
/** Client filter value meaning "locations without a client". */
const NO_CLIENT = "__none__";

/**
 * Header context. Business: the business name, then the location. Agency: the client
 * (or "No client"), then the location. An organization switcher appears only for people
 * who belong to more than one organization.
 */
function ContextSwitcher() {
  const {
    status,
    organization,
    organizations,
    activeClient,
    activeLocation,
    clients,
    locations,
    setOrganizationId,
    setActiveClientId,
    setActiveLocationId,
  } = useWorkspace();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [clientFilter, setClientFilter] = useState<string | null>(null);

  if (status === "loading") {
    return <span className="h-8 w-48 animate-pulse rounded-md bg-muted" aria-label="Loading workspace" />;
  }
  if (!organization) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="truncate font-medium text-foreground">No organization</span>
      </div>
    );
  }

  const agency = organization.accountType === "agency";
  const locationRoute = matchPath("/locations/:locationId/*", pathname);
  const routeLocationId = locationRoute?.params.locationId;
  const onLocationPage = Boolean(routeLocationId && routeLocationId !== "add");
  const currentLocation = onLocationPage ? (locations.find((l) => l.id === routeLocationId) ?? activeLocation) : activeLocation;

  // On a location page the client is that location's own (or "No client"); elsewhere the chosen filter.
  const selectedClient: string | null = onLocationPage && currentLocation
    ? (currentLocation.clientId ?? NO_CLIENT)
    : (clientFilter ?? activeClient?.id ?? null);
  const clientLabel =
    selectedClient === null ? "All clients" : selectedClient === NO_CLIENT ? "No client" : (clients.find((c) => c.id === selectedClient)?.name ?? "Client");
  const visibleLocations =
    selectedClient === null
      ? locations
      : selectedClient === NO_CLIENT
        ? locations.filter((l) => !l.clientId)
        : locations.filter((l) => l.clientId === selectedClient);

  const goToLocation = (id: string | null) => {
    setActiveLocationId(id);
    if (!onLocationPage || !routeLocationId) return;
    if (id) navigate(pathname.replace(`/locations/${routeLocationId}`, `/locations/${id}`));
    else navigate("/locations");
  };

  const pickClient = (value: string | null) => {
    setClientFilter(value);
    setActiveClientId(value && value !== NO_CLIENT ? value : null);
    const matches =
      value === null ? locations : value === NO_CLIENT ? locations.filter((l) => !l.clientId) : locations.filter((l) => l.clientId === value);
    // Keep the current location if it belongs to the client; otherwise open the client's first one.
    if (currentLocation && matches.some((l) => l.id === currentLocation.id)) return;
    goToLocation(matches[0]?.id ?? null);
  };

  const trigger = "flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm hover:bg-secondary";

  return (
    <div className="flex min-w-0 items-center gap-2">
      {organizations.length > 1 ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(trigger, "font-medium")}>
              <span className="truncate">{organization.name}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Organization</DropdownMenuLabel>
              {organizations.map((entry) => {
                const current = entry.id === organization.id;
                return (
                  <DropdownMenuItem
                    key={entry.id}
                    onSelect={() => {
                      if (current) return;
                      setClientFilter(null);
                      setOrganizationId(entry.id);
                      navigate("/dashboard");
                    }}
                    aria-current={current ? "true" : undefined}
                  >
                    <Check className={cn("size-3.5 shrink-0", current ? "opacity-100" : "opacity-0")} aria-hidden />
                    <span className="truncate">{entry.name}</span>
                    <span className="ml-auto text-xs capitalize text-muted-foreground">{entry.accountType}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-muted-foreground">/</span>
        </>
      ) : null}

      {agency ? (
        <DropdownMenu>
          <DropdownMenuTrigger className={trigger} aria-label="Client">
            <span className="truncate">{clientLabel}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-96 w-64 overflow-y-auto">
            <DropdownMenuLabel>Client</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => pickClient(null)}>
              <Check className={cn("size-3.5 shrink-0", selectedClient === null ? "opacity-100" : "opacity-0")} aria-hidden />
              All clients
            </DropdownMenuItem>
            {clients.map((client) => (
              <DropdownMenuItem key={client.id} onSelect={() => pickClient(client.id)}>
                <Check className={cn("size-3.5 shrink-0", selectedClient === client.id ? "opacity-100" : "opacity-0")} aria-hidden />
                <span className="truncate">{client.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => pickClient(NO_CLIENT)}>
              <Check className={cn("size-3.5 shrink-0", selectedClient === NO_CLIENT ? "opacity-100" : "opacity-0")} aria-hidden />
              No client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : organizations.length > 1 ? null : (
        // A business has one organization: its name, not a menu.
        <span className="truncate text-sm font-medium text-foreground">{organization.name}</span>
      )}

      {locations.length > 0 ? (
        <>
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(trigger, "hidden sm:flex")} aria-label="Location">
              <span className="truncate">{currentLocation ? currentLocation.businessName : "All locations"}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-96 w-72 overflow-y-auto">
              <DropdownMenuLabel>Location</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => goToLocation(null)}>All locations</DropdownMenuItem>
              {visibleLocations.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No locations for this client.</p>
              ) : (
                visibleLocations.map((location) => (
                  <DropdownMenuItem key={location.id} onSelect={() => goToLocation(location.id)}>
                    <Check className={cn("size-3.5 shrink-0", currentLocation?.id === location.id ? "opacity-100" : "opacity-0")} aria-hidden />
                    <span className="truncate">{location.businessName}</span>
                    {location.area ? <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{location.area}</span> : null}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
    </div>
  );
}

/** Location context bar shown when working inside a location workspace. */
function LocationContextBar() {
  const { activeLocation } = useWorkspace();
  if (!activeLocation) return null;
  return (
    <section
      aria-label="Current location"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface-strong px-4 py-2 text-sm md:px-6"
    >
      <span className="font-semibold text-foreground">{activeLocation.businessName}</span>
      <span className="text-muted-foreground">{activeLocation.area}</span>
      {typeof activeLocation.rating === "number" ? (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Star className="size-3.5 text-warning" aria-hidden />
          <span className="sr-only">Rating</span>
          <span className="tabular text-foreground">{activeLocation.rating.toFixed(1)}</span>
          {typeof activeLocation.reviewCount === "number" ? (
            <span className="tabular">({activeLocation.reviewCount} reviews)</span>
          ) : null}
        </span>
      ) : null}
    </section>
  );
}

function AccountMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      // Drop the previous user's cached data so the next sign-in starts clean.
      queryClient.clear();
      navigate("/login", { replace: true });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-secondary"
          aria-label="Account menu"
        >
          <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            U
          </span>
          <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>My account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/profile">
            <User className="size-4" aria-hidden />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="size-4" aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout}>
          <LogOut className="size-4" aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobalHeader({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-1 size-10 shrink-0 lg:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <ContextSwitcher />

      <div className="ml-auto flex items-center gap-1">
        <TokenBalance />
        <GlobalSearch />
        <Button variant="ghost" size="icon" aria-label="Notifications" asChild>
          <Link to="/notifications">
            <Bell className="size-4.5" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Help and support" asChild>
          <Link to="/help">
            <CircleHelp className="size-4.5" />
          </Link>
        </Button>
        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
        <AccountMenu />
      </div>
    </header>
  );
}

/** Application shell: persistent sidebar, global header and location context. */
export function AppShell({
  children,
  showLocationContext = true,
}: {
  children: ReactNode;
  showLocationContext?: boolean;
}) {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => {
      if (wide.matches) setNavOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [navOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      {/* Stays in place while the page scrolls; the menu scrolls on its own when it's long. */}
      <aside
        aria-label="Sidebar"
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-gradient-to-b from-sidebar to-sidebar-deep lg:flex"
      >
        <Brand />
        <SidebarNav />
        <SidebarFooter />
      </aside>

      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setNavOpen(false)}
          />
          <aside aria-label="Sidebar" className="relative flex h-full w-64 flex-col bg-gradient-to-b from-sidebar to-sidebar-deep">
            <div className="relative flex h-14 shrink-0 items-center bg-background pr-2">
              <Brand className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close navigation"
                onClick={() => setNavOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <SidebarNav onNavigate={() => setNavOpen(false)} />
            <SidebarFooter onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <GlobalHeader onOpenNav={() => setNavOpen(true)} />
        {showLocationContext ? <LocationContextBar /> : null}
        <main id="main-content" className="min-w-0 flex-1 space-y-6 px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
