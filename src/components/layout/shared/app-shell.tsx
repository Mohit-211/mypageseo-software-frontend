import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, matchPath, useLocation, useNavigate } from "react-router-dom";
import { Bell, Check, ChevronDown, CircleHelp, LogOut, Menu, Settings, Star, User, X } from "lucide-react";
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
import logoUrl from "@/assets/mypageseo-logo.png";
import { navigationFor } from "@/lib/mypageseo/navigation";
import { useAccountType, useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center px-4 py-4">
      <span className="flex h-10 items-center justify-center rounded-md bg-white px-2">
        <img src={logoUrl} alt="MyPageSEO" className="h-8 w-auto object-contain" />
      </span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const accountType = useAccountType();
  const { pathname } = useLocation();
  const items = navigationFor(accountType);

  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Primary">
      <ul className="space-y-0.5">
        {items.map((item) => {
          // Section is active for its path and anything nested under it.
          // matchPath is segment-aware ("/rankings" won't match "/rankings-x").
          const active = matchPath({ path: item.to, end: item.to === "/" }, pathname) !== null;
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <Link
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full before:bg-brand-accent before:content-['']"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-brand-soft" : "text-sidebar-foreground/60",
                  )}
                  aria-hidden
                />
                {item.label}
              </Link>
              {active && item.children ? (
                <ul className="mt-0.5 mb-1 ml-6 space-y-0.5 border-l border-sidebar-border pl-3">
                  {item.children.map((child) => (
                    <li key={child.to}>
                      <NavLink
                        to={child.to}
                        end
                        onClick={onNavigate}
                        className="block rounded-md px-2 py-1.5 text-[13px] text-sidebar-foreground/70 transition-colors hover:text-sidebar-accent-foreground aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground"
                      >
                        {child.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Persistent organization / client / location context in the global header. */
function ContextSwitcher() {
  const {
    status,
    organization,
    activeClient,
    activeLocation,
    clients,
    locations,
    setAccountType,
    setActiveClientId,
    setActiveLocationId,
  } = useWorkspace();

  if (status !== "ready" || !organization) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="truncate font-medium text-foreground">No workspace connected</span>
        <span className="hidden truncate text-muted-foreground sm:inline">
          · Organization, client and location context appear once the account is connected
        </span>
      </div>
    );
  }

  const visibleLocations = activeClient
    ? locations.filter((l) => l.clientId === activeClient.id)
    : locations;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-medium hover:bg-secondary">
          <span className="truncate">{organization.name}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Organization</DropdownMenuLabel>
          {(
            [
              { type: "business" as const, name: "Riverside Dental Group", kind: "Business" },
              { type: "agency" as const, name: "Northbound Digital", kind: "Agency" },
            ]
          ).map((entry) => {
            const current = entry.name === organization.name;
            return (
              <DropdownMenuItem
                key={entry.type}
                onSelect={() => setAccountType(entry.type)}
                aria-current={current ? "true" : undefined}
              >
                <Check
                  className={cn("size-3.5 shrink-0", current ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
                <span className="truncate">{entry.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{entry.kind}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {clients.length > 0 ? (
        <>
          <span className="text-muted-foreground">/</span>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm hover:bg-secondary">
              <span className="truncate">{activeClient ? activeClient.name : "All clients"}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Client</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setActiveClientId(null)}>
                All clients
              </DropdownMenuItem>
              {clients.map((client) => (
                <DropdownMenuItem key={client.id} onSelect={() => setActiveClientId(client.id)}>
                  {client.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}

      <span className="hidden text-muted-foreground sm:inline">/</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="hidden min-w-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm hover:bg-secondary sm:flex">
          <span className="truncate">
            {activeLocation ? activeLocation.businessName : "All locations"}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Location</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setActiveLocationId(null)}>
            All locations
          </DropdownMenuItem>
          {visibleLocations.map((location) => (
            <DropdownMenuItem key={location.id} onSelect={() => setActiveLocationId(location.id)}>
              <span className="truncate">{location.businessName}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
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
      <aside aria-label="Sidebar" className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Brand />
        <SidebarNav />
      </aside>

      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setNavOpen(false)}
          />
          <aside aria-label="Sidebar" className="relative flex h-full w-64 flex-col bg-sidebar">
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close navigation"
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setNavOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <SidebarNav onNavigate={() => setNavOpen(false)} />
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
