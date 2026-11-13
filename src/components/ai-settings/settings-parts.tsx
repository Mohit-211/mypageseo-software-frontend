/**
 * Building blocks of the AI settings page (`/locations/:locationId/ai/settings`): the section card
 * with its anchor, a setting's label row with the "Default" tag and "Use default", the character
 * count, a read-only value for client users, and the "Leave without saving?" guard.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { useBlocker } from "react-router-dom";
import { AlertCircle, RotateCcw, type LucideIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** One section of the page: a card with an anchor (`#replies`, `#facts`, …) under the sticky header. */
export function SettingsCard({
  id,
  icon,
  title,
  description,
  badge,
  actions,
  children,
}: {
  /** The anchor and the heading's id prefix. */
  id: string;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  /** What uses it ("Used by AI review replies"), next to the title. */
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={titleId} className="min-w-0 scroll-mt-20 rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-[1_1_18rem] items-start gap-3">
          <IconChip icon={icon} tone="ai" size="sm" className="-mt-0.5" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* Focusable from script only: where focus goes when the control that had it is gone (a deleted fact's row). */}
              <h2
                id={titleId}
                tabIndex={-1}
                className="scroll-mt-24 rounded-sm text-[15px] font-semibold leading-6 text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                {title}
              </h2>
              {badge}
            </div>
            <div className="mt-0.5 max-w-3xl text-[13px] text-muted-foreground">{description}</div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** "Default" next to a setting whose value in force is (or will be, once saved) its default. */
export function DefaultTag({ pending = false }: { pending?: boolean }) {
  return (
    <StatusBadge tone="neutral" size="sm" className={pending ? "border-dashed" : undefined}>
      {pending ? "Default once saved" : "Default"}
    </StatusBadge>
  );
}

/** A setting's label line: the name, the "Default" tag, and "Use default" when a value the user set is in force. */
export function SettingLabel({
  htmlFor,
  id,
  label,
  isDefault,
  pendingDefault = false,
  onUseDefault,
}: {
  /** The control it labels. */
  htmlFor?: string;
  /** Without `htmlFor`: the text's id, for a group labelled by it (`aria-labelledby`). */
  id?: string;
  label: string;
  isDefault: boolean;
  /** The default comes back with the next save (not yet in force). */
  pendingDefault?: boolean;
  onUseDefault?: (() => void) | undefined;
}) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="leading-5">
            {label}
          </Label>
        ) : (
          <span id={id} className="text-sm font-medium leading-5 text-foreground">
            {label}
          </span>
        )}
        {isDefault ? <DefaultTag pending={pendingDefault} /> : null}
      </div>
      {onUseDefault ? (
        <Button type="button" variant="ghost" size="sm" className="-mr-2 text-muted-foreground hover:text-foreground" onClick={onUseDefault}>
          <RotateCcw aria-hidden /> Use default
        </Button>
      ) : null}
    </div>
  );
}

/** "123 / 1,000" under a text field; amber near the limit. */
export function CharCount({ id, count, max }: { id?: string; count: number; max: number }) {
  const near = count > max * 0.9;
  return (
    <span id={id} className={cn("shrink-0 text-xs tabular-nums", near ? "font-medium text-warning-foreground" : "text-muted-foreground")}>
      {count.toLocaleString()} / {max.toLocaleString()}
      <span className="sr-only"> characters</span>
    </span>
  );
}

/** The line under a control: its error, else its hint; the character count on the right. */
export function FieldFoot({ id, error, hint, count }: { id: string; error?: string | null | undefined; hint?: ReactNode; count?: ReactNode }) {
  if (!error && !hint && !count) return null;
  return (
    <div className="mt-1.5 flex items-start justify-between gap-3">
      {error ? (
        <p id={id} role="alert" className="flex min-w-0 items-start gap-1 text-xs font-medium text-critical">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : (
        <div id={id} className="min-w-0 space-y-1 text-xs text-muted-foreground">
          {hint}
        </div>
      )}
      {count}
    </div>
  );
}

/** A setting's value as text, for people who can't change it (client users). */
export function ReadOnlyValue({ value, empty = "None", className }: { value: string | null | undefined; empty?: string; className?: string }) {
  const text = value?.trim();
  return (
    <p
      className={cn(
        "mt-1.5 whitespace-pre-line break-words rounded-lg border border-border bg-surface-strong px-3 py-2 text-sm",
        text ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {text || empty}
    </p>
  );
}

/**
 * Asks before leaving the page (another page, not one of its sections) with unsaved changes, and
 * before closing the tab. One per page: the router allows a single blocker at a time.
 */
export function LeaveGuard({ when, description }: { when: boolean; description: string }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname);
  // Set by "Leave": the dialog's own close must not reset the blocker then. For browser Back the router
  // replays the navigation a moment after proceed(); a reset in between would block that replay again.
  const leavingRef = useRef(false);
  useEffect(() => {
    if (blocker.state === "unblocked" || !when) leavingRef.current = false;
  }, [blocker.state, when]);
  useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [when]);

  return (
    <ConfirmDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open && !leavingRef.current) blocker.reset?.();
      }}
      title="Leave without saving?"
      description={description}
      confirmLabel="Leave"
      cancelLabel="Stay"
      onConfirm={() => {
        leavingRef.current = true;
        blocker.proceed?.();
      }}
    />
  );
}
