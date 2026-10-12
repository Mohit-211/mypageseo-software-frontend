import { Link } from "react-router-dom";
import { AlertTriangle, Ban, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/datetime";
import { useAccountRestriction, useOrganizationUsage } from "@/lib/billing/use-billing";
import { useAccess } from "@/hooks/use-access";

/**
 * Trial, grace and read-only banner across the app (FRONTEND_REVIEW_CLAUDE_NOTE §0, §12).
 * Read-only keeps every read working; only money-costing actions answer 402.
 * Suspended has no billing call to action.
 */
export function AccountStateBanner() {
  const usage = useOrganizationUsage();
  const canSeeBilling = useAccess().can("billing.view");
  const seen = useAccountRestriction();
  const billing = usage.data?.billing;
  const state = billing?.state;

  if (state === "suspended_by_admin" || seen === "suspended") {
    return (
      <Banner tone="critical" icon={Ban} title="This account is suspended">
        Contact support to restore access. Your data is kept.
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <Link to="/help">Contact support</Link>
        </Button>
      </Banner>
    );
  }
  if (state === "inactive" || (billing?.read_only ?? seen === "read_only")) {
    return (
      <Banner tone="warning" icon={AlertTriangle} title="Your account is read-only">
        You can still view everything, but refreshes, new locations and AI actions are paused until you subscribe.
        {canSeeBilling ? <BillingLink label="Go to billing" /> : null}
      </Banner>
    );
  }
  if (state === "past_due") {
    return (
      <Banner tone="warning" icon={AlertTriangle} title="Your last payment failed">
        {billing?.grace_ends_at
          ? `Everything keeps working until ${formatShortDate(billing.grace_ends_at)}. Update your payment before then.`
          : "Update your payment to keep full access."}
        {canSeeBilling ? <BillingLink label="Update payment" /> : null}
      </Banner>
    );
  }
  if (state === "trialing" && billing?.trial_ends_at) {
    return (
      <Banner tone="info" icon={Clock} title={`Free trial until ${formatShortDate(billing.trial_ends_at)}`}>
        After the trial the account becomes read-only until you subscribe.
        {canSeeBilling ? <BillingLink label="Subscribe" /> : null}
      </Banner>
    );
  }
  return null;
}

function BillingLink({ label }: { label: string }) {
  return (
    <Button asChild size="sm" variant="outline" className="ml-auto">
      <Link to="/settings/billing">{label}</Link>
    </Button>
  );
}

function Banner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "critical" | "warning" | "info";
  icon: typeof Clock;
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "critical" ? "border-critical/25 bg-critical-surface/40" : tone === "warning" ? "border-warning/40 bg-warning-surface/40" : "";
  return (
    <Alert role="status" className={toneClass}>
      <Icon aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">{children}</AlertDescription>
    </Alert>
  );
}
