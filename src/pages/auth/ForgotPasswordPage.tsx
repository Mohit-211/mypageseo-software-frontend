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
  AuthLink,
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
      document.getElementById("recovery-email")?.focus();
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
          icon={<MailCheck />}
          title="Check your email"
          description={
            <>
              If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, we emailed a link to
              set a new password. It works once and expires after 60 minutes.
            </>
          }
        >
          <Button variant="outline" className="h-10 w-full" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
          <Button asChild variant="ghost" className="h-10 w-full">
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

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError ? <AuthFormError message={formError} /> : null}

        <AuthField label="Email" htmlFor="recovery-email" error={fieldError}>
          <AuthInput
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            value={email}
            invalid={Boolean(fieldError)}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldError(undefined);
            }}
          />
        </AuthField>

        <Button type="submit" size="lg" className="w-full" disabled={submitting} aria-busy={submitting || undefined}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Sending link…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>

        <Button asChild variant="ghost" className="h-10 w-full">
          <Link to="/login">
            <ArrowLeft aria-hidden />
            Back to sign in
          </Link>
        </Button>
      </form>

      <AuthFooterNote>
        New to MyPageSEO? <AuthLink to="/signup">Create an account</AuthLink>
      </AuthFooterNote>
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
