import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Info, LoaderCircle } from "lucide-react";
import { captureBillingOrder, isApiError, syncBilling } from "@/api";
import { addOrBindLocation, bindSyncText } from "@/components/gbp-connect/bind-result";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { takePendingLocationAction } from "@/lib/billing/pending-location-payment";
import { invalidateGbpQueries } from "@/lib/gbp/use-gbp-connect";
import { useSearchUpdater } from "@/lib/url-state";

type ReturnKind = "order" | "checkout" | "cancelled" | null;

type Notice =
  | { tone: "working"; title: string }
  | { tone: "success" | "info" | "error"; title: string; body?: string; locationsLink?: boolean };

const CAPTURE_ERRORS: Record<string, string> = {
  order_not_approved: "The payment wasn't approved in PayPal, so nothing was charged.",
  order_closed: "This PayPal order is closed. Start the payment again.",
  payment_declined: "PayPal declined the payment. Try another payment method.",
  order_not_found: "This PayPal order wasn't found. Start the payment again.",
};

function readReturn(params: URLSearchParams): { kind: ReturnKind; token: string | null } {
  if (params.get("checkout") === "cancelled" || params.get("order") === "cancelled") return { kind: "cancelled", token: null };
  if (params.get("order") === "return" && params.get("token")) return { kind: "order", token: params.get("token") };
  if (params.get("checkout") === "success") return { kind: "checkout", token: null };
  return { kind: null, token: null };
}

/**
 * Handles PayPal's return to `/settings/billing`: captures a one-time order (then
 * retries the location add that needed the slot), syncs a new subscription, or
 * reports a cancelled payment. The query parameters are removed once read.
 */
export function PaypalReturnNotice() {
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [initial] = useState(() => readReturn(params));
  const [notice, setNotice] = useState<Notice | null>(() =>
    initial.kind === "cancelled"
      ? { tone: "info", title: "Payment cancelled", body: "Nothing was charged." }
      : initial.kind
        ? { tone: "working", title: initial.kind === "order" ? "Confirming your payment…" : "Updating your subscription…" }
        : null,
  );
  const started = useRef(false);

  useEffect(() => {
    if (!initial.kind || started.current) return;
    started.current = true;
    // Read once: clear them from the address (replacing the entry, without moving the page).
    updateSearch(() => new URLSearchParams());
    if (initial.kind === "cancelled") return;

    if (initial.kind === "checkout") {
      syncBilling()
        .then(() => setNotice({ tone: "success", title: "Subscription updated" }))
        .catch(() =>
          setNotice({ tone: "info", title: "Your subscription is being confirmed", body: "PayPal confirms it shortly; refresh this page in a minute." }),
        );
      return;
    }

    void (async () => {
      try {
        const capture = await captureBillingOrder(initial.token!);
        if (capture.status === "pending") {
          setNotice({ tone: "info", title: "Payment is processing", body: "PayPal hasn't confirmed it yet. It completes on its own; check back shortly." });
          return;
        }
      } catch (err) {
        const reason = isApiError(err) ? err.reason : undefined;
        setNotice({ tone: "error", title: "Payment not completed", body: (reason && CAPTURE_ERRORS[reason]) ?? "The payment couldn't be confirmed. Try again." });
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      void queryClient.invalidateQueries({ queryKey: ["organization", "usage"] });
      const action = takePendingLocationAction();
      if (!action) {
        setNotice({ tone: "success", title: "Payment received" });
        return;
      }
      setNotice({ tone: "working", title: `Payment received. Adding ${action.title}…` });
      try {
        const { locationId, gbpSync } = await addOrBindLocation(action);
        await invalidateGbpQueries(queryClient);
        // A location that was already set up: its first Google sync runs in the background (2026-11-17).
        const synced = bindSyncText(action.title, gbpSync);
        if (synced) toast.success(synced.title, { description: synced.description });
        navigate(locationSetupPath(locationId));
      } catch (err) {
        setNotice({
          tone: "error",
          title: `Payment received, but ${action.title} wasn't added`,
          body: isApiError(err) && err.message ? err.message : "Open Locations and try again; the paid slot is kept.",
          locationsLink: true,
        });
      }
    })();
  }, [initial, navigate, queryClient, updateSearch]);

  if (!notice) return null;

  const Icon = notice.tone === "working" ? LoaderCircle : notice.tone === "success" ? CheckCircle2 : notice.tone === "error" ? AlertCircle : Info;
  const variant = notice.tone === "error" ? "critical" : notice.tone === "success" ? "success" : "info";
  return (
    <Alert role="status" variant={variant}>
      <Icon aria-hidden className={notice.tone === "working" ? "animate-spin motion-reduce:animate-none" : undefined} />
      <AlertTitle>{notice.title}</AlertTitle>
      {notice.tone !== "working" && (notice.body || notice.locationsLink) ? (
        <AlertDescription>
          {notice.body ? <p>{notice.body}</p> : null}
          {notice.locationsLink ? (
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/locations">Go to Locations</Link>
            </Button>
          ) : null}
        </AlertDescription>
      ) : null}
    </Alert>
  );
}
