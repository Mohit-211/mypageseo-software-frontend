import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, MailWarning } from "lucide-react";
import { z } from "zod";
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthInput,
  AuthLink,
  AuthPasswordInput,
  AuthStatePanel,
  LoginAuthLayout,
} from "@/components/auth/auth";
import { ResendVerification } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isApiError, login } from "@/api";
import { preloadPath } from "@/app/route-preload";
import { GENERIC_AUTH_ERROR, emailSchema, rateLimitMessage } from "@/lib/auth/auth-recovery";
import { getPostLoginPath } from "@/lib/auth/auth-session";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Enter your password." }).max(128),
});

type FieldErrors = { email?: string | undefined; password?: string | undefined };

/** The subtle way in for MyPageSEO staff (the marketing footer that linked it is gone). */
function StaffSignInLink() {
  return (
    <Link
      to="/staff/login"
      className="inline-flex min-h-9 items-center rounded-sm px-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      Staff sign in
    </Link>
  );
}

/** `/login`, the app's landing page for signed-out visitors. */
function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Reset-password and invitation pages pass the email along so it's filled in.
  const prefilledEmail = (location.state as { email?: unknown } | null)?.email?.toString() ?? "";
  // An invitation just accepted with an existing account: open that organization after sign-in.
  const joinedOrganizationId = (location.state as { organizationId?: unknown } | null)?.organizationId;
  const { setOrganizationId } = useWorkspace();
  const [values, setValues] = useState(() => ({ email: prefilledEmail, password: "" }));
  // On by default: closing the tab must not sign the user out. Unticked keeps the session in this tab only.
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Set when the password was right but the email isn't verified yet. */
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  // Signing in leads to the dashboard (or back to the page that sent the user here):
  // download that code while they type, so the first screen after sign-in is instant.
  useEffect(() => {
    const preload = () => {
      preloadPath("/dashboard");
      const next = getPostLoginPath(location.state);
      if (next !== "/dashboard") preloadPath(next);
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(preload, 300);
    return () => window.clearTimeout(timer);
  }, [location.state]);

  // The landing page exists to sign in: start in the first empty field. Only with a mouse or
  // trackpad, since on phones a keyboard popping up on arrival would hide the page.
  useEffect(() => {
    if (!window.matchMedia?.("(pointer: fine)").matches) return;
    document.getElementById(prefilledEmail ? "login-password" : "login-email")?.focus();
  }, [prefilledEmail]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const result = loginSchema.safeParse(values);
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setFormError(null);
      const first = result.error.issues[0]?.path[0];
      document.getElementById(first === "password" ? "login-password" : "login-email")?.focus();
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const session = await login({ ...result.data, rememberMe: keepSignedIn });
      // A sign-in starts in the default organization; the one just joined is opened instead (when
      // this account is its member, i.e. the invitation was for it).
      if (typeof joinedOrganizationId === "string" && session.organizations?.some((org) => org.organization_id === joinedOrganizationId)) {
        setOrganizationId(joinedOrganizationId);
      }
      // The page that sent the user here, else the dashboard (which leads to any unfinished setup).
      await navigate(getPostLoginPath(location.state), { replace: true });
    } catch (error) {
      if (isApiError(error) && error.reason === "email_not_verified") {
        setUnverifiedEmail(result.data.email);
        return;
      }
      const wrongCredentials = isApiError(error) && error.status === 401;
      setFormError(
        wrongCredentials
          ? "That email and password don't match. Check them and try again."
          : isApiError(error) && error.reason === "account_disabled"
            ? "This account has been disabled. Contact support if you think this is a mistake."
            : (rateLimitMessage(error) ??
              (isApiError(error) && error.status === 400 && error.message ? error.message : GENERIC_AUTH_ERROR)),
      );
      if (wrongCredentials) {
        // Usually a typo in the password: put the cursor back there, ready to retype.
        const password = document.getElementById("login-password") as HTMLInputElement | null;
        password?.focus();
        password?.select();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (unverifiedEmail) {
    return (
      <LoginAuthLayout footer={<StaffSignInLink />}>
        <AuthStatePanel
          icon={<MailWarning />}
          title="Verify your email first"
          description={
            <>
              Open the link we emailed to <span className="font-medium text-foreground">{unverifiedEmail}</span>, then
              sign in. Links expire after 24 hours.
            </>
          }
        >
          <ResendVerification email={unverifiedEmail} />
          <Button variant="ghost" className="h-10 w-full" onClick={() => setUnverifiedEmail(null)}>
            Back to sign in
          </Button>
        </AuthStatePanel>
      </LoginAuthLayout>
    );
  }

  return (
    <LoginAuthLayout footer={<StaffSignInLink />}>
      <AuthHeading
        title="Sign in to MyPageSEO"
        description="Welcome back! Pick up where you left off with your rankings, reviews and reports."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError ? <AuthFormError message={formError} /> : null}

        <AuthField label="Email" htmlFor="login-email" error={errors.email}>
          <AuthInput
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
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
            name="password"
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

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
          <label htmlFor="keep-signed-in" className="flex min-h-9 cursor-pointer items-center gap-2.5 text-foreground">
            <Checkbox
              id="keep-signed-in"
              checked={keepSignedIn}
              onCheckedChange={(checked) => setKeepSignedIn(checked === true)}
            />
            Keep me signed in
          </label>
          <AuthLink to="/forgot-password" className="inline-flex min-h-9 shrink-0 items-center">
            Forgot password?
          </AuthLink>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting} aria-busy={submitting || undefined}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <AuthFooterNote>
        New to MyPageSEO? <AuthLink to="/signup">Create an account</AuthLink>
      </AuthFooterNote>
    </LoginAuthLayout>
  );
}

export default LoginPage;
