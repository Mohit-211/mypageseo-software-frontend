import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, MoreHorizontal, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Canonical MyPageSEO data-table primitives.
 *
 * Every operational list (locations, keywords, citations, competitors,
 * reports, automations, clients, team, notifications…) composes these so
 * headers, row spacing, sort indicators, toolbars, pagination and row action
 * menus stay identical across the product.
 *
 * These components only present data that a screen already has — they never
 * fetch, filter or invent rows, sort keys or filter options.
 */

export type SortOrder = "asc" | "desc";

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

/** Bordered surface that wraps a table, its toolbar and its pagination. */
export function TableCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card", className)}>
      {children}
    </div>
  );
}

/**
 * Horizontal scroll container. `minWidth` keeps columns readable on small screens. While columns are
 * out of view on the right, a soft fade at that edge says the table scrolls (phone browsers hide the
 * scrollbar, so a cut-off column otherwise looks like the end of the table).
 */
export function TableScroll({
  minWidth = 880,
  label,
  className,
  children,
}: {
  minWidth?: number;
  /** Accessible name for the scrollable table region, e.g. "Tracked keywords". */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const update = () => setMore(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
    // The observer also reports the first size, so the fade is right from the start; observing the
    // table too catches rows that arrive later.
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div className="relative min-w-0">
      <div
        ref={scroller}
        {...(label ? { role: "region", "aria-label": label, tabIndex: 0 } : {})}
        className={cn(
          "data-grid-scroll relative w-full min-w-0 max-w-full overflow-x-auto outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring",
          className,
        )}
      >
        <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
      {more ? <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-card" /> : null}
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-surface-strong">
      <tr className="border-b border-border-strong">{children}</tr>
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TableRow({
  className,
  selected,
  children,
}: {
  className?: string;
  /** Highlights the row (the selected item, or "you" in a ranking). */
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <tr
      data-selected={selected ? "true" : undefined}
      className={cn("transition-colors hover:bg-accent/60 data-[selected=true]:bg-brand-tint", className)}
    >
      {children}
    </tr>
  );
}

// Headers may wrap onto two lines: uppercase labels are wide, and a table that scrolls sideways
// hides its last columns (often the row actions).
export const thClass = "px-4 py-2.5 align-middle text-xs font-semibold uppercase leading-4 tracking-wide text-muted-foreground";
export const tdClass = "px-4 py-3 text-sm text-foreground align-middle";
export const tdMutedClass = "px-4 py-3 text-sm text-muted-foreground align-middle";
/** Right-aligned numeric cell: tabular figures so digits line up down the column. */
export const tdNumberClass = "px-4 py-3 text-right text-sm tabular-nums text-foreground align-middle";

/** Plain, non-sortable column header. */
export function Th({
  className,
  align = "left",
  srOnly,
  children,
}: {
  className?: string;
  align?: "left" | "right";
  srOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <th scope="col" className={cn(thClass, align === "right" && "text-right", className)}>
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

/** Sortable column header with a consistent indicator and aria-sort state. */
export function SortableTh<T extends string>({
  label,
  value,
  active,
  order,
  onSort,
  disabled,
  align = "left",
  className,
}: {
  label: string;
  value: T;
  active: T | null;
  order: SortOrder;
  onSort: (value: T) => void;
  disabled?: boolean | undefined;
  align?: "left" | "right";
  className?: string;
}) {
  const isActive = active === value;
  const Icon = !isActive ? ChevronsUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={isActive ? (order === "asc" ? "ascending" : "descending") : "none"}
      className={cn(thClass, align === "right" && "text-right", className)}
    >
      <button
        type="button"
        disabled={disabled ?? false}
        onClick={() => onSort(value)}
        className={cn(
          "group/sort -mx-1.5 -my-1 inline-flex min-h-8 cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-1 text-left text-xs font-semibold uppercase leading-4 tracking-wide transition-colors outline-hidden pointer-coarse:min-h-9 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          align === "right" && "flex-row-reverse text-right",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <Icon
          className={cn("size-3 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover/sort:text-foreground")}
          aria-hidden
        />
      </button>
    </th>
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar                                                                    */
/* -------------------------------------------------------------------------- */

/** Search + filter controls above a table, with a single consistent reset. */
export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search",
  searchLabel,
  searchDisabled,
  filtersActive,
  onReset,
  className,
  children,
}: {
  search?: string | undefined;
  onSearchChange?: ((value: string) => void) | undefined;
  searchPlaceholder?: string;
  searchLabel?: string;
  searchDisabled?: boolean | undefined;
  filtersActive?: boolean | undefined;
  onReset?: (() => void) | undefined;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      {onSearchChange ? (
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search ?? ""}
            disabled={searchDisabled ?? false}
            aria-label={searchLabel ?? searchPlaceholder}
            placeholder={searchPlaceholder}
            // The app's search APIs accept at most 100 characters.
            maxLength={100}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-9 pl-9"
          />
        </div>
      ) : (
        <span className="hidden lg:block" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {onReset ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!filtersActive}
            onClick={onReset}
          >
            <RotateCcw aria-hidden /> Reset
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Small chip describing an applied filter, shown under the toolbar. */
export function ActiveFilterChips({
  filters,
  className,
}: {
  filters: { label: string; value: string; onClear?: (() => void) | undefined }[];
  className?: string;
}) {
  if (filters.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-b border-border bg-surface-strong px-4 py-2", className)}>
      <span className="text-xs font-medium text-muted-foreground">Filtered by</span>
      {filters.map((filter) => (
        <span
          key={`${filter.label}-${filter.value}`}
          className="inline-flex min-h-6 items-center gap-1 rounded-full border border-primary/20 bg-brand-tint py-0.5 pl-2.5 pr-2.5 text-xs font-medium text-primary has-[button]:pr-1"
        >
          <span>{filter.label}:</span>
          <span className="text-foreground">{filter.value}</span>
          {filter.onClear ? (
            <button
              type="button"
              onClick={filter.onClear}
              aria-label={`Clear ${filter.label} filter`}
              className="relative grid size-5 cursor-pointer place-items-center rounded-full text-primary outline-hidden after:absolute after:-inset-1.5 after:content-[''] hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" aria-hidden />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Consistent pagination footer. Callers keep their own filter/sort state, so
 * changing page never resets what is currently applied.
 */
export function TablePagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  itemLabel = "results",
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  totalItems?: number | undefined;
  pageSize?: number | undefined;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const safeCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safeCount);
  const range =
    totalItems !== undefined && pageSize !== undefined && totalItems > 0
      ? `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalItems)} of ${totalItems.toLocaleString()} ${itemLabel}`
      : totalItems !== undefined
        ? `${totalItems.toLocaleString()} ${itemLabel}`
        : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {range ? `${range} · ` : ""}Page {safePage} of {safeCount}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          disabled={safePage >= safeCount}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row actions                                                                */
/* -------------------------------------------------------------------------- */

/** Consistent “…” row action menu. Items are supplied by the screen. */
export function RowActions({
  label,
  children,
  disabled,
  contentClassName,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean | undefined;
  /** Menu width or other classes for the menu panel (default `w-52`); e.g. `w-60` for longer item labels. */
  contentClassName?: string;
}) {
  return (
    // 32px keeps dense rows compact; the ::after pads the touch target out to 40px.
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 text-muted-foreground after:absolute after:-inset-1 after:content-[''] hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          aria-label={label}
          disabled={disabled ?? false}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("w-52", contentClassName)}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mobile structured-list row used where a table would be unreadable. */
export function MobileListRow({ className, children }: { className?: string; children: ReactNode }) {
  return <article className={cn("px-4 py-3.5", className)}>{children}</article>;
}

/** Label/value pair inside a mobile structured-list row. */
export function MobileField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
