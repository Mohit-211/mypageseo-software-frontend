import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  LinkIcon,
  Loader2,
  TimerOff,
} from "lucide-react";
import { z } from "zod";
import { AuthFooterNote, AuthLayout, AuthStatePanel } from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/api";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { verifyEmail } from "@/api/auth/verify-email";

const searchSchema = z.object({
  token: z.string().optional(),
});

type VerifyState =
  | "verifying"
  | "verified"
  | "already_verified"
  | "expired"
  | "invalid"
  | "failed"; // server/network error, retry possible

/** Maps an API failure (non-2xx) to a UI state and keeps the backend message. */
function resolveErrorState(error: unknown): { state: VerifyState; message: string | null } {
  if (!isApiError(error) || error.status === 0 || error.status >= 500) {
    return { state: "failed", message: null };
  }

  const message = error.message;
  const lower = message.toLowerCase();

  if (error.status === 410 || lower.includes("expired")) {
    return { state: "expired", message };
  }
  if (error.status === 409 || lower.includes("already")) {
    return { state: "already_verified", message };
  }
  return { state: "invalid", message };
}

function VerifyEmailPage() {
  const [{ token }] = useTypedSearch(searchSchema);
  const [state, setState] = useState<VerifyState>(token ? "verifying" : "invalid");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Token is one-time use and React StrictMode runs effects twice in dev,
  // so remember which token/attempt was already submitted.
  const submitted = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }

    const key = `${token}:${attempt}`;
    if (submitted.current === key) return;
    submitted.current = key;

    setState("verifying");
    setServerMessage(null);

    verifyEmail({ token })
      .then((response) => {
        setServerMessage(response.message ?? null);
        setState(response.data?.already_verified ? "already_verified" : "verified");
      })
      .catch((error) => {
        const result = resolveErrorState(error);
        setState(result.state);
        setServerMessage(result.message);
      });
  }, [token, attempt]);

  const signInButton = (
    <Button asChild className="w-full">
      <Link to="/login">Go to sign in</Link>
    </Button>
  );

  const failureActions = (
    <>
      <Button asChild className="w-full">
        <Link to="/signup">Create account again</Link>
      </Button>
      <Button asChild variant="outline" className="w-full">
        <Link to="/login">Back to sign in</Link>
      </Button>
    </>
  );

  return (
    <AuthLayout>
      {state === "verifying" ? (
        <AuthStatePanel
          icon={<Loader2 className="size-5 animate-spin" />}
          title="Verifying your email"
          description="Hold on a moment while we confirm this verification link."
        />
      ) : state === "verified" ? (
        <AuthStatePanel
          tone="success"
          icon={<CheckCircle2 className="size-5" />}
          title="Email verified"
          description="Your email address is confirmed. Sign in to continue setting up your locations."
        >
          {signInButton}
        </AuthStatePanel>
      ) : state === "already_verified" ? (
        <AuthStatePanel
          icon={<BadgeCheck className="size-5" />}
          title="Already verified"
          description={
            serverMessage ?? "This email address has already been confirmed. Please log in."
          }
        >
          {signInButton}
        </AuthStatePanel>
      ) : state === "expired" ? (
        <AuthStatePanel
          tone="critical"
          icon={<TimerOff className="size-5" />}
          title="This verification link has expired"
          description="Verification links stay valid for a limited time. Please sign up again to receive a new link."
        >
          {failureActions}
        </AuthStatePanel>
      ) : state === "failed" ? (
        <AuthStatePanel
          tone="critical"
          icon={<AlertTriangle className="size-5" />}
          title="We couldn't verify your email"
          description="Something went wrong on our side. Please try again in a moment."
        >
          <Button type="button" className="w-full" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </AuthStatePanel>
      ) : (
        <AuthStatePanel
          tone="critical"
          icon={<LinkIcon className="size-5" />}
          title="This verification link isn't valid"
          description={
            serverMessage ??
            "The link may be incomplete or already used. Please check the link in your email or sign up again."
          }
        >
          {failureActions}
        </AuthStatePanel>
      )}

      <AuthFooterNote>
        Need a new account?{" "}
        <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
      </AuthFooterNote>
    </AuthLayout>
  );
}

export default VerifyEmailPage;