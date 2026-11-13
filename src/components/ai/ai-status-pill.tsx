/**
 * `AiStatusPill`: AI's state in one small pill, for page headers and cards (pass `useAiStatus()`).
 * The account comes first: "AI paused · subscription needed" (amber) for a read-only account and
 * "AI unavailable" (grey) for a suspended one, whatever AI itself is doing, since nothing AI can run
 * there. Otherwise AI's own state: "AI is on" (green), "Paused today · back at 7:00 PM" (amber),
 * "Almost ready" (violet), "Checking AI…" (grey). Nothing when the state is unknown: the next click
 * decides. A client user keeps the state labels: AI is on, and the banner says their agency runs it.
 */
import { Hourglass, LoaderCircle, Lock, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import type { AiStatus } from "@/lib/ai/ai-status";

export function AiStatusPill({ status, className }: { status: Pick<AiStatus, "state" | "blockedBy" | "resumesAt">; className?: string }) {
  if (status.blockedBy === "subscription") {
    return (
      <StatusBadge tone="warning" icon={Lock} className={className}>
        AI paused · subscription needed
      </StatusBadge>
    );
  }
  if (status.blockedBy === "suspended") {
    return (
      <StatusBadge tone="neutral" className={className}>
        AI unavailable
      </StatusBadge>
    );
  }
  switch (status.state) {
    case "ready":
      return (
        <StatusBadge tone="success" dot className={className}>
          AI is on
        </StatusBadge>
      );
    case "paused":
      return (
        <StatusBadge tone="warning" icon={Hourglass} className={className}>
          Paused today{status.resumesAt ? ` · back at ${status.resumesAt}` : ""}
        </StatusBadge>
      );
    case "off":
      return (
        <StatusBadge tone="ai" icon={Sparkles} className={className}>
          Almost ready
        </StatusBadge>
      );
    case "checking":
      return (
        <StatusBadge tone="neutral" className={className}>
          <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
          Checking AI…
        </StatusBadge>
      );
    default:
      return null;
  }
}
