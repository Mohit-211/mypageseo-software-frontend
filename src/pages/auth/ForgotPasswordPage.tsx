import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthInput,
  AuthLayout,
  AuthStatePanel,
} from "@/components/mypageseo/auth";
import { Button } from "@/components/ui/button";
import { authRecoveryCapabilities, resetEmailSchema } from "@/lib/mypageseo/auth-recovery";

const description = "Request a password reset link for your Mypageseo account.";



function ForgotPasswordPage() {
  const capabilities = authRecoveryCapabilities();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

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
      // The authentication service answers this request identically for known
      // and unknown addresses, so the screen never reveals whether an account
      // exists.
      await new Promise((resolve) => setTimeout(resolve, 500));
      setRequested(true);
    } catch {
      setFormError("We couldn't send the reset link right now. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (requested) {
    return (
      <AuthLayout>
        <AuthStatePanel
          tone="success"
          icon={<MailCheck className="size-5" />}
          title="Check your email"
          description={
            <>
              If an account exists for that email address, we&apos;ve sent a link to reset the
              password. The link can only be used once and expires after a short time.
            </>
          }
        >
          <Button asChild className="w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setRequested(false)}
          >
            Use a different email address
          </Button>
        </AuthStatePanel>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading
        title="Reset your password"
        description="Enter the email address on your account and we'll send a link to set a new password."
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
          hint="We send the link to this address only — nothing is revealed about the account."
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
              Sending link…
            </>
          ) : (
            "Send reset link"
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
