import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Link2, ListTodo, Unlink, type LucideIcon } from "lucide-react";
import type { LocationHeader } from "@/api";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { formatDate } from "@/lib/datetime";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { isBlockingStatus } from "@/lib/locations/location-status";
import { cn } from "@/lib/utils";

const LOOK = {
  warning: { box: "border-warning/40 bg-warning-surface", chip: "bg-card text-warning ring-1 ring-inset ring-warning/30" },
  critical: { box: "border-critical/30 bg-critical-surface", chip: "bg-card text-critical ring-1 ring-inset ring-critical/25" },
} as const;

function Banner({
  tone,
  icon: Icon,
  title,
  children,
  action,
}: {
  tone: keyof typeof LOOK;
  icon: LucideIcon;
  title: string;
  children: string;
  action: ReactNode;
}) {
  return (
    <section role="status" className={cn("flex flex-col gap-4 rounded-xl border p-4 shadow-card sm:flex-row sm:items-center sm:p-5", LOOK[tone].box)}>
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-xl", LOOK[tone].chip)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-6 text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-foreground">{children}</p>
        </div>
      </div>
      {action ? <div className="flex shrink-0 pl-[3.375rem] sm:pl-0">{action}</div> : null}
    </section>
  );
}

/**
 * The one thing blocking this location, with the button that fixes it: unfinished setup, a
 * disconnected Google profile, or Google access to restore. Nothing when all is well.
 */
export function LocationStatusBanner({ location }: { location: LocationHeader }) {
  const { connect } = useGbpConnect();
  const canEdit = useCanEdit();

  // The same rule decides when the Overview's PDF report button steps back to outline.
  if (!isBlockingStatus(location.status)) return null;
  if (location.status === "setup_required") {
    return (
      <Banner
        tone="warning"
        icon={ListTodo}
        title="Finish setting up this location"
        action={
          canEdit ? (
            <Button asChild>
              <Link to={locationSetupPath(location.location_id)}>
                Continue setup <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null
        }
      >
        Choose the keywords and competitors to track, and the first ranking check starts. It takes about two minutes.
      </Banner>
    );
  }
  if (location.status === "gbp_disconnected") {
    return (
      <Banner
        tone="warning"
        icon={Unlink}
        title={`Google profile disconnected${location.gbp_disconnected_at ? ` on ${formatDate(location.gbp_disconnected_at)}` : ""}`}
        action={
          canEdit ? (
            <Button onClick={() => connect()}>
              <Link2 aria-hidden /> Connect again
            </Button>
          ) : null
        }
      >
        Rankings keep working, but profile data, reviews and posts no longer update.
      </Banner>
    );
  }
  if (location.status === "reconnect_required") {
    return (
      <Banner
        tone="critical"
        icon={AlertTriangle}
        title="Reconnect Google"
        action={
          canEdit ? (
            <Button onClick={() => connect()}>
              <Link2 aria-hidden /> Reconnect Google
            </Button>
          ) : null
        }
      >
        Google refused the stored access for this location's account, so profile data, reviews and posts stopped syncing.
      </Banner>
    );
  }
  return null;
}
