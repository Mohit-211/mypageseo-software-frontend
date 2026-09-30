import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Link2Off, ShieldX } from "lucide-react";
import { z } from "zod";
import { AuthStatePanel, AuthWordmark } from "@/components/auth/auth";
import { ConnectGbpButton } from "@/components/gbp-audit/connect-gbp-button";
import { Button } from "@/components/ui/button";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { GBP_QUERY_KEY } from "@/lib/gbp/use-gbp";
import {
  GBP_CONNECT_FAILURE_PATH,
  GBP_CONNECT_SUCCESS_PATH,
  isGbpConnectPopup,
  postGbpConnectMessage,
  type GbpConnectStatus,
} from "@/lib/gbp/use-gbp-connect";

/**
 * Result page for the Google Business Profile connection (`/gbp/connect/callback`).
 *
 * Google redirects to the backend's `gbp/connect/callback`, which saves the
 * connection and then redirects here with `status` (`success` / `denied` /
 * `error`) and an optional `message`. On success the popup closes right away
 * and the app opens the GBP page; on failure the message is shown for a few
 * seconds before returning to the locations page.
 */
const searchSchema = z.object({
  status: z.string().optional(),
  message: z.string().optional(),
});

type CallbackState = GbpConnectStatus;

const REDIRECT_SECONDS = 5;
/** `message` comes from the URL, so keep it to a sensible length. */
const MAX_MESSAGE_LENGTH = 300;

function GbpConnectCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search] = useTypedSearch(searchSchema);

  // Read once: the outcome is fixed by the backend's redirect.
  const [state] = useState<CallbackState>(() => stateFromStatus(search.status));
  const [serverMessage] = useState(() => search.message?.trim().slice(0, MAX_MESSAGE_LENGTH) || null);
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  // Refresh `GET gbp` so the rest of the app sees the new connection.
  useEffect(() => {
    if (state === "connected") void queryClient.invalidateQueries({ queryKey: GBP_QUERY_KEY });
  }, [state, queryClient]);

  // Opened as a popup by `useGbpConnect`: report to the opener and close instead of navigating.
  const [inPopup] = useState(isGbpConnectPopup);

  useEffect(() => {
    if (inPopup) postGbpConnectMessage({ type: "result", status: state });
  }, [inPopup, state]);

  const finish = useCallback(() => {
    if (inPopup) {
      postGbpConnectMessage({ type: "done" });
      window.close();
      return;
    }
    navigate(state === "connected" ? GBP_CONNECT_SUCCESS_PATH : GBP_CONNECT_FAILURE_PATH, { replace: true });
  }, [inPopup, state, navigate]);

  // Success finishes immediately; a failure stays on screen for a countdown first.
  useEffect(() => {
    if (state === "connected" || secondsLeft <= 0) {
      finish();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [state, secondsLeft, finish]);

  const countdown = (
    <span className="mt-2 block text-xs">
      {inPopup
        ? `This window will close in ${secondsLeft}s…`
        : `Taking you back to Locations in ${secondsLeft}s…`}
    </span>
  );

  const backLink = (
    <Button variant="outline" className="w-full" onClick={finish}>
      {inPopup ? "Close" : "Back to Locations"}
    </Button>
  );

  // Retrying from inside the popup would open a second popup; retry from the main window instead.
  const retry = (label: string) =>
    inPopup ? null : <ConnectGbpButton label={label} size="default" fullWidth />;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-10">
      <AuthWordmark className="mb-6" />
      <main className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-card sm:p-7">
        {state === "connected" ? (
          <AuthStatePanel
            tone="success"
            icon={<CheckCircle2 className="size-5" />}
            title="Google Business Profile connected"
            description={
              <>
                {serverMessage ??
                  "Mypageseo can now read your profile details, reviews and posts."}
                <span className="mt-2 block text-xs">Taking you to your Google Business Profile…</span>
              </>
            }
          >
            <Button className="w-full" onClick={finish}>
              Continue now
            </Button>
          </AuthStatePanel>
        ) : state === "denied" ? (
          <AuthStatePanel
            tone="critical"
            icon={<ShieldX className="size-5" />}
            title="Google access wasn't granted"
            description={
              <>
                {serverMessage ??
                  "The Google sign-in was cancelled, so nothing was connected. You can try again whenever you're ready."}
                {countdown}
              </>
            }
          >
            {retry("Try again")}
            {backLink}
          </AuthStatePanel>
        ) : state === "failed" ? (
          <AuthStatePanel
            tone="critical"
            icon={<AlertTriangle className="size-5" />}
            title="We couldn't connect Google Business Profile"
            description={
              <>
                {serverMessage ??
                  "Something went wrong while saving the connection. Please start the connection again."}
                {countdown}
              </>
            }
          >
            {retry("Connect again")}
            {backLink}
          </AuthStatePanel>
        ) : (
          <AuthStatePanel
            tone="critical"
            icon={<Link2Off className="size-5" />}
            title="This connection link isn't valid"
            description={
              <>
                Mypageseo didn't receive a result for this connection. Start the connection again from
                Mypageseo.
                {countdown}
              </>
            }
          >
            {retry("Connect Google")}
            {backLink}
          </AuthStatePanel>
        )}
      </main>
      <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
        Mypageseo only requests access to manage your Business Profile. You can disconnect at any time
        from{" "}
        {inPopup ? (
          <span className="font-medium text-foreground">Settings → Integrations</span>
        ) : (
          <Link to="/settings/integrations" className="font-medium text-primary underline-offset-4 hover:underline">
            Settings → Integrations
          </Link>
        )}
        .
      </p>
    </div>
  );
}

/** Maps the backend's `status` (`success` | `denied` | `error`) to the page state. */
function stateFromStatus(status: string | undefined): CallbackState {
  switch (status?.trim().toLowerCase()) {
    case "success":
      return "connected";
    case "denied":
      return "denied";
    case undefined:
    case "":
      return "invalid";
    default:
      return "failed";
  }
}

export default GbpConnectCallbackPage;
