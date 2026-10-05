import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, LogOut, ShieldAlert } from "lucide-react";
import { signOutStaff, type StaffAdmin } from "@/api";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/layout/shared/feedback/states";
import logoUrl from "@/assets/logo.png";
import { canRunAudits, useStaffMe, useStaffToken, type StaffRedirectState } from "@/lib/staff/staff-session";

/**
 * Staff pages: a signed-in staff member whose permissions include `audits.run`.
 * No token sends them to the staff login; without the permission they see why.
 */
export function StaffGate({ children }: { children: (admin: StaffAdmin) => ReactNode }) {
  const token = useStaffToken();
  const me = useStaffMe(token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/staff/login" replace state={{ from: `${location.pathname}${location.search}` } satisfies StaffRedirectState} />;
  }
  if (me.isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-background" role="status">
        <LoaderCircle aria-hidden className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (me.isError) {
    return (
      <StaffShell admin={null}>
        <ErrorState description="Your staff account couldn't be loaded." onRetry={() => void me.refetch()} />
      </StaffShell>
    );
  }
  if (!canRunAudits(me.data.permissions)) {
    return (
      <StaffShell admin={me.data}>
        <div className="mx-auto mt-10 max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-card">
          <ShieldAlert aria-hidden className="mx-auto size-8 text-warning" />
          <h1 className="mt-3 text-lg font-semibold">No access to sales audits</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your role ({me.data.role_name}) can't run audits. Ask an administrator for the Sales Representative role.
          </p>
          <Button className="mt-5" variant="outline" onClick={signOutStaff}>
            <LogOut aria-hidden /> Sign out
          </Button>
        </div>
      </StaffShell>
    );
  }
  return <>{children(me.data)}</>;
}

/** Top bar for staff pages: logo, "Staff" tag, who's signed in, sign out. */
export function StaffShell({ admin, children }: { admin: StaffAdmin | null; children: ReactNode }) {
  const queryClient = useQueryClient();
  const signOut = () => {
    signOutStaff();
    queryClient.removeQueries({ queryKey: ["staff"] });
  };
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/staff/audits" className="flex items-center gap-2.5">
            <img src={logoUrl} alt="MyPageSEO" className="h-7 w-auto" />
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">Staff</span>
          </Link>
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">Sales audit</span>
          {admin ? (
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium text-foreground">{admin.name}</p>
                <p className="text-xs text-muted-foreground">{admin.role_name}</p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut aria-hidden /> Sign out
              </Button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
