import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
} from "@/components/mypageseo/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DEMO_CREDENTIALS, matchDemoCredential } from "@/lib/mypageseo/demo/credentials";
import {
  clearOnboardingSession,
  startOnboardingSession,
} from "@/lib/mypageseo/onboarding-state";

const description = "Sign in to continue managing your local search performance.";



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
      // Sign-in runs through the project's authentication backend, which is
      // not connected to this frontend yet. The demo credentials below open the
      // flows locally so setup and the product can be walked end to end.
      const demo = matchDemoCredential(result.data.email, result.data.password);
      if (!demo) throw new Error("auth-unavailable");

      if (demo.destination === "onboarding") {
        startOnboardingSession({
          accountType: demo.accountType,
          organizationName: demo.organizationName,
          country: demo.country,
        });
        await navigate("/onboarding");
      } else {
        clearOnboardingSession();
        await navigate("/dashboard");
      }
    } catch {
      setFormError(
        "We couldn't sign you in with those details. Real sign-in isn't available on this environment yet — use one of the demo sign-ins listed below.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(email: string, password: string) {
    setValues({ email, password });
    setErrors({});
    setFormError(null);
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

      <section
        aria-label="Demo sign-in details"
        className="mt-6 rounded-md border border-border bg-surface p-3"
      >
        <h2 className="text-[13px] font-semibold text-foreground">Demo sign-in</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Real accounts aren&apos;t available on this environment. Use one of these to walk
          through setup and the product.
        </p>
        <ul className="mt-2.5 space-y-2">
          {DEMO_CREDENTIALS.map((entry) => (
            <li
              key={entry.email}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">{entry.email}</p>
                <p className="text-xs text-muted-foreground">
                  Password: {entry.password} · {entry.label}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fillDemo(entry.email, entry.password)}
              >
                Use
              </Button>
            </li>
          ))}
        </ul>
      </section>

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
