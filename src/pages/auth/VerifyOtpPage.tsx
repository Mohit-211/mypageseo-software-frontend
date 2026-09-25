import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import {
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthLayout,
  AuthStatePanel,
} from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { isApiError, sendOtp, verifyOtp } from "@/api";
import { useTypedSearch } from "@/hooks/use-typed-search";

const OTP_LENGTH = 6;

const searchSchema = z.object({
  email: z.string().email().optional(),
  /** Set by the page that sent the user here; signup and login use EMAIL_VERIFICATION. */
  type: z.enum(["EMAIL_VERIFICATION", "FORGOT_PASSWORD", "RESET_PASSWORD"]).catch("EMAIL_VERIFICATION"),
});

function VerifyOtpPage() {
  const [{ email, type }] = useTypedSearch(searchSchema, { type: "EMAIL_VERIFICATION" });
  const location = useLocation();
  const navigate = useNavigate();
  const fromUnverifiedLogin = (location.state as { unverified?: boolean } | null)?.unverified === true;

  const [otp, setOtp] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Where to go to start over with a different email.
  const restartPath = type === "EMAIL_VERIFICATION" ? "/signup" : "/forgot-password";

  if (!email) return <Navigate to={restartPath} replace />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !email) return;
    if (otp.length !== OTP_LENGTH) {
      setFormError(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await verifyOtp({ email, otp, type });
      if (type === "EMAIL_VERIFICATION") {
        setVerified(true);
        return;
      }
      // Password flows get a reset token back; hand it straight to the reset page.
      const token = typeof response?.data === "string" ? response.data : "";
      if (!token) {
        setFormError("We couldn't start the password reset. Please request a new code.");
        return;
      }
      await navigate(
        `/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
        { replace: true },
      );
    } catch (error) {
      setFormError(
        isApiError(error) && error.status > 0 && error.status < 500
          ? error.message
          : "We couldn't verify the code right now. Please try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending || !email) return;
    setResending(true);
    setFormError(null);
    setResent(false);
    try {
      await sendOtp({ email, type });
      setOtp("");
      setResent(true);
    } catch (error) {
      setFormError(
        isApiError(error) && error.status > 0 && error.status < 500
          ? error.message
          : "We couldn't send a new code. Please try again in a moment.",
      );
    } finally {
      setResending(false);
    }
  }

  if (verified) {
    return (
      <AuthLayout>
        <AuthStatePanel
          tone="success"
          icon={<CheckCircle2 className="size-5" />}
          title="Email verified"
          description="Your account is active. Sign in to continue."
        >
          <Button asChild className="w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </AuthStatePanel>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading
        title="Verify your email"
        description={`Enter the ${OTP_LENGTH}-digit code we sent to ${email}.`}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError ? <AuthFormError message={formError} /> : null}
        {fromUnverifiedLogin && !formError && !resent ? (
          <AuthFormError message="Your account is not verified yet. Enter the code we sent to your email to continue." />
        ) : null}
        {resent ? (
          <p className="rounded-md border border-success/30 bg-success-surface px-3 py-2.5 text-sm text-foreground">
            A new code is on its way to {email}.
          </p>
        ) : null}

        <div className="flex justify-center">
          <InputOTP
            maxLength={OTP_LENGTH}
            value={otp}
            onChange={(value) => {
              setOtp(value.replace(/\D/g, ""));
              setFormError(null);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          >
            <InputOTPGroup>
              {Array.from({ length: OTP_LENGTH }, (_, index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          type="submit"
          className="h-10 w-full"
          disabled={submitting || otp.length !== OTP_LENGTH}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Verifying…
            </>
          ) : (
            "Verify"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Didn't get a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        </p>
      </form>

      <AuthFooterNote>
        Wrong email?{" "}
        <Link to={restartPath} className="font-medium text-primary underline-offset-4 hover:underline">
          {type === "EMAIL_VERIFICATION" ? "Sign up again" : "Use a different email"}
        </Link>
      </AuthFooterNote>
    </AuthLayout>
  );
}

export default VerifyOtpPage;
