import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CheckCircle2, LinkIcon, Loader2, TimerOff } from "lucide-react";
import { z } from "zod";
import {
  AuthFooterNote,
  AuthFormError,
  AuthLayout,
  AuthStatePanel,
} from "@/components/mypageseo/auth";
import { Button } from "@/components/ui/button";
import {
  authRecoveryCapabilities,
  resolveVerificationState,
  type VerificationState,
} from "@/lib/mypageseo/auth-recovery";
import { useTypedSearch } from "@/hooks/use-typed-search";

const description = "Confirm your email address to activate your Mypageseo account.";

const searchSchema = z.object({
  token: z.string().optional(),
});



function VerifyEmailPage() {
  const [{ token }, setSearch] = useTypedSearch(searchSchema);
  const capabilities = authRecoveryCapabilities();

  const [state, setState] = useState<VerificationState | "verifying">("verifying");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setState("verifying");
    const timer = setTimeout(() => {
      if (active) setState(resolveVerificationState(token));
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token]);

  async function handleResend() {
    if (resending || !capabilities.resendVerification) return;
    setResending(true);
    setResendError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setResent(true);
    } catch {
      setResendError("We couldn't send a new verification email. Please try again in a moment.");
    } finally {
      setResending(false);
    }
  }

  const resendBlock =
    state === "invalid" || state === "expired" ? (
      <>
        {resendError ? <AuthFormError message={resendError} /> : null}
        {resent ? (
          <p className="rounded-md border border-success/30 bg-success-surface px-3 py-2.5 text-sm text-foreground">
            If the address still needs confirming, a new verification email is on its way.
          </p>
        ) : capabilities.resendVerification ? (
          <Button type="button" className="w-full" onClick={handleResend} disabled={resending}>
            {resending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Sending email…
              </>
            ) : (
              "Send a new verification email"
            )}
          </Button>
        ) : null}
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </>
    ) : null;

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
          <Button asChild className="w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </AuthStatePanel>
      ) : state === "already_verified" ? (
        <AuthStatePanel
          icon={<BadgeCheck className="size-5" />}
          title="Already verified"
          description="This email address has already been confirmed. Nothing further is needed."
        >
          <Button asChild className="w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </AuthStatePanel>
      ) : state === "expired" ? (
        <AuthStatePanel
          tone="critical"
          icon={<TimerOff className="size-5" />}
          title="This verification link has expired"
          description="Verification links stay valid for a limited time. Request a new one to confirm your email address."
        >
          {resendBlock}
        </AuthStatePanel>
      ) : (
        <AuthStatePanel
          tone="critical"
          icon={<LinkIcon className="size-5" />}
          title="This verification link isn't valid"
          description="The link may be incomplete or already used. Request a new verification email to continue."
        >
          {resendBlock}
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
