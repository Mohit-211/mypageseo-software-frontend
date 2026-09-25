import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthInput,
  LoginAuthLayout,
  AuthPasswordInput,
} from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isApiError, login, sendOtp } from "@/api";
import { getPostLoginPath } from "@/lib/auth-lib/auth-session";

const description = "Sign in to continue managing your local search performance.";



/** The backend refuses sign-in for accounts that haven't confirmed their OTP yet. */
function isUnverifiedError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return /not verified|verify your otp/i.test(error.message) || error.code === "USER_NOT_VERIFIED";
}

/** How long the unverified message stays on screen before redirecting. */
const UNVERIFIED_REDIRECT_MS = 1500;

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Enter your email address." })
    .email({ message: "Enter a valid email address." })
    .max(255),
  password: z.string().min(1, { message: "Enter your password." }).max(128),
});

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string | undefined; password?: string | undefined }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      if (isUnverifiedError(error)) {
        const email = result.data.email;
        setFormError(
          isApiError(error) ? error.message : "User is not verified yet. Please verify your OTP first.",
        );
        // Send a fresh code so the user has one waiting on the verify page.
        sendOtp({ email, type: "EMAIL_VERIFICATION" }).catch(() => undefined);
        setTimeout(() => {
          void navigate(`/verify-otp?email=${encodeURIComponent(email)}&type=EMAIL_VERIFICATION`, {
            state: { unverified: true },
          });
        }, UNVERIFIED_REDIRECT_MS);
        return;
      }
      if (isApiError(error) && error.fieldErrors) {
        const { email, password } = error.fieldErrors;
        setErrors({ email, password });
      }
      setFormError(
        isApiError(error) && error.status > 0 && error.status < 500
          ? error.message
          : "We couldn't sign you in right now. Please try again, or contact support if it keeps happening.",
      );
    } finally {
      setSubmitting(false);
    }
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
