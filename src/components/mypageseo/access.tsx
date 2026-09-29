import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import {
  accessDeniedReason,
  hasPermission,
  resolveAccessProfile,
  type AccessProfile,
  type Permission,
} from "@/lib/mypageseo/access";
import { useAccountType, useWorkspace } from "@/lib/mypageseo/workspace";

/** Access for the signed-in user, for gating routes, menu items and actions. */
export function useAccess(): AccessProfile & { can: (permission: Permission) => boolean } {
  const accountType = useAccountType();
  const profile = resolveAccessProfile(accountType);
  return { ...profile, can: (permission) => hasPermission(profile, permission) };
}

/** The shared access-denied panel. Used inside a page and on /403. */
export function AccessDeniedPanel({
  description,
  className,
}: {
  description: string;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        "mx-auto flex max-w-xl flex-col items-center rounded-lg border border-border bg-surface px-6 py-12 text-center shadow-card"
      }
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-brand-tint text-primary">
        <Lock className="size-4.5" aria-hidden />
      </span>
      <h2 className="mt-4 text-base font-semibold text-foreground">
        You don&apos;t have access to this page
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" asChild>
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/help">Help &amp; support</Link>
        </Button>
      </div>
    </div>
  );
}

/** Full access-denied screen inside the application shell. */
export function AccessDeniedScreen({ description }: { description: string }) {
  return (
    <AppShell>
      <PageHeader
        title="Access denied"
        description="This part of Mypageseo is not available to your account."
      />
      <AccessDeniedPanel description={description} />
    </AppShell>
  );
}

/**
 * Route-level gate. Renders the children when the permission is held and the
 * professional access state when it is not — never a blank screen and never a
 * redirect to an unrelated page.
 */
export function RequireAccess({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const access = useAccess();
  const { status } = useWorkspace();
  // Wait for the real account type before deciding, so access is never denied on a guess.
  if (status === "loading") {
    return (
      <AppShell>
        <div role="status" aria-live="polite" aria-label="Loading" className="h-64 animate-pulse rounded-lg bg-muted" />
      </AppShell>
    );
  }
  if (access.can(permission)) return <>{children}</>;
  return <AccessDeniedScreen description={accessDeniedReason(permission, access.accountType)} />;
}

/** Renders children only when the permission is held. Use for buttons and menu items. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const access = useAccess();
  return <>{access.can(permission) ? children : fallback}</>;
}
