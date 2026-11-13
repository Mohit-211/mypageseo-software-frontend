import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, LogOut, Settings, User } from "lucide-react";
import { preloadPath } from "@/app/route-preload";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccess } from "@/hooks/use-access";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";
import { initialsOf, preloadHandlers, useSignOut } from "./use-shell-nav";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", member: "Member", client_user: "Read-only" };
const TYPE_LABEL: Record<string, string> = { agency: "Agency", business: "Business" };

/**
 * The organization you're working in, at the foot of the sidebar: switch organization (when you
 * belong to more than one), its settings (owners) or your profile, and sign out.
 */
export function OrgMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { status, organization, organizations, setOrganizationId } = useWorkspace();
  const access = useAccess();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const signOut = useSignOut();

  if (!organization) {
    if (status !== "loading") return null;
    return (
      <div aria-hidden className="shrink-0 border-t border-sidebar-border px-2 py-1">
        <div className="flex h-12 items-center gap-3 px-2.5 py-1.5">
          <span className="size-8 rounded-lg bg-sidebar-accent motion-safe:animate-pulse" />
          <span className="h-3 w-28 rounded bg-sidebar-accent motion-safe:animate-pulse" />
        </div>
      </div>
    );
  }

  const settings = access.can("settings.manage")
    ? { to: "/settings", label: "Organization settings", icon: Settings }
    : { to: "/settings/profile", label: "Profile", icon: User };
  const inSettings = pathname === "/settings" || pathname.startsWith("/settings/");
  const SettingsIcon = settings.icon;

  return (
    // Compact (about 57px), so the menu above keeps room on laptop screens.
    <div className="shrink-0 border-t border-sidebar-border px-2 py-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${organization.name}: organization menu`}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent",
              inSettings && "bg-sidebar-accent/60",
            )}
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-accent text-xs font-bold text-brand-accent-foreground shadow-sm"
            >
              {initialsOf(organization.name, "M")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-sidebar-accent-foreground">{organization.name}</span>
              <span className="block truncate text-xs text-sidebar-muted">
                {TYPE_LABEL[organization.accountType] ?? organization.accountType} · {ROLE_LABEL[organization.role] ?? organization.role}
              </span>
            </span>
            <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-sidebar-icon transition-colors group-hover:text-sidebar-accent-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-60">
          {organizations.length > 1 ? (
            <>
              <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Switch organization</DropdownMenuLabel>
              {organizations.map((entry) => {
                const current = entry.id === organization.id;
                return (
                  <DropdownMenuItem
                    key={entry.id}
                    aria-current={current ? "true" : undefined}
                    onSelect={() => {
                      if (current) return;
                      setOrganizationId(entry.id);
                      onNavigate?.();
                      navigate("/dashboard");
                    }}
                  >
                    <Check aria-hidden className={cn("size-4 text-primary", current ? "visible" : "invisible")} />
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    <span className="text-xs text-muted-foreground">{TYPE_LABEL[entry.accountType] ?? entry.accountType}</span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem asChild>
            <Link to={settings.to} onClick={onNavigate} {...preloadHandlers(() => preloadPath(settings.to))}>
              <SettingsIcon aria-hidden className="size-4" />
              {settings.label}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut aria-hidden className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
