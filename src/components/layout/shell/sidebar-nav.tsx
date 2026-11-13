import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Sparkles } from "lucide-react";
import { preloadPath } from "@/app/route-preload";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_GROUPS, navHref, navItemHref, type NavGroup, type NavItem } from "@/lib/mypageseo/navigation";
import { cn } from "@/lib/utils";
import { SidebarLocationSwitcher } from "./sidebar-location-switcher";
import { preloadHandlers, useShellNavigation, type ShellNavigation } from "./use-shell-nav";

/**
 * 32px rows for a mouse (so the whole menu, AI and White Label included, fits a laptop screen),
 * 36px on touch screens (minimum touch target).
 */
const ROW =
  "relative flex h-8 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 pointer-coarse:h-9 focus-visible:ring-2 focus-visible:ring-sidebar-ring motion-reduce:transition-none";
const ROW_IDLE = "text-sidebar-foreground hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground";
/** The current section: filled row plus an indicator bar on the sidebar's edge. */
const ROW_CURRENT =
  "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:content-['']";
/**
 * 32px rows for a mouse (28px on short screens, so an open section doesn't push the AI group out
 * of view), 36px on touch screens (minimum touch target).
 */
const CHILD =
  "relative flex h-8 items-center rounded-md px-2.5 text-[13px] pointer-coarse:h-9 [@media(max-height:820px)]:pointer-fine:h-7 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sidebar-ring motion-reduce:transition-none";
const CHILD_IDLE = "text-sidebar-muted hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground";
/** The current sub-page: bright text and a dot on the section's rule. */
const CHILD_CURRENT =
  "font-semibold text-sidebar-accent-foreground before:absolute before:-left-[16.5px] before:top-1/2 before:size-2 before:-translate-y-1/2 before:rounded-full before:content-['']";

/** Space between the menu's groups; tighter on short screens (a 768px laptop), so more of it fits. */
const GROUP = "not-first:mt-3 [@media(max-height:820px)]:not-first:mt-2";

type RowState = "link" | "pending" | "disabled";

/**
 * The primary menu. Location pages link straight to `/locations/:id/…` for the location in the
 * switcher card, the most specific match is highlighted, and a section with sub-pages opens
 * while you are in it (its row opens the first sub-page; the chevron only opens or closes it).
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useShellNavigation();
  // Sections opened or closed by hand; an untouched section is open while you are in it.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeKey = `${nav.active?.itemId ?? ""}/${nav.active?.childId ?? ""}`;
  const { overflowing, moreBelow } = useMenuOverflow(navRef, listRef);

  // A section closed by hand opens again when one of its pages opens, so the current page is
  // always listed (and announced). Closing it while staying on the page keeps it closed.
  const [seenKey, setSeenKey] = useState(activeKey);
  if (seenKey !== activeKey) {
    setSeenKey(activeKey);
    const activeId = nav.active?.itemId;
    if (activeId && toggled[activeId] === false) setToggled(({ [activeId]: _closed, ...rest }) => rest);
  }

  // The menu scrolls on its own on short screens: keep the current page in view.
  useEffect(() => {
    const container = navRef.current;
    const current = container?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!container || !current) return;
    const box = container.getBoundingClientRect();
    const row = current.getBoundingClientRect();
    if (row.top < box.top) container.scrollTop -= box.top - row.top + 12;
    else if (row.bottom > box.bottom) container.scrollTop += row.bottom - box.bottom + 12;
  }, [activeKey]);

  const isOpen = (item: NavItem) => toggled[item.id] ?? nav.active?.itemId === item.id;
  const setOpen = (item: NavItem, open: boolean) => setToggled((current) => ({ ...current, [item.id]: open }));

  const showRest = () => {
    const container = navRef.current;
    if (!container) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({ top: container.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <nav
        ref={navRef}
        aria-label="Primary"
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-3 [scrollbar-color:var(--color-sidebar-border)_transparent] [scrollbar-width:thin] [@media(max-height:820px)]:pb-2 [@media(max-height:820px)]:pt-2",
          // While part of the menu is out of view, its bottom edge fades above the "More" cue.
          moreBelow && "[mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]",
        )}
      >
        <div ref={listRef}>
          {NAV_GROUPS.map((group) => (
            <NavGroupSection
              key={group.id}
              group={group}
              nav={nav}
              isOpen={isOpen}
              setOpen={setOpen}
              {...(onNavigate ? { onNavigate } : {})}
            />
          ))}
        </div>
      </nav>
      {overflowing ? (
        // A strip of its own under the menu, so the cue never covers a row. It stays while the menu
        // is taller than the space (only the cue goes once the end is in view), so the menu doesn't
        // jump as it reaches its end.
        <div className="flex h-8 shrink-0 items-center justify-end px-3 pointer-coarse:h-11">
          {moreBelow ? (
            // A pointer shortcut only: keyboard and screen-reader users reach every link in order,
            // and the menu scrolls to whichever has focus.
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              title="Show the rest of the menu"
              // Not focused by a click either: it disappears once the menu reaches its end.
              onMouseDown={(event) => event.preventDefault()}
              onClick={showRest}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-sidebar-accent pl-2.5 pr-2 text-xs font-semibold text-sidebar-accent-foreground shadow-raised ring-1 ring-inset ring-sidebar-primary/60 outline-none transition-colors hover:bg-sidebar-primary hover:text-sidebar-primary-foreground pointer-coarse:h-9 motion-safe:animate-in motion-safe:fade-in-0"
            >
              More
              <ChevronDown aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Whether the menu is taller than its space (short screens, sections open), and whether part of
 * it is still out of view below.
 */
function useMenuOverflow(scroller: RefObject<HTMLElement | null>, content: RefObject<HTMLElement | null>): { overflowing: boolean; moreBelow: boolean } {
  const [state, setState] = useState({ overflowing: false, moreBelow: false });
  useEffect(() => {
    const container = scroller.current;
    if (!container) return;
    const update = () => {
      // Out of view means more than the menu's bottom padding (8–16px).
      const slack = (Number.parseFloat(getComputedStyle(container).paddingBottom) || 0) + 4;
      // Measured against the menu's whole space (strip included), so the strip doesn't keep
      // itself on screen once the menu fits again.
      const room = container.parentElement?.clientHeight ?? container.clientHeight;
      const overflowing = container.scrollHeight - room > slack;
      const moreBelow = container.scrollHeight - container.scrollTop - container.clientHeight > slack;
      setState((current) => (current.overflowing === overflowing && current.moreBelow === moreBelow ? current : { overflowing, moreBelow }));
    };
    // The window resizing, sections opening and items loading all change what fits.
    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (content.current) observer.observe(content.current);
    container.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", update);
    };
  }, [scroller, content]);
  return state;
}

function NavGroupSection({
  group,
  nav,
  isOpen,
  setOpen,
  onNavigate,
}: {
  group: NavGroup;
  nav: ShellNavigation;
  isOpen: (item: NavItem) => boolean;
  setOpen: (item: NavItem, open: boolean) => void;
  onNavigate?: () => void;
}) {
  const labelId = useId();
  const items = nav.items.filter((item) => item.group === group.id);
  const rows = items.map((item) => (
    <NavRow
      key={item.id}
      item={item}
      nav={nav}
      ai={group.id === "ai"}
      open={isOpen(item)}
      onOpenChange={(open) => setOpen(item, open)}
      {...(onNavigate ? { onNavigate } : {})}
    />
  ));

  if (!group.labelled) {
    return (
      <div className={GROUP}>
        <SidebarLocationSwitcher {...(onNavigate ? { onNavigate } : {})} />
        <ul aria-label="Location pages" className="mt-1.5 space-y-0.5 [@media(max-height:820px)]:mt-1">
          {rows}
        </ul>
      </div>
    );
  }

  // Workspace entries depend on the account type and role: placeholders until they're known,
  // so items never pop in or swap (Reports → White Label) after the first paint.
  const pending = group.id === "workspace" && !nav.accountKnown;
  if (!items.length && !pending) return null;
  return (
    <div className={GROUP}>
      <p
        id={labelId}
        className="mb-1 flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-muted [@media(max-height:820px)]:mb-0.5"
      >
        {group.label}
        {group.id === "ai" ? <Sparkles aria-hidden className="size-3.5 text-ai-bright" /> : null}
      </p>
      {pending ? (
        <div aria-hidden className="space-y-0.5">
          {[0, 1].map((key) => (
            <div key={key} className="flex h-8 items-center gap-3 px-3 pointer-coarse:h-9">
              <span className="size-[18px] rounded bg-sidebar-accent motion-safe:animate-pulse" />
              <span className="h-3 w-24 rounded bg-sidebar-accent motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <ul aria-labelledby={labelId} className="space-y-0.5">
          {rows}
        </ul>
      )}
    </div>
  );
}

function NavRow({
  item,
  nav,
  ai,
  open,
  onOpenChange,
  onNavigate,
}: {
  item: NavItem;
  nav: ShellNavigation;
  ai: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}) {
  const childListId = useId();
  const Icon = item.icon;
  const href = navItemHref(item, nav.navLocationId);
  const current = nav.active?.itemId === item.id;
  const children = item.children ?? [];
  const state: RowState = href ? "link" : nav.state === "loading" ? "pending" : "disabled";

  const icon = (
    <Icon
      aria-hidden
      className={cn(
        "size-[18px] shrink-0 transition-colors",
        state === "disabled"
          ? "text-sidebar-muted"
          : ai
            ? "text-ai-bright"
            : current
              ? "text-sidebar-primary"
              : "text-sidebar-icon group-hover/row:text-sidebar-accent-foreground",
      )}
    />
  );
  const soon = item.soon ? (
    <span
      className={cn(
        "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-none tracking-wide ring-1 ring-inset",
        ai ? "text-ai-bright ring-ai-bright/50" : "text-sidebar-muted ring-sidebar-border",
      )}
    >
      Soon
    </span>
  ) : null;

  if (state !== "link" || !href) {
    // A location page while there is no location to open it for.
    const row = (
      <span
        className={cn(ROW, state === "disabled" ? "cursor-not-allowed text-sidebar-muted" : "text-sidebar-foreground")}
        {...(state === "disabled" ? { role: "link", "aria-disabled": true, tabIndex: 0 } : { "aria-busy": true })}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </span>
    );
    return (
      <li>
        {state === "disabled" ? (
          <Tooltip>
            <TooltipTrigger asChild>{row}</TooltipTrigger>
            <TooltipContent side="right">{nav.noLocationReason}</TooltipContent>
          </Tooltip>
        ) : (
          row
        )}
      </li>
    );
  }

  const onlyPage = current && nav.active?.childId === null;
  // The current page sits in this section but it's closed: say so on the row. "true", not
  // "page": the row opens the section's first page, which may not be the current one.
  const currentHidden = current && !onlyPage && children.length > 0 && !open;
  return (
    <li>
      <div className="group/row relative">
        <Link
          to={href}
          onClick={() => {
            if (children.length) onOpenChange(true);
            onNavigate?.();
          }}
          {...preloadHandlers(() => preloadPath(href))}
          aria-current={onlyPage ? "page" : currentHidden ? "true" : undefined}
          className={cn(
            ROW,
            current ? cn(ROW_CURRENT, ai ? "before:bg-ai-bright" : "before:bg-sidebar-primary") : ROW_IDLE,
            children.length && "pr-10",
          )}
        >
          {icon}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {soon}
        </Link>
        {children.length ? (
          <button
            type="button"
            onClick={() => onOpenChange(!open)}
            aria-expanded={open}
            aria-controls={childListId}
            aria-label={`${open ? "Hide" : "Show"} ${item.label} pages`}
            className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-lg text-sidebar-icon outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
          </button>
        ) : null}
      </div>
      {children.length && open ? (
        <ul
          id={childListId}
          className="mb-1.5 ml-[21px] mt-1 space-y-0.5 border-l border-sidebar-border pl-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1"
        >
          {children.map((child) => {
            const childHref = navHref(child, nav.navLocationId) ?? href;
            const currentChild = current && nav.active?.childId === child.id;
            return (
              <li key={child.id}>
                <Link
                  to={childHref}
                  onClick={onNavigate}
                  {...preloadHandlers(() => preloadPath(childHref))}
                  aria-current={currentChild ? "page" : undefined}
                  className={cn(CHILD, currentChild ? cn(CHILD_CURRENT, ai ? "before:bg-ai-bright" : "before:bg-sidebar-primary") : CHILD_IDLE)}
                >
                  <span className="truncate">{child.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
