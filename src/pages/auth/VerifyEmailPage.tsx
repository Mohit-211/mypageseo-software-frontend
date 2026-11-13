import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, BadgeCheck, LinkIcon, Loader2, TimerOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthFooterNote, AuthLayout, AuthLink, AuthStatePanel } from "@/components/auth/auth";
import { ResendVerification } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { getSessionSubject, isApiError, verifyEmail } from "@/api";
import { rateLimitMessage } from "@/lib/auth/auth-recovery";
import { useTypedSearch } from "@/hooks/use-typed-search";

const searchSchema = z.object({
  token: z.string().optional(),
});

type VerifyState =
  | { kind: "verifying" }
  | { kind: "already_verified" }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "rate_limited"; message: string }
  | { kind: "failed" };

/** Maps a failed `POST auth/verify-email` to a page state by `data.reason`. */
function stateForError(error: unknown): VerifyState {
  const limited = rateLimitMessage(error);
  if (limited) return { kind: "rate_limited", message: limited };
  if (!isApiError(error) || error.status === 0 || error.status >= 500) return { kind: "failed" };
  if (error.reason === "link_expired") return { kind: "expired" };
  // `link_invalid`, or a 400 without a reason (missing or malformed token).
  return { kind: "invalid" };
}

/**
 * `/verify-email?token=…`, opened from the signup email. Verifies once on load:
 * the first time it signs the user in (kept signed in) and continues to setup.
 */
function VerifyEmailPage() {
  const navigate = useNavigate();
  const [{ token }] = useTypedSearch(searchSchema);
  const [state, setState] = useState<VerifyState>(token ? { kind: "verifying" } : { kind: "invalid" });
  const [attempt, setAttempt] = useState(0);

  // The token works once and StrictMode runs effects twice in development,
  // so remember which token/attempt was already sent.
  const submitted = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const key = `${token}:${attempt}`;
    if (submitted.current === key) return;
    submitted.current = key;

    // Verifying signs the new account in, replacing any session already open in this browser.
    const signedInBefore = getSessionSubject();
    verifyEmail(token)
      .then((result) => {
        if (result.already_verified) {
          setState({ kind: "already_verified" });
          return;
        }
        if (signedInBefore && signedInBefore !== getSessionSubject()) {
          toast.info(result.user?.email ? `You're now signed in as ${result.user.email}` : "You're now signed in with your new account", {
            description: "The account that was signed in before is signed out in this browser.",
          });
        }
        // Signed in now (kept signed in): continue to setup.
        void navigate("/onboarding", { replace: true });
      })
      .catch((error: unknown) => setState(stateForError(error)));
  }, [token, attempt, navigate]);

  const retry = () => {
    setState({ kind: "verifying" });
    setAttempt((n) => n + 1);
  };

  const signIn = (
    <Button asChild size="lg" className="w-full">
      <Link to="/login">Sign in</Link>
    </Button>
  );

  // A way out for people whose link was already used, on the screens that ask for an email.
  const needsResend = state.kind === "expired" || state.kind === "invalid";

  return (
    <AuthLayout>
      {state.kind === "verifying" ? (
        <AuthStatePanel
          icon={<Loader2 className="animate-spin" />}
          title="Verifying your email"
          description="Hold on a moment while we confirm this link."
        />
      ) : state.kind === "already_verified" ? (
        <AuthStatePanel
          tone="success"
          icon={<BadgeCheck />}
          title="Your email is already verified"
          description="This link was used before. Sign in to continue."
        >
          {signIn}
        </AuthStatePanel>
      ) : state.kind === "expired" ? (
        <AuthStatePanel
          tone="critical"
          icon={<TimerOff />}
          title="This link has expired"
          description="Verification links last 24 hours. Enter your email and we'll send a new one."
        >
          <ResendVerification />
        </AuthStatePanel>
      ) : state.kind === "invalid" ? (
        <AuthStatePanel
          tone="critical"
          icon={<LinkIcon />}
          title="This link isn't valid"
          description="It may be incomplete, or a newer link was sent (only the newest one works). Enter your email to get a new link."
        >
          <ResendVerification />
        </AuthStatePanel>
      ) : state.kind === "rate_limited" ? (
        <AuthStatePanel tone="critical" icon={<AlertTriangle />} title="Too many attempts" description={state.message}>
          <Button type="button" variant="outline" className="h-10 w-full" onClick={retry}>
            Try again
          </Button>
        </AuthStatePanel>
      ) : (
        <AuthStatePanel
          tone="critical"
          icon={<AlertTriangle />}
          title="We couldn't verify your email"
          description="Something went wrong on our side. Please try again in a moment."
        >
          <Button type="button" size="lg" className="w-full" onClick={retry}>
            Try again
          </Button>
        </AuthStatePanel>
      )}

      {needsResend ? (
        <AuthFooterNote>
          Already verified? <AuthLink to="/login">Sign in</AuthLink>
        </AuthFooterNote>
      ) : null}
    </AuthLayout>
  );
}

export default VerifyEmailPage;
