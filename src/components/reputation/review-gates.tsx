import { Check, MessageSquareText } from "lucide-react";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import type { ReviewsGate } from "@/lib/reviews/review-metrics";

const BENEFITS = [
  "See every Google review in one place, newest first",
  "Answer reviews here, or let AI draft the replies",
  "Spot the reviews that need attention",
];

/**
 * The body of a reviews page when reviews can't be shown yet (see `reviewsGate`): connect Google
 * (with the connect button for people who can), or wait for Google's approval.
 */
export function ReviewsGateState({ gate }: { gate: ReviewsGate }) {
  const canEdit = useCanEdit();
  const { connect } = useGbpConnect();
  if (gate === "not_connected") {
    return (
      <EmptyState
        variant="not-connected"
        tone="reputation"
        icon={MessageSquareText}
        title="Connect your Google Business Profile"
        description={
          <>
            <p>Reviews come from the location's Google Business Profile. Once it's connected, you can:</p>
            <ul className="mx-auto mt-3 w-fit space-y-1.5 text-left">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-foreground">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  {benefit}
                </li>
              ))}
            </ul>
          </>
        }
        action={
          canEdit ? (
            <Button size="sm" onClick={() => connect()}>
              Connect Google
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <EmptyState
      variant="unavailable"
      tone="reputation"
      title="Waiting for Google access"
      description="Google is still approving access to this profile's reviews. They appear here as soon as it's granted; there's nothing you need to do."
    />
  );
}
