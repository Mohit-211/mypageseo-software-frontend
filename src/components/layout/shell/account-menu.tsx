import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, CreditCard, LogOut, Settings, User } from "lucide-react";
import { getProfile } from "@/api";
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
import { profileInitials } from "@/lib/mypageseo/profile";
import { preloadHandlers, useSignOut } from "./use-shell-nav";

/** The signed-in person: initials in the header, their name and email, account links and sign out. */
export function AccountMenu() {
  // Same query as the workspace provider, so this reads the cached profile.
  const profile = useQuery({ queryKey: ["profile"], queryFn: ({ signal }) => getProfile(signal), staleTime: 5 * 60_000 });
  const access = useAccess();
  const signOut = useSignOut();
  const name = profile.data?.name?.trim() ?? "";
  const email = profile.data?.email?.trim() ?? "";
  const initials = name || email ? profileInitials(name, email) : null;

  const links = [
    { to: "/settings/profile", label: "Profile", icon: User, show: true },
    { to: "/settings", label: "Settings", icon: Settings, show: access.can("settings.manage") },
    { to: "/settings/billing", label: "Billing", icon: CreditCard, show: access.can("billing.view") },
  ].filter((link) => link.show);

  const avatar = (size: "sm" | "md") => (
    <span
      aria-hidden
      className={
        size === "sm"
          ? "grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          : "grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
      }
    >
      {initials ?? <User className="size-4" />}
    </span>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={name ? `Account menu for ${name}` : "Account menu"}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full p-0.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-accent sm:pr-1.5"
        >
          {avatar("sm")}
          <ChevronDown aria-hidden className="hidden size-3.5 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
          {avatar("md")}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{name || "Your account"}</span>
            {email ? <span className="block truncate text-xs text-muted-foreground">{email}</span> : null}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <DropdownMenuItem key={link.to} asChild>
              <Link to={link.to} {...preloadHandlers(() => preloadPath(link.to))}>
                <Icon aria-hidden className="size-4" />
                {link.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut aria-hidden className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
