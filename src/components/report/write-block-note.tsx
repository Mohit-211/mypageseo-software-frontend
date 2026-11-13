import { Lock } from "lucide-react";
import type { WriteBlock } from "@/lib/white-label/write-block";

/**
 * Why create buttons are off (read-only or suspended account), next to them instead of only in a
 * tooltip. `what` names the paused things, e.g. "New reports and emails".
 */
export function WriteBlockNote({ block, what }: { block: WriteBlock; what: string }) {
  if (!block.blocked) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Lock aria-hidden className="size-3.5 shrink-0" />
      {block.state === "suspended" ? `${what} are paused while the account is suspended.` : `${what} are paused until the account has an active subscription.`}
    </p>
  );
}
