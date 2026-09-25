import { useState } from "react";
import { RequireAccess } from "@/components/mypageseo/access";
import { AlertTriangle, CreditCard, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import {
  MetricCard,
  PageHeader,
  Panel,
  SectionHeader,
  StatusBadge,
} from "@/components/layout/shared/data-display";
import { SettingsNav } from "@/components/mypageseo/settings-nav";
import { EmptyState, ErrorState, MetricSkeletonGrid } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BILLING_INTERVAL_LABEL,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  formatBillingDate,
  getBilling,
  usagePercent,
  type BillingCapabilities,
  type Invoice,
  type PaymentMethod,
  type Subscription,
  type UsageMetric,
} from "@/lib/mypageseo/billing";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const SettingsBillingPage = () => (
    <RequireAccess permission="billing.view">
      <BillingSettingsPage />
    </RequireAccess>
  );

function BillingSettingsPage() {
  const workspace = useWorkspace();
  const accountType = workspace.organization?.accountType ?? "business";
  const result = getBilling(accountType);

  return (
    <AppShell>
      <PageHeader
        title="Billing"
        description="Manage the Mypageseo subscription and view billing information for this organization."
      />
      <SettingsNav active="billing" isAgency={accountType === "agency"} />

      {result.status === "loading" ? (
        <MetricSkeletonGrid count={4} />
      ) : result.status === "error" ? (
        <ErrorState description={result.message} onRetry={() => window.location.reload()} />
      ) : result.status === "no_subscription" ? (
        <EmptyState title="No active subscription" description={result.reason} />
      ) : (
        <div className="space-y-6">
          <SubscriptionSummary
            subscription={result.subscription}
            capabilities={result.capabilities}
          />
          <UsageSection usage={result.usage} />
          <PaymentSection
            paymentMethod={result.paymentMethod}
            capabilities={result.capabilities}
          />
          <InvoiceSection invoices={result.invoices} />
          {result.capabilities.canCancel ? (
            <CancellationSection capabilities={result.capabilities} />
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function PortalNote() {
  return (
    <p className="text-xs text-muted-foreground">
      Plan changes, payment updates and cancellation are handled in the billing portal, which
      isn&apos;t connected to this workspace yet.
    </p>
  );
}

function SubscriptionSummary({
  subscription,
  capabilities,
}: {
  subscription: Subscription;
  capabilities: BillingCapabilities;
}) {
  const managed = capabilities.canManage && capabilities.portalUrl;
  return (
    <section aria-labelledby="subscription">
      <SectionHeader title="Subscription" description="Your current Mypageseo plan" />
      {subscription.attention ? (
        <Panel className="mb-3 border-l-4 border-l-critical">
          <div className="flex items-start gap-2">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 text-critical" />
            <p className="text-sm text-foreground">{subscription.attention}</p>
          </div>
        </Panel>
      ) : null}

      <Panel className="p-0">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="subscription" className="text-lg font-semibold text-foreground">
                {subscription.planName} plan
              </h3>
              <StatusBadge tone={SUBSCRIPTION_STATUS_TONE[subscription.status]}>
                {SUBSCRIPTION_STATUS_LABEL[subscription.status]}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {subscription.price} · {BILLING_INTERVAL_LABEL[subscription.interval]}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            {managed ? (
              <Button asChild variant="outline">
                <a href={capabilities.portalUrl ?? "#"} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden />
                  Manage in billing portal
                </a>
              </Button>
            ) : (
              <>
                <Button variant="outline" disabled>
                  <ExternalLink aria-hidden />
                  Change plan
                </Button>
                <PortalNote />
              </>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Detail label="Started" value={formatBillingDate(subscription.startedAt)} />
          <Detail
            label={subscription.cancelAtPeriodEnd ? "Access ends" : "Renews"}
            value={formatBillingDate(subscription.currentPeriodEnd)}
          />
          <Detail
            label="Trial"
            value={
              subscription.trialEndsAt
                ? `Ends ${formatBillingDate(subscription.trialEndsAt)}`
                : "Not on trial"
            }
          />
        </dl>
      </Panel>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function UsageSection({ usage }: { usage: UsageMetric[] }) {
  if (usage.length === 0) return null;
  return (
    <section aria-labelledby="usage">
      <SectionHeader
        title="Plan usage"
        description="What this organization is using against its plan limits"
      />
      <div
        className={cn(
          "grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2",
          usage.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3",
        )}
      >
        {usage.map((metric) => {
          const percent = usagePercent(metric);
          return (
            <MetricCard
              key={metric.id}
              label={metric.label}
              value={metric.limit === null ? metric.used : `${metric.used} / ${metric.limit}`}
              caption={
                percent === null
                  ? "No plan limit"
                  : `${percent}% of plan limit used`
              }
              accent={percent !== null && percent >= 90 ? "amber" : "brand"}
            />
          );
        })}
      </div>
    </section>
  );
}

function PaymentSection({
  paymentMethod,
  capabilities,
}: {
  paymentMethod: PaymentMethod | null;
  capabilities: BillingCapabilities;
}) {
  return (
    <section aria-labelledby="payment">
      <SectionHeader title="Payment method" description="Used for subscription charges" />
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {paymentMethod ? (
            <div className="flex items-center gap-3">
              <CreditCard aria-hidden className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {paymentMethod.brand} ending in {paymentMethod.last4}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expires {String(paymentMethod.expiryMonth).padStart(2, "0")}/
                  {paymentMethod.expiryYear}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No payment method is on file for this organization.
            </p>
          )}
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            {capabilities.portalUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={capabilities.portalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden />
                  Update payment method
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Update payment method
              </Button>
            )}
          </div>
        </div>
      </Panel>
    </section>
  );
}

function InvoiceSection({ invoices }: { invoices: Invoice[] }) {
  return (
    <section aria-labelledby="invoices">
      <SectionHeader title="Billing history" description="Invoices issued for this organization" />
      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices appear here after the first billing period closes."
        />
      ) : (
        <Panel className="p-0">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-medium">Invoice</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{invoice.number}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatBillingDate(invoice.issuedAt)}
                    </td>
                    <td className="px-4 py-3 tabular text-foreground">{invoice.amount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={INVOICE_STATUS_TONE[invoice.status]}>
                        {INVOICE_STATUS_LABEL[invoice.status]}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InvoiceAction invoice={invoice} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-border md:hidden">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{invoice.number}</span>
                  <StatusBadge tone={INVOICE_STATUS_TONE[invoice.status]}>
                    {INVOICE_STATUS_LABEL[invoice.status]}
                  </StatusBadge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{formatBillingDate(invoice.issuedAt)}</span>
                  <span className="tabular text-foreground">{invoice.amount}</span>
                </div>
                <InvoiceAction invoice={invoice} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </section>
  );
}

function InvoiceAction({ invoice }: { invoice: Invoice }) {
  if (!invoice.url) {
    return (
      <span className="text-xs text-muted-foreground" title="Invoice documents come from the billing portal, which isn't connected yet.">
        Not available
      </span>
    );
  }
  return (
    <Button asChild variant="ghost" size="sm">
      <a href={invoice.url} target="_blank" rel="noreferrer">
        <ExternalLink aria-hidden />
        View
      </a>
    </Button>
  );
}

function CancellationSection({ capabilities }: { capabilities: BillingCapabilities }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="cancel">
      <SectionHeader title="Cancel subscription" description="Ends billing at the end of the current period" />
      <Panel className="border-l-4 border-l-critical">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Canceling keeps access until the end of the current billing period. Tracking, reports
            and automations stop once the period ends.
          </p>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Cancel subscription
          </Button>
        </div>
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this subscription?</DialogTitle>
            <DialogDescription>
              Access continues until the end of the current billing period. After that, tracking,
              reports and automations stop for every location in this organization.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep subscription
            </Button>
            {capabilities.portalUrl ? (
              <Button asChild variant="destructive">
                <a href={capabilities.portalUrl} target="_blank" rel="noreferrer">
                  Continue in billing portal
                </a>
              </Button>
            ) : (
              <Button variant="destructive" disabled>
                Continue in billing portal
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default SettingsBillingPage;
