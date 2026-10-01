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
} from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { forgotPassword } from "@/api";
import { GENERIC_AUTH_ERROR, emailSchema, rateLimitMessage } from "@/lib/auth/auth-recovery";

/** Requests a reset link. The answer never reveals whether an account exists. */
function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await forgotPassword(parsed.data);
      setSentTo(parsed.data);
    } catch (error) {
      setFormError(rateLimitMessage(error) ?? GENERIC_AUTH_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <AuthStatePanel
          tone="success"
          icon={<MailCheck className="size-5" />}
          title="Check your email"
          description={
            <>
              If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, we emailed a link to
              set a new password. It works once and expires after 60 minutes.
            </>
          }
        >
          <Button variant="outline" className="w-full" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </AuthStatePanel>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading
        title="Reset your password"
        description="Enter the email address on your account and we'll email you a link to set a new password."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError ? <AuthFormError message={formError} /> : null}

        <AuthField label="Email address" htmlFor="recovery-email" error={fieldError}>
          <AuthInput
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            invalid={Boolean(fieldError)}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldError(undefined);
            }}
          />
        </AuthField>

        <Button type="submit" className="h-10 w-full" disabled={submitting}>
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
