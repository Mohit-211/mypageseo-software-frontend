import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, LinkIcon, Loader2, TimerOff } from "lucide-react";
import { z } from "zod";
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthPasswordInput,
  AuthLayout,
  AuthStatePanel,
} from "@/components/mypageseo/auth";
import { Button } from "@/components/ui/button";
import {
  authRecoveryCapabilities,
  passwordSchema,
  resolveResetTokenState,
} from "@/lib/mypageseo/auth-recovery";
import { useTypedSearch } from "@/hooks/use-typed-search";

const description = "Set a new password for your Mypageseo account.";

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

function ResetPasswordPage() {
  const [{ token }, setSearch] = useTypedSearch(searchSchema);
  const tokenState = resolveResetTokenState(token);
  const capabilities = authRecoveryCapabilities();

  const [values, setValues] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (tokenState !== "valid") {
    const expired = tokenState === "expired";
    return (
      <AuthLayout>
        <AuthStatePanel
          tone="critical"
          icon={expired ? <TimerOff className="size-5" /> : <LinkIcon className="size-5" />}
          title={expired ? "This reset link has expired" : "This reset link isn't valid"}
          description={
            expired
              ? "Password reset links can only be used once and stay valid for a limited time. Request a new link to continue."
              : "The link may be incomplete or already used. Request a new password reset link to continue."
          }
        >
          <Button asChild className="w-full">
            <Link to="/forgot-password">Request a new link</Link>
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
      await new Promise((resolve) => setTimeout(resolve, 500));
      setDone(true);
    } catch {
      setFormError("We couldn't update your password right now. Please try again in a moment.");
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
