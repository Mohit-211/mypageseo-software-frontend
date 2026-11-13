import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Ban, CirclePause, Clock, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/datetime";
import { resolveAccountRestriction, useAccountRestriction, useOrganizationUsage } from "@/lib/billing/use-billing";
import { useAccess } from "@/hooks/use-access";
import { cn } from "@/lib/utils";

/**
 * Trial, grace and read-only banner across the app (FRONTEND_REVIEW_CLAUDE_NOTE §0, §12).
 * Read-only keeps every read working; only money-costing actions answer 402.
 * Suspended has no billing call to action.
 *
 * Words by role:
 * - only the owner can pay (`billing.manage`), so only the owner gets the billing button;
 * - a member (who can see billing but not pay) is told to ask the owner;
 * - a client user (the agency's own customer, no billing access) never sees the agency's trial or
 *   payments. The backend sends the billing block to every member of the organization, so the rule
 *   lives here: no trial or payment banner, and one neutral note while changes are paused.
 * On the billing page itself the button is left out: it would lead where the user already is.
 */
export function AccountStateBanner() {
  const usage = useOrganizationUsage();
  const access = useAccess();
  const canPay = access.can("billing.manage");
  const seesBilling = access.can("billing.view");
  const askOwner = !canPay;
  const onBilling = useLocation().pathname.startsWith("/settings/billing");
  const showBillingAction = canPay && !onBilling;
  const seen = useAccountRestriction();
  const billing = usage.data?.billing;
  const state = billing?.state;
  // The same rule as useWriteBlock and useAiStatus, so the banner and the disabled buttons agree.
  const restriction = resolveAccountRestriction(billing, seen);

  if (!seesBilling) {
    // Read-only and suspended read the same here: neither is the client user's to fix.
    return restriction ? (
      <Banner tone="info" icon={CirclePause} title="Some changes are paused right now">
        You can still view everything. Ask the agency that manages this account if you need something changed.
      </Banner>
    ) : null;
  }
  if (restriction === "suspended") {
    return (
      <Banner
        tone="critical"
        icon={Ban}
        title="This account is suspended"
        // Straight to the new-ticket form: a suspended account can still open a ticket.
        action={<BannerAction to="/support?new=1" label="Contact support" variant="outline" />}
      >
        Contact support to restore access. Your data is kept.
      </Banner>
    );
  }
  if (restriction === "read_only") {
    return (
      <Banner
        tone="warning"
        icon={AlertTriangle}
        title="Your account is read-only"
        action={showBillingAction ? <BannerAction to="/settings/billing" label="Go to billing" /> : null}
      >
        {askOwner
          ? "You can still view everything, but refreshes, new locations and AI actions are paused. Ask the account owner to subscribe."
          : "You can still view everything, but refreshes, new locations and AI actions are paused until you subscribe."}
      </Banner>
    );
  }
  if (state === "past_due") {
    const graceEnds = billing?.grace_ends_at ? formatShortDate(billing.grace_ends_at) : null;
    return (
      <Banner
        tone="warning"
        icon={AlertTriangle}
        title="Your last payment failed"
        action={showBillingAction ? <BannerAction to="/settings/billing" label="Update payment" /> : null}
      >
        {askOwner
          ? graceEnds
            ? `Everything keeps working until ${graceEnds}. Ask the account owner to update the payment before then.`
            : "Ask the account owner to update the payment to keep full access."
          : graceEnds
            ? `Everything keeps working until ${graceEnds}. Update your payment before then.`
            : "Update your payment to keep full access."}
      </Banner>
    );
  }
  if (state === "trialing" && billing?.trial_ends_at) {
    return (
      <Banner
        tone="info"
        icon={Clock}
        title={`Free trial until ${formatShortDate(billing.trial_ends_at)}`}
        action={showBillingAction ? <BannerAction to="/settings/billing" label="Subscribe" variant="outline" /> : null}
      >
        {askOwner
          ? "After the trial the account becomes read-only. Ask the account owner to subscribe."
          : "After the trial the account becomes read-only until you subscribe."}
      </Banner>
    );
  }
  return null;
}

function BannerAction({ to, label, variant = "default" }: { to: string; label: string; variant?: "default" | "outline" }) {
  return (
    <Button asChild size="sm" variant={variant} className={cn("shrink-0", variant === "outline" && "bg-card")}>
      <Link to={to}>{label}</Link>
    </Button>
  );
}

type Tone = "critical" | "warning" | "info";

/** Light tinted surface, a tinted icon disc, a coloured title, ink body text and the action on the right. */
const TONE: Record<Tone, { surface: string; icon: string; title: string }> = {
  critical: { surface: "border-critical/30 bg-critical-surface", icon: "bg-critical/15 text-critical", title: "text-critical" },
  warning: { surface: "border-warning/45 bg-warning-surface", icon: "bg-warning/20 text-warning-foreground", title: "text-warning-foreground" },
  info: { surface: "border-info/25 bg-info-surface", icon: "bg-info/15 text-info", title: "text-info" },
};

function Banner({
  tone,
  icon: Icon,
  title,
  action,
  children,
}: {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const styles = TONE[tone];
  return (
    <section
      role="status"
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border px-4 py-3 shadow-card", styles.surface)}
    >
      <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full", styles.icon)}>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-[14rem] flex-1">
        <p className={cn("text-sm font-semibold", styles.title)}>{title}</p>
        <p className="text-sm text-foreground">{children}</p>
      </div>
      {action}
    </section>
  );
}
