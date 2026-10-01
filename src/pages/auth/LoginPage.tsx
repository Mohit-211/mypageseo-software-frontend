import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, MailWarning } from "lucide-react";
import { z } from "zod";
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthInput,
  LoginAuthLayout,
  AuthPasswordInput,
  AuthStatePanel,
} from "@/components/auth/auth";
import { ResendVerification } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isApiError, login } from "@/api";
import { GENERIC_AUTH_ERROR, emailSchema, rateLimitMessage } from "@/lib/auth/auth-recovery";
import { getPostLoginPath } from "@/lib/auth/auth-session";

const description = "Sign in to continue managing your local search performance.";



const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Enter your password." }).max(128),
});

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Reset-password and invitation pages pass the email along so it's filled in.
  const [values, setValues] = useState(() => ({
    email: (location.state as { email?: unknown } | null)?.email?.toString() ?? "",
    password: "",
  }));
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string | undefined; password?: string | undefined }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Set when the password was right but the email isn't verified yet. */
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const result = loginSchema.safeParse(values);
    if (!result.success) {
      const next: { email?: string | undefined; password?: string | undefined } = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as "email" | "password";
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await login({ ...result.data, rememberMe });
      // Unfinished setup first, then the page that sent the user here, then the dashboard.
      await navigate(getPostLoginPath(location.state), { replace: true });
    } catch (error) {
      if (isApiError(error) && error.reason === "email_not_verified") {
        setUnverifiedEmail(result.data.email);
        return;
      }
      setFormError(
        isApiError(error) && error.status === 401
          ? "Wrong email or password."
          : isApiError(error) && error.reason === "account_disabled"
            ? "This account has been disabled. Contact support if you think this is a mistake."
            : (rateLimitMessage(error) ??
              (isApiError(error) && error.status === 400 && error.message ? error.message : GENERIC_AUTH_ERROR)),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (unverifiedEmail) {
    return (
      <LoginAuthLayout>
        <AuthStatePanel
          icon={<MailWarning className="size-5" />}
          title="Verify your email first"
          description={<>Open the link we emailed to <span className="font-medium text-foreground">{unverifiedEmail}</span>, then sign in. Links expire after 24 hours.</>}
        >
          <ResendVerification email={unverifiedEmail} />
          <Button variant="ghost" className="w-full" onClick={() => setUnverifiedEmail(null)}>
            Back to sign in
          </Button>
        </AuthStatePanel>
      </LoginAuthLayout>
    );
  }

  return (
    <LoginAuthLayout>
      <AuthHeading title="Welcome back" description={description} />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="min-h-0" aria-live="polite">
          {formError ? <AuthFormError message={formError} /> : null}
        </div>

        <AuthField label="Email address" htmlFor="login-email" error={errors.email}>
          <AuthInput
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={values.email}
            invalid={Boolean(errors.email)}
            onChange={(e) => {
              setValues((v) => ({ ...v, email: e.target.value }));
              setErrors((p) => ({ ...p, email: undefined }));
            }}
          />
        </AuthField>

        <AuthField label="Password" htmlFor="login-password" error={errors.password}>
          <AuthPasswordInput
            id="login-password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={values.password}
            invalid={Boolean(errors.password)}
            onChange={(e) => {
              setValues((v) => ({ ...v, password: e.target.value }));
              setErrors((p) => ({ ...p, password: undefined }));
            }}
          />
        </AuthField>

        <div className="flex items-center justify-between gap-4 text-sm">
          <label htmlFor="remember-me" className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              aria-label="Remember me"
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="shrink-0 font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

    

      <AuthFooterNote>
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
      </AuthFooterNote>
    </LoginAuthLayout>
  );
}

export default LoginPage;
