import { Link, useLocation } from "react-router-dom";
import { CircleHelp, Menu } from "lucide-react";
import { preloadPath } from "@/app/route-preload";
import { TokenBalance } from "@/components/layout/shared/token-balance";
import { GlobalSearch } from "@/components/mypageseo/global-search";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";
import { HeaderBrand } from "./brand";
import { preloadHandlers } from "./use-shell-nav";

const ICON_BUTTON =
  "grid size-9 shrink-0 place-items-center rounded-md text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The sticky page header: menu button and logo on small screens, global search, then the token
 * balance, help and the account menu.
 */
export function Header({ navOpen, onOpenNav }: { navOpen: boolean; onOpenNav: () => void }) {
  const { pathname } = useLocation();
  const inHelp = /^\/(help|support)(\/|$)/.test(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur-md sm:gap-3 sm:px-4 md:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        aria-haspopup="dialog"
        aria-expanded={navOpen}
        className={cn(ICON_BUTTON, "-ml-1 lg:hidden")}
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <HeaderBrand className="mr-1 lg:hidden" />
      <GlobalSearch className="flex-1 justify-end sm:max-w-md sm:justify-start lg:max-w-xl" />
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <TokenBalance />
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/help"
              aria-label="Help and support"
              aria-current={inHelp ? "page" : undefined}
              {...preloadHandlers(() => preloadPath("/help"))}
              className={cn(ICON_BUTTON, inHelp && "bg-accent text-primary")}
            >
              <CircleHelp aria-hidden className="size-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>Help and support</TooltipContent>
        </Tooltip>
        <AccountMenu />
      </div>
    </header>
  );
}
