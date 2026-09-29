import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { PartialDataNotice, SectionSkeleton, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { reviewActions, rulePublishesAutomatically, useReviewManagement, type ReviewAutomation } from "@/lib/reviews/review-management";
import { REVIEW_MANAGEMENT_PATH } from "../paths";
import { ProfileSelect } from "../review-header";
import { useReviewProfiles } from "../use-review-profiles";
import { AutomationRules } from "./automation-rules";
import { ReplySettings } from "./reply-settings";

function AutomationToggle({ locationId, automation }: { locationId: string; automation: ReviewAutomation }) {
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const active = automation.rules.filter((r) => r.enabled);
  const autoPublishing = active.filter((r) => rulePublishesAutomatically(r, automation.settings));

  const apply = (enabled: boolean) => {
    reviewActions.setAutomationEnabled(locationId, enabled);
    toast.success(enabled ? "Automatic replies turned on" : "Automatic replies turned off", {
      description: enabled ? "Active rules will handle new reviews from the next sync." : "New reviews will wait for a manual reply.",
    });
    setConfirming(null);
  };

  return (
    <section aria-labelledby="auto-reply-heading" className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-primary">
            <Bot className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="auto-reply-heading" className="text-sm font-semibold text-foreground">
                <label htmlFor="auto-reply-enabled" className="cursor-pointer">
                  Enable automatic replies
                </label>
              </h2>
              <StatusBadge tone={automation.enabled ? "success" : "neutral"}>{automation.enabled ? "On" : "Off"}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {automation.enabled
                ? `${active.length} active rule${active.length === 1 ? "" : "s"} · ${autoPublishing.length} publish${autoPublishing.length === 1 ? "es" : ""} automatically, the rest wait for approval.`
                : "When on, AI drafts or publishes replies to new reviews based on your rules."}
            </p>
            <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" aria-hidden />
              Replies to negative reviews are never published without approval.
            </p>
          </div>
        </div>
        <Switch id="auto-reply-enabled" checked={automation.enabled} onCheckedChange={(v) => setConfirming(v)} className="mt-1" />
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? "Turn on automatic replies?" : "Turn off automatic replies?"}
        description={
          confirming
            ? autoPublishing.length
              ? `${autoPublishing.length} rule${autoPublishing.length === 1 ? "" : "s"} will post AI replies to Google without review. Other matching reviews get a draft that waits for approval.`
              : "Matching reviews get an AI draft that waits for approval. No reply is published without review."
            : "New reviews won't get automatic drafts or replies. Existing drafts and published replies stay as they are."
        }
        confirmLabel={confirming ? "Turn On" : "Turn Off"}
        destructive={false}
        onConfirm={() => confirming !== null && apply(confirming)}
      />
    </section>
  );
}

function AutomationSkeleton() {
  return (
    <div role="status" aria-label="Loading automation settings" className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-3 h-3 w-80 max-w-full" />
      </div>
      <TableSkeleton rows={3} columns={5} />
      <SectionSkeleton lines={5} />
    </div>
  );
}

/** Review Reply Automation settings page. */
export function AutomationSettings() {
  const { locations, locationId, setLocationId } = useReviewProfiles();
  const { dataset } = useReviewManagement(locationId);

  return (
    <div className="space-y-6">
      <Link to={REVIEW_MANAGEMENT_PATH} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to Review Management
      </Link>
      <PageHeader
        title="Review Reply Automation"
        description="Reply to new reviews automatically with rules, tone and approval requirements."
        actions={locationId ? <ProfileSelect locations={locations} locationId={locationId} onChange={setLocationId} /> : null}
      />

      {!dataset || !locationId ? (
        <AutomationSkeleton />
      ) : (
        <>
          <PartialDataNotice description="Google Business Profile isn't connected yet. Rules and settings are saved for this session only and no replies are posted." />
          <AutomationToggle locationId={locationId} automation={dataset.automation} />
          <AutomationRules locationId={locationId} rules={dataset.automation.rules} settings={dataset.automation.settings} automationEnabled={dataset.automation.enabled} />
          <ReplySettings key={locationId} locationId={locationId} settings={dataset.automation.settings} />
        </>
      )}
    </div>
  );
}
