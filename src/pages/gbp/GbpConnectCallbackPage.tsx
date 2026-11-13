import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Link2Off, ShieldX } from "lucide-react";
import { z } from "zod";
import { AuthLayout, AuthStatePanel } from "@/components/auth/auth";
import { ConnectGbpButton } from "@/components/gbp-audit/connect-gbp-button";
import { Button } from "@/components/ui/button";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { invalidateGbpQueries } from "@/lib/gbp/use-gbp-connect";

/**
 * Result page for the Google Business Profile connection (`/gbp/connect/callback`).
 *
 * Landing page of the redirect fallback (the app itself uses the popup modal).
 * Google redirects to the backend's `gbp/connect/callback`, which saves the
 * connection and then redirects here with `status` (`success` / `denied` /
 * `error`) and an optional `message`. Either way the app returns to the
 * locations page, where the connected account's locations are picked.
 */
const searchSchema = z.object({
  status: z.string().optional(),
  message: z.string().optional(),
});

type CallbackState = "connected" | "denied" | "failed" | "invalid";

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

  // Refresh the connected accounts so the rest of the app sees the new one.
  useEffect(() => {
    if (state === "connected") void invalidateGbpQueries(queryClient);
  }, [state, queryClient]);

  const finish = useCallback(() => {
    navigate("/locations", { replace: true });
  }, [navigate]);

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
      {`Taking you back to Locations in ${secondsLeft}s…`}
    </span>
  );

  const backLink = (
    <Button variant="outline" className="w-full" onClick={finish}>
      Back to Locations
    </Button>
  );

  const retry = (label: string) => <ConnectGbpButton label={label} size="default" fullWidth />;

  // The sign-in layout (logo, brand panel, card): this page opens in the browser on its own,
  // outside the app frame, after Google sends the user back.
  return (
    <AuthLayout
      footer={
        <p className="mx-auto max-w-md text-xs text-muted-foreground">
          MyPageSEO only asks for access to manage your Business Profiles. You can disconnect at any time from{" "}
          <Link to="/settings/integrations" className="font-medium text-primary underline-offset-4 hover:underline">
            Settings › Integrations
          </Link>
          .
        </p>
      }
    >
      {state === "connected" ? (
        <AuthStatePanel
          tone="success"
          icon={<CheckCircle2 className="size-5" />}
          title="Google Business Profile connected"
          description={
            <>
              {serverMessage ??
                "MyPageSEO can now read your profile details, reviews and posts."}
              <span className="mt-2 block text-xs">Taking you to Locations to choose which profiles to add…</span>
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
              MyPageSEO didn't receive a result for this connection. Start the connection again from
              MyPageSEO.
              {countdown}
            </>
          }
        >
          {retry("Connect Google")}
          {backLink}
        </AuthStatePanel>
      )}
    </AuthLayout>
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
