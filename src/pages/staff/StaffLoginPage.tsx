import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { AuthField, AuthFooterNote, AuthFormError, AuthHeading, AuthInput, AuthLayout, AuthPasswordInput } from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getStaffMe, isApiError, signOutStaff, staffLogin } from "@/api";
import { GENERIC_AUTH_ERROR, emailSchema, rateLimitMessage } from "@/lib/auth/auth-recovery";
import { canRunAudits, useStaffToken, type StaffRedirectState } from "@/lib/staff/staff-session";

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Enter your password." }).max(128),
});

/** Where a signed-in staff member lands: the page that sent them here, else the audit. */
function nextPath(state: unknown): string {
  const from = (state as StaffRedirectState | null)?.from;
  return from?.startsWith("/staff/") && !from.startsWith("/staff/login") ? from : "/staff/audits";
}

/** Staff sign-in (`POST /admin/auth/login`), separate from the customer login. */
function StaffLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useStaffToken();
  const [values, setValues] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string | undefined; password?: string | undefined }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (and not mid-submit): straight to the audit, where the gate checks the permission.
  if (token && !submitting) return <Navigate to={nextPath(location.state)} replace />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const result = schema.safeParse(values);
    if (!result.success) {
      const next: typeof errors = {};
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
      await staffLogin({ ...result.data, remember });
      const admin = await getStaffMe();
      if (!canRunAudits(admin.permissions)) {
        signOutStaff();
        setFormError("This account can't run sales audits. Ask an administrator for the Sales Representative role.");
        return;
      }
      await navigate(nextPath(location.state), { replace: true });
    } catch (error) {
      signOutStaff();
      // Every credential failure (wrong password, unknown, deactivated, no password yet) is a 400 without a reason.
      setFormError(
        isApiError(error) && error.status === 400 ? "Wrong email or password." : (rateLimitMessage(error) ?? GENERIC_AUTH_ERROR),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeading title="Staff sign in" description="For MyPageSEO staff running free sales audits." />
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="min-h-0" aria-live="polite">
          {formError ? <AuthFormError message={formError} /> : null}
        </div>
        <AuthField label="Work email" htmlFor="staff-email" error={errors.email}>
          <AuthInput
            id="staff-email"
            type="email"
            autoComplete="username"
            placeholder="you@mypageseo.com"
            value={values.email}
            invalid={Boolean(errors.email)}
            onChange={(e) => {
              setValues((v) => ({ ...v, email: e.target.value }));
              setErrors((p) => ({ ...p, email: undefined }));
            }}
          />
        </AuthField>
        <AuthField label="Password" htmlFor="staff-password" error={errors.password}>
          <AuthPasswordInput
            id="staff-password"
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
        <label htmlFor="staff-remember" className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox id="staff-remember" checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
          Keep me signed in on this device (12 hours)
        </label>
        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
      <AuthFooterNote>Forgot your password? Ask an administrator to send you a new set-password link.</AuthFooterNote>
    </AuthLayout>
  );
}

export default StaffLoginPage;
