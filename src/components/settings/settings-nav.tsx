import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAccess } from "@/hooks/use-access";
import type { Permission } from "@/lib/mypageseo/access";

type SettingsSection = "general" | "profile" | "team" | "integrations" | "billing" | "notifications";

type SettingsNavProps = {
  /** Route id of the active settings screen. */
  active: SettingsSection;
  /**
   * Kept for existing callers. No tab is agency-only any more: branding and client links moved to
   * White Label (`/white-label`), which has its own place in the sidebar.
   */
  isAgency?: boolean;
  className?: string;
};

// inline-block: the tab's padding and underline need their own box, or the scroll container
// (overflow-x-auto) clips the underline of the active tab. On touch screens the extra top padding
// makes each tab a 40px target (32px otherwise).
const linkClass = "inline-block whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors pointer-coarse:pt-2";

/** Which edges of the tab strip have more tabs beyond them (phones: the strip scrolls sideways). */
type Overflow = "left" | "right" | "both" | null;

const FADE_CLASS: Record<Exclude<Overflow, null>, string> = {
  right: "[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]",
  left: "[mask-image:linear-gradient(to_left,black_calc(100%-2rem),transparent)]",
  both: "[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]",
};

type SettingsLink = {
  id: SettingsSection;
  label: string;
  to: string;
  /** Hidden when the signed-in user does not hold this permission. */
  permission?: Permission;
};

const SETTINGS_LINKS: SettingsLink[] = [
  { id: "general", label: "Organization", to: "/settings", permission: "settings.manage" },
  { id: "profile", label: "Profile", to: "/settings/profile" },
  { id: "team", label: "Team", to: "/settings/team", permission: "team.view" },
  { id: "integrations", label: "Integrations", to: "/settings/integrations", permission: "integrations.manage" },
  { id: "billing", label: "Billing", to: "/settings/billing", permission: "billing.view" },
  { id: "notifications", label: "Notifications", to: "/settings/notifications" },
];

/**
 * Shared settings navigation. Sections the account cannot open are not shown,
 * so nobody is sent to a screen they would be refused.
 */
export function SettingsNav({ active, className }: SettingsNavProps) {
  const access = useAccess();
  const links = SETTINGS_LINKS.filter((link) => (link.permission ? access.can(link.permission) : true));
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const overflow = useOverflow(navRef, listRef);

  // On a phone the strip is wider than the screen: bring the current tab into view (centred), or
  // Billing and Notifications open with their own tab out of sight. Only the strip scrolls, never
  // the page (scrollIntoView could move the window too).
  useLayoutEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !link) return;
    const navBox = nav.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    nav.scrollLeft += linkBox.left - navBox.left - (navBox.width - linkBox.width) / 2;
  }, [active, links.length]);

  return (
    <nav ref={navRef} aria-label="Settings sections" className={cn("mb-6 overflow-x-auto border-b border-border", overflow && FADE_CLASS[overflow], className)}>
      <ul ref={listRef} className="flex min-w-max items-center gap-5">
        {links.map((link) => (
          <li key={link.id}>
            <Link
              to={link.to}
              aria-current={active === link.id ? "page" : undefined}
              className={cn(
                linkClass,
                "rounded-t-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                active === link.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Which edges of the strip hide tabs, so a soft fade there says "more this way". Followed as the
 * strip scrolls and as the screen or the list of tabs changes size.
 */
function useOverflow(scroller: RefObject<HTMLElement | null>, content: RefObject<HTMLElement | null>): Overflow {
  const [overflow, setOverflow] = useState<Overflow>(null);
  useEffect(() => {
    const container = scroller.current;
    if (!container) return;
    const update = () => {
      // A couple of pixels of slack: fractional widths never fully reach the end.
      const left = container.scrollLeft > 2;
      const right = container.scrollWidth - container.clientWidth - container.scrollLeft > 2;
      setOverflow(left && right ? "both" : left ? "left" : right ? "right" : null);
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (content.current) observer.observe(content.current);
    container.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", update);
    };
  }, [scroller, content]);
  return overflow;
}
