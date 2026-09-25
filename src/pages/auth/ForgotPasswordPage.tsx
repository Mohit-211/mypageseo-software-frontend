import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthInput,
  AuthLayout,
} from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { isApiError, sendOtp } from "@/api";
import { authRecoveryCapabilities, resetEmailSchema } from "@/lib/auth-lib/auth-recovery";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const capabilities = authRecoveryCapabilities();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !capabilities.requestPasswordReset) return;

    const parsed = resetEmailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const target = parsed.data;
      await sendOtp({ email: target, type: "FORGOT_PASSWORD" });
      // The backend emails a one-time code; the user confirms it on the OTP page.
      await navigate(`/verify-otp?email=${encodeURIComponent(target)}&type=FORGOT_PASSWORD`);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors?.email) setFieldError(error.fieldErrors.email);
      setFormError(
        isApiError(error) && error.status > 0 && error.status < 500
          ? error.message
          : "We couldn't send the reset code right now. Please try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeading
        title="Reset your password"
        description="Enter the email address on your account and we'll send a code to set a new password."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError ? <AuthFormError message={formError} /> : null}

        {capabilities.requestPasswordReset ? null : (
          <AuthFormError message="Password recovery is unavailable right now. Contact your account administrator if you need access restored." />
        )}

        <AuthField
          label="Email address"
          htmlFor="recovery-email"
          error={fieldError}
          hint="We send the code to this address only."
        >
          <AuthInput
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            invalid={Boolean(fieldError)}
            disabled={!capabilities.requestPasswordReset}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldError(undefined);
            }}
          />
        </AuthField>

        <Button
          type="submit"
          className="h-10 w-full"
          disabled={submitting || !capabilities.requestPasswordReset}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Sending code…
            </>
          ) : (
            "Send reset code"
          )}
        </Button>

        <Button asChild variant="ghost" className="h-10 w-full">
          <Link to="/login">
            <ArrowLeft className="size-4" aria-hidden />
            Back to sign in
          </Link>
        </Button>
      </form>

      <AuthFooterNote>
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
      </AuthFooterNote>
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
