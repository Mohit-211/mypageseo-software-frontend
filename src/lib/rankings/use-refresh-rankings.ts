/**
 * "Refresh rankings": a manual ranking run. It costs `tokens.cost.rankings`, is allowed once per
 * 24 h, and the automatic monthly run stays free. One hook for every place that offers it (the
 * ranking page headers, the Keywords page's "new keywords" prompt and the "keywords added" toast),
 * so the price, the waiting state and the error copy are the same everywhere.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorData, isApiError, refreshLocation } from "@/api";
import { useAccess } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { noteAccountError } from "@/lib/billing/account-restriction";
import { useWriteBlock } from "@/lib/billing/write-block";
import { formatRunDate } from "./format";
import { rankingsKey, useRefreshState } from "./use-rankings";

export type RefreshRankings = {
  /** The refresh state has loaded. */
  ready: boolean;
  /** A ranking run is queued or running. */
  active: boolean;
  /** Inside the 24 h window: when the next manual refresh is allowed. */
  waitingUntil: string | null;
  /** Tokens per manual refresh (undefined until loaded). */
  cost: number | undefined;
  balance: number | undefined;
  /** When the next automatic (free) run is due, if automatic runs are on. */
  nextAutomaticRun: string | null;
  /** A refresh can be started now. */
  canStart: boolean;
  /** Why a refresh can't start because of the account (read-only or suspended), for the disabled button's tooltip. */
  blockedReason: string | null;
  /** The request is on its way. */
  starting: boolean;
  start: () => Promise<void>;
};

export function useRefreshRankings(locationId: string): RefreshRankings {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const state = useRefreshState(locationId);
  const now = useNow();
  // A read-only or suspended account can't start one (the backend answers 402 / 403).
  const block = useWriteBlock();
  // Only the owner can subscribe; anyone else is told to ask the owner (as the shell's account banner does).
  const canPay = useAccess().can("billing.manage");
  const [starting, setStarting] = useState(false);
  const data = state.data;
  const active = Boolean(data?.rankings.active_run);
  const nextAllowed = data?.rankings.next_allowed_at ?? null;
  const waitingUntil = nextAllowed !== null && new Date(nextAllowed).getTime() > now ? nextAllowed : null;
  const cost = data?.tokens.cost.rankings;

  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const result = await refreshLocation(locationId, ["rankings"]);
      const rankings = result.rankings;
      if (rankings && "skipped" in rankings) {
        toast.info(`Rankings can be refreshed again ${formatRunDate(rankings.next_allowed_at, true)}.`);
      } else if (rankings?.existing) {
        toast.info("A ranking run is already in progress.", { description: "Its results show up here when it finishes." });
      } else {
        toast.success("Ranking run started", { description: "It takes a few minutes. This page updates when it's done." });
      }
    } catch (err) {
      // Not a useMutation, so tell the shell's account banner about a read-only or suspended refusal here.
      noteAccountError(err);
      if (isApiError(err) && err.reason === "insufficient_tokens") {
        const info = apiErrorData(err);
        const shortfall = `This refresh costs ${String(info.cost ?? cost ?? "?")} and your balance is ${String(info.balance ?? "?")}.`;
        // Only someone who can pay is offered "Buy tokens"; anyone else is told to ask the owner.
        toast.warning(
          "Not enough tokens",
          canPay
            ? { description: shortfall, action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } }
            : { description: `${shortfall} Ask the account owner to add tokens.` },
        );
      } else if (isApiError(err) && err.reason === "read_only") {
        toast.error("Your access is read-only, so you can't start a refresh.");
      } else if (isApiError(err) && err.reason === "organization_suspended") {
        toast.error("This account is suspended", { description: "Contact support to restore it." });
      } else if (isApiError(err) && err.reason === "subscription_required") {
        toast.warning(
          "Your account is read-only",
          canPay
            ? { description: "Refreshes are paused until you subscribe.", action: { label: "Go to billing", onClick: () => navigate("/settings/billing") } }
            : { description: "Refreshes are paused. Ask the account owner to subscribe." },
        );
      } else if (isApiError(err) && err.status === 429) {
        const info = apiErrorData(err);
        const next = (info.rankings as { next_allowed_at?: string } | undefined)?.next_allowed_at ?? info.next_allowed_at;
        toast.info(`Rankings were refreshed recently. Try again ${typeof next === "string" ? formatRunDate(next, true) : "in 24 hours"}.`);
      } else {
        toast.error("The refresh couldn't be started", { description: "Try again in a moment." });
      }
    } finally {
      setStarting(false);
      void queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    }
  };

  return {
    ready: Boolean(data),
    active,
    waitingUntil,
    cost,
    balance: data?.tokens.balance,
    nextAutomaticRun: data?.frequency === "manual_only" ? null : (data?.next_refresh_at ?? null),
    canStart: Boolean(data) && !active && !waitingUntil && !starting && !block.blocked,
    blockedReason: block.reason,
    starting,
    start,
  };
}

/** "Refresh rankings · 2 tokens", "Run in progress", or "Next refresh Nov 14, 9:00 AM". */
export function refreshLabel(refresh: Pick<RefreshRankings, "active" | "waitingUntil" | "cost">, base = "Refresh rankings"): string {
  if (refresh.active) return "Run in progress";
  if (refresh.waitingUntil) return `Next refresh ${formatRunDate(refresh.waitingUntil, true)}`;
  return refresh.cost != null ? `${base} · ${refresh.cost} token${refresh.cost === 1 ? "" : "s"}` : base;
}
