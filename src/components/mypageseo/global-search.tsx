import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, Search, X } from "lucide-react";
import { getTracking } from "@/api";
import { preloadPath } from "@/app/route-preload";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { useNavLocation } from "@/components/layout/shell/use-shell-nav";
import { WindowOnScreen } from "@/components/ui/dialog";
import { pageHeading } from "@/components/ui/focus-return";
import { keepOpenOnToasts } from "@/components/ui/open-windows";
import { useAccess } from "@/hooks/use-access";
import { appPathname } from "@/lib/app-navigation";
import {
  buildSearchIndex,
  flattenGroups,
  readRecentSearchIds,
  rememberSearchId,
  searchIndex,
  searchSuggestions,
  type SearchGroup,
  type SearchResult,
} from "@/lib/mypageseo/global-search";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { rankingsKey } from "@/lib/rankings/use-rankings";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "Search pages, locations and keywords";
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
const SHORTCUT_LABEL = IS_MAC ? "⌘K" : "Ctrl K";

/** Typing in a field: "/" types a slash there instead of opening search. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * Global search and quick navigation. The header shows it as a wide search field (an icon on
 * phones); it opens a search dialog, also with ⌘K / Ctrl+K from anywhere and "/" outside fields.
 * Closed, focus goes back where it was: what had it before ⌘K or "/", else the search button on
 * screen (Radix would focus the last of the two buttons, hidden on wide screens). After a result
 * is picked, the page's heading takes it: AppLayout's for a new page, here for the page on screen
 * (a result for it, or one of its #sections, changes no page).
 */
export function GlobalSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const returnTo = useRef<HTMLElement | null>(null);
  const picked = useRef<"other page" | "same page" | null>(null);
  const fieldButton = useRef<HTMLButtonElement>(null);
  const iconButton = useRef<HTMLButtonElement>(null);
  const returnFocus = (event: Event) => {
    event.preventDefault();
    const from = returnTo.current;
    returnTo.current = null;
    const pick = picked.current;
    picked.current = null;
    // A result's new page, or a post opened over the search ("Open it"), has the focus or is about to take it.
    const active = document.activeElement;
    if (pick === "other page" || (active && active !== document.body)) return;
    const button = [fieldButton.current, iconButton.current].find((entry) => entry !== null && entry.offsetParent !== null);
    ((pick === "same page" ? pageHeading() : null) ?? (from?.isConnected ? from : button))?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      // "/" stays out of the way of other dialogs (⌘K is explicit enough to open over them).
      const otherDialogOpen = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') !== null;
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !otherDialogOpen && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <div className={cn("flex min-w-0 items-center", className)}>
        <DialogPrimitive.Trigger asChild>
          <button
            ref={fieldButton}
            type="button"
            aria-label={PLACEHOLDER}
            aria-keyshortcuts="Meta+K Control+K"
            className="hidden h-9 w-full min-w-0 items-center gap-2.5 rounded-lg border border-input bg-background px-3 text-left text-sm text-muted-foreground shadow-xs outline-none transition-colors hover:border-border-strong hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex"
          >
            <Search aria-hidden className="size-4 shrink-0" />
            {/* The full hint where the field is wide; one word on tablets, where it would be cut. */}
            <span className="min-w-0 flex-1 truncate">
              <span className="lg:hidden">Search</span>
              <span className="hidden lg:inline">{PLACEHOLDER}</span>
            </span>
            <kbd className="hidden shrink-0 rounded-md border border-border bg-surface-strong px-1.5 py-0.5 font-sans text-xs font-medium text-muted-foreground md:inline-block">
              {SHORTCUT_LABEL}
            </kbd>
          </button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Trigger asChild>
          <button
            ref={iconButton}
            type="button"
            aria-label="Search"
            className="grid size-9 place-items-center rounded-md text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
          >
            <Search aria-hidden className="size-5" />
          </button>
        </DialogPrimitive.Trigger>
      </div>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          // A press on a toast leaves the search open, with its query (ui/open-windows.ts).
          onPointerDownOutside={keepOpenOnToasts(undefined)}
          onInteractOutside={keepOpenOnToasts(undefined)}
          onOpenAutoFocus={() => {
            const active = document.activeElement;
            returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
          }}
          onCloseAutoFocus={returnFocus}
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-popover text-popover-foreground shadow-elevated outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 sm:inset-x-4 sm:bottom-auto sm:top-[12vh] sm:mx-auto sm:max-h-[min(36rem,76vh)] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-border sm:data-[state=open]:zoom-in-[0.98] motion-reduce:animate-none"
        >
          {/* It holds nothing to lose: "Open it" on a post's toast closes it and goes on. */}
          <WindowOnScreen onGiveWay={() => setOpen(false)} />
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <SearchPanel
            onClose={(to) => {
              picked.current = new URL(to, window.location.href).pathname === appPathname() ? "same page" : "other page";
              setOpen(false);
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Mounted while the dialog is open, so every opening starts from an empty query. */
function SearchPanel({ onClose }: { onClose: (to: string) => void }) {
  const navigate = useNavigate();
  const { organization, locations, clients, setActiveClientId, setActiveLocationId } = useWorkspace();
  const access = useAccess();
  const { navLocationId } = useNavLocation();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds] = useState<string[]>(readRecentSearchIds);

  // The current location's tracked keywords (shared cache with the rankings pages).
  const tracking = useQuery({
    queryKey: [...rankingsKey(navLocationId ?? "none"), "tracking"],
    queryFn: ({ signal }) => getTracking(navLocationId!, signal),
    enabled: Boolean(navLocationId),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const keywords = useMemo(() => tracking.data?.tracking.keywords.map((keyword) => keyword.text) ?? [], [tracking.data]);

  const accountType = organization?.accountType === "agency" ? "agency" : "business";
  // A stable key: `access.can` is a new function on every render.
  const permissionKey = access.permissions.join("|");
  const entries = useMemo(() => {
    const allowed = new Set(permissionKey.split("|"));
    return buildSearchIndex({
      accountType,
      can: (permission) => allowed.has(permission),
      navLocationId,
      locations,
      clients,
      keywords,
    });
  }, [accountType, permissionKey, navLocationId, locations, clients, keywords]);

  const groups: SearchGroup[] = useMemo(
    () => (query.trim() ? searchIndex(entries, query) : searchSuggestions(entries, recentIds)),
    [entries, query, recentIds],
  );
  const flat = useMemo(() => flattenGroups(groups), [groups]);
  const current = Math.min(activeIndex, Math.max(flat.length - 1, 0));
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  function select(result: SearchResult) {
    rememberSearchId(result.id);
    if (result.locationId) setActiveLocationId(result.locationId);
    if (result.clientId) setActiveClientId(result.clientId);
    onClose(result.to);
    navigate(result.to);
  }

  function moveTo(index: number) {
    const result = flat[index];
    if (!result) return;
    setActiveIndex(index);
    preloadPath(result.to);
    document.getElementById(optionId(index))?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!flat.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveTo((current + (event.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length);
    } else if ((event.key === "Home" || event.key === "End") && event.ctrlKey) {
      event.preventDefault();
      moveTo(event.key === "Home" ? 0 : flat.length - 1);
    } else if (event.key === "Enter") {
      const result = flat[current];
      if (result) {
        event.preventDefault();
        select(result);
      }
    }
  }

  const trimmed = query.trim();
  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4">
        <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={flat.length ? optionId(current) : undefined}
          aria-label="Search pages, locations and keywords"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={PLACEHOLDER}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        <DialogPrimitive.Close
          aria-label="Close search"
          className="grid h-9 min-w-9 shrink-0 place-items-center rounded-md px-1.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <kbd className="hidden rounded-md border border-border bg-surface-strong px-1.5 py-0.5 font-sans text-xs font-medium sm:inline-block">Esc</kbd>
          <X aria-hidden className="size-5 sm:hidden" />
        </DialogPrimitive.Close>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {groups.length ? (
          <ul id={listboxId} role="listbox" aria-label="Search results">
            {groups.map((group, groupIndex) => {
              const headingId = `${listboxId}-group-${groupIndex}`;
              return (
                <li key={`${group.id}-${groupIndex}`} role="presentation" className="pb-1">
                  <p id={headingId} className="px-3 pb-1.5 pt-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <ul role="group" aria-labelledby={headingId}>
                    {group.results.map((result) => {
                      const index = flat.indexOf(result);
                      return (
                        <ResultOption
                          key={result.id}
                          id={optionId(index)}
                          result={result}
                          query={trimmed}
                          selected={index === current}
                          onHover={() => {
                            if (index !== current) setActiveIndex(index);
                          }}
                          onSelect={() => select(result)}
                        />
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">{trimmed ? `No matches for “${trimmed}”` : "Nothing to suggest yet"}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {trimmed
                ? "Try a page name (“rank tracker”, “AI replies”), a location or city, or a tracked keyword."
                : "Pages and locations appear here once this workspace has them."}
            </p>
          </div>
        )}
      </div>

      <div className="hidden shrink-0 items-center gap-4 border-t border-border bg-surface-strong px-4 py-2 text-xs text-muted-foreground sm:flex">
        <span className="flex items-center gap-1">
          <Key>↑</Key>
          <Key>↓</Key> to move
        </span>
        <span className="flex items-center gap-1">
          <Key>↵</Key> to open
        </span>
        <span className="flex items-center gap-1">
          <Key>Esc</Key> to close
        </span>
      </div>
    </>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid min-w-5 place-items-center rounded border border-border bg-card px-1 font-sans text-xs font-medium text-foreground">
      {children}
    </kbd>
  );
}

function ResultOption({
  id,
  result,
  query,
  selected,
  onHover,
  onSelect,
}: {
  id: string;
  result: SearchResult;
  query: string;
  selected: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const preload = () => preloadPath(result.to);
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      onPointerMove={onHover}
      onPointerEnter={preload}
      onTouchStart={preload}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors motion-reduce:transition-none",
        selected ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      <IconChip icon={result.icon} tone={result.tone} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          <Highlight text={result.title} query={query} />
        </span>
        {result.context ? <span className="block truncate text-xs text-muted-foreground">{result.context}</span> : null}
      </span>
      <CornerDownLeft aria-hidden className={cn("size-4 shrink-0 text-muted-foreground", selected ? "visible" : "invisible")} />
    </li>
  );
}

/** The query's words in bold teal inside the title. */
function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return <>{text}</>;
  const lower = text.toLowerCase();
  const marks: [number, number][] = [];
  for (const token of tokens) {
    const at = lower.indexOf(token);
    if (at >= 0 && !marks.some(([start, end]) => at < end && at + token.length > start)) marks.push([at, at + token.length]);
  }
  if (!marks.length) return <>{text}</>;
  marks.sort((a, b) => a[0] - b[0]);
  const parts: ReactNode[] = [];
  let cursor = 0;
  marks.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={index} className="bg-transparent font-semibold text-primary">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
