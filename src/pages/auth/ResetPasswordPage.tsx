import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { z } from "zod";
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthPasswordInput,
  AuthLayout,
  AuthStatePanel,
} from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import {
  authRecoveryCapabilities,
  passwordSchema,
} from "@/lib/auth/auth-recovery";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { forgotPassword, isApiError } from "@/api";
import { resetPassword } from "@/api/auth/reset-password";
const searchSchema = z.object({
  email: z.string().email().optional(),
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
function ResetPasswordPage() {
  const [{ token }] = useTypedSearch(searchSchema);
  const capabilities = authRecoveryCapabilities();
  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // The token comes from verify-otp; without it (or the email) there's nothing to reset.
  // An expired token is reported by the backend when the form is submitted.
  if (!token) {
    return (
      <AuthLayout>
        <AuthStatePanel
          tone="critical"
          icon={<ShieldAlert className="size-5" />}
          title="Verify your code first"
          description="To set a new password, request a reset code and enter it to continue."
        >
          <Button asChild className="w-full">
            <Link to="/forgot-password">Request a new code</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
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
          icon={<CheckCircle2 className="size-5" />}
          title="Password updated"
          description="Your password has been changed. Sign in with your new password to continue."
        >
          <Button asChild className="w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </AuthStatePanel>
      </AuthLayout>
    );
  }
  function update(key: keyof FieldErrors, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !capabilities.resetPassword) return;
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setFormError(null);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await resetPassword({
        password: parsed.data.password,
        confirm_password: parsed.data.confirmPassword,
        token: token ?? "",
      });
      setDone(true);
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) {
        const { password, confirm_password } = error.fieldErrors;
        setErrors({ password, confirmPassword: confirm_password });
      }
      setFormError(
        isApiError(error) && error.status > 0 && error.status < 500
          ? error.message
          : "We couldn't update your password right now. Please try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <AuthLayout>
      <AuthHeading
        title="Set a new password"
        description="Choose a new password for your Mypageseo account."
      />
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError ? <AuthFormError message={formError} /> : null}
        <AuthField
          label="New password"
          htmlFor="new-password"
          error={errors.password}
          hint="At least 8 characters, including a letter and a number."
        >
          <AuthPasswordInput
            id="new-password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a new password"
            value={values.password}
            invalid={Boolean(errors.password)}
            onChange={(e) => update("password", e.target.value)}
          />
        </AuthField>
        <AuthField
          label="Confirm new password"
          htmlFor="confirm-password"
          error={errors.confirmPassword}
        >
          <AuthPasswordInput
            id="confirm-password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter the new password"
            value={values.confirmPassword}
            invalid={Boolean(errors.confirmPassword)}
            onChange={(e) => update("confirmPassword", e.target.value)}
          />
        </AuthField>
        <Button
          type="submit"
          className="h-10 w-full"
          disabled={submitting || !capabilities.resetPassword}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Updating password…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
      <AuthFooterNote>
        Remembered it?{" "}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </AuthFooterNote>
    </AuthLayout>
  );
}
export default ResetPasswordPage;