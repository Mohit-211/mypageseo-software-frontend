import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldAlert, TimerOff } from "lucide-react";
import { z } from "zod";
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthLayout,
  AuthLink,
  AuthPasswordInput,
  AuthStatePanel,
} from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { GENERIC_AUTH_ERROR, passwordSchema, rateLimitMessage } from "@/lib/auth/auth-recovery";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { isApiError, resetPassword } from "@/api";

const searchSchema = z.object({
  token: z.string().optional(),
});

const formSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: "Re-enter the new password." }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Both passwords must match.",
  });

type FieldErrors = { password?: string | undefined; confirmPassword?: string | undefined };
type LinkProblem = "missing" | "expired" | "invalid";

const FIELD_IDS: Record<keyof FieldErrors, string> = { password: "new-password", confirmPassword: "confirm-password" };

/** `/reset-password?token=…`, opened from the forgot-password email. */
function ResetPasswordPage() {
  const [{ token }] = useTypedSearch(searchSchema);
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [linkProblem, setLinkProblem] = useState<LinkProblem | null>(token ? null : "missing");

  if (linkProblem) {
    return (
      <AuthLayout>
        <AuthStatePanel
          tone="critical"
          icon={linkProblem === "expired" ? <TimerOff /> : <ShieldAlert />}
          title={linkProblem === "expired" ? "This link has expired" : "This link isn't valid"}
          description={
            linkProblem === "expired"
              ? "Reset links last 60 minutes. Request a new one to continue."
              : "It may be incomplete, already used, or replaced by a newer link. Request a new one to continue."
          }
        >
          <Button asChild size="lg" className="w-full">
            <Link to="/forgot-password">Send a new link</Link>
          </Button>
          <Button asChild variant="ghost" className="h-10 w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </AuthStatePanel>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <AuthStatePanel
          tone="success"
          icon={<CheckCircle2 />}
          title="Password changed"
          description="You've been signed out everywhere. Sign in with your new password to continue."
        >
          <Button asChild size="lg" className="w-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </AuthStatePanel>
      </AuthLayout>
    );
  }

  function update(key: keyof FieldErrors, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function showErrors(next: FieldErrors) {
    setErrors(next);
    const first = (Object.keys(FIELD_IDS) as (keyof FieldErrors)[]).find((key) => next[key]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !token) return;
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setFormError(null);
      showErrors(next);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await resetPassword({ token, password: parsed.data.password, confirm_password: parsed.data.confirmPassword });
      setDone(true);
    } catch (error) {
      const reason = isApiError(error) ? error.reason : undefined;
      if (reason === "link_expired") setLinkProblem("expired");
      else if (reason === "link_invalid") setLinkProblem("invalid");
      else if (reason === "passwords_do_not_match") showErrors({ confirmPassword: "Both passwords must match." });
      else if (isApiError(error) && error.status === 400 && error.message) showErrors({ password: error.message });
      else setFormError(rateLimitMessage(error) ?? GENERIC_AUTH_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeading title="Set a new password" description="Choose a new password for your MyPageSEO account." />
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError ? <AuthFormError message={formError} /> : null}
        <AuthField
          label="New password"
          htmlFor={FIELD_IDS.password}
          error={errors.password}
          hint="At least 8 characters, including a letter and a number."
        >
          <AuthPasswordInput
            id={FIELD_IDS.password}
            name="password"
            autoComplete="new-password"
            placeholder="Create a new password"
            value={values.password}
            invalid={Boolean(errors.password)}
            onChange={(e) => update("password", e.target.value)}
          />
        </AuthField>
        <AuthField label="Confirm new password" htmlFor={FIELD_IDS.confirmPassword} error={errors.confirmPassword}>
          <AuthPasswordInput
            id={FIELD_IDS.confirmPassword}
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter the new password"
            value={values.confirmPassword}
            invalid={Boolean(errors.confirmPassword)}
            onChange={(e) => update("confirmPassword", e.target.value)}
          />
        </AuthField>
        <Button type="submit" size="lg" className="w-full" disabled={submitting} aria-busy={submitting || undefined}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Changing password…
            </>
          ) : (
            "Change password"
          )}
        </Button>
      </form>
      <AuthFooterNote>
        Remembered it? <AuthLink to="/login">Back to sign in</AuthLink>
      </AuthFooterNote>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
