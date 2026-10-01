import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, Loader2, LinkIcon, TimerOff } from "lucide-react";
import { z } from "zod";
import {
  AuthField,
  AuthFormError,
  AuthHeading,
  AuthInput,
  AuthLayout,
  AuthPasswordInput,
  AuthStatePanel,
} from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { acceptInvitation, inspectInvitation, isApiError, type InvitationInfo } from "@/api";
import { GENERIC_AUTH_ERROR, passwordSchema, rateLimitMessage } from "@/lib/auth/auth-recovery";
import { useTypedSearch } from "@/hooks/use-typed-search";

const searchSchema = z.object({ token: z.string().optional() });

const newAccountSchema = z.object({
  name: z.string().trim().min(1, { message: "Enter your full name." }).max(150, { message: "Name must be under 150 characters." }),
  password: passwordSchema,
});

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; invitation: InvitationInfo }
  | { kind: "unknown" }
  | { kind: "closed"; reason: "expired" | "revoked" | "accepted" }
  | { kind: "failed"; message: string };

const ROLE_LABEL: Record<string, string> = { owner: "Owner", member: "Member", client_user: "Client (read-only)" };

/** `/invite?token=…`: shows the invitation, then joins with a new or an existing account. */
function InvitePage() {
  const navigate = useNavigate();
  const [{ token }] = useTypedSearch(searchSchema);
  const [state, setState] = useState<LoadState>(token ? { kind: "loading" } : { kind: "unknown" });
  const inspected = useRef<string | null>(null);

  useEffect(() => {
    if (!token || inspected.current === token) return;
    inspected.current = token;
    inspectInvitation(token)
      .then((invitation) => setState({ kind: "ready", invitation }))
      .catch((error: unknown) => {
        if (isApiError(error) && error.status === 410) {
          const reason = error.reason === "revoked" || error.reason === "accepted" ? error.reason : "expired";
          setState({ kind: "closed", reason });
        } else if (isApiError(error) && (error.status === 404 || error.status === 400)) setState({ kind: "unknown" });
        else setState({ kind: "failed", message: rateLimitMessage(error) ?? GENERIC_AUTH_ERROR });
      });
  }, [token]);

  if (state.kind === "loading") {
    return (
      <AuthLayout>
        <AuthStatePanel icon={<Loader2 className="size-5 animate-spin" />} title="Opening your invitation" description="One moment…" />
      </AuthLayout>
    );
  }
  if (state.kind === "unknown" || state.kind === "closed" || state.kind === "failed") {
    const copy =
      state.kind === "closed"
        ? state.reason === "accepted"
          ? { title: "This invitation was already accepted", description: "Log in to open the organization." }
          : state.reason === "revoked"
            ? { title: "This invitation was withdrawn", description: "Ask the person who invited you to send a new one." }
            : { title: "This invitation has expired", description: "Ask the person who invited you to send a new one." }
        : state.kind === "failed"
          ? { title: "We couldn't open this invitation", description: state.message }
          : { title: "This invitation link isn't valid", description: "Check the link in your email, or ask for a new invitation." };
    return (
      <AuthLayout>
        <AuthStatePanel
          tone="critical"
          icon={state.kind === "closed" ? <TimerOff className="size-5" /> : state.kind === "failed" ? <AlertTriangle className="size-5" /> : <LinkIcon className="size-5" />}
          title={copy.title}
          description={copy.description}
        >
          <Button asChild className="w-full"><Link to="/login">Log in</Link></Button>
        </AuthStatePanel>
      </AuthLayout>
    );
  }

  return <AcceptInvitation token={token!} invitation={state.invitation} onAccepted={(path, email) => void navigate(path, { replace: true, ...(email ? { state: { email } } : {}) })} />;
}

function AcceptInvitation({
  token,
  invitation,
  onAccepted,
}: {
  token: string;
  invitation: InvitationInfo;
  onAccepted: (path: string, email?: string) => void;
}) {
  const [values, setValues] = useState({ name: "", password: "" });
  const [errors, setErrors] = useState<{ name?: string | undefined; password?: string | undefined }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const existing = invitation.account_exists;

  const accept = async () => {
    let body: { token: string; name?: string; password?: string } = { token };
    if (!existing) {
      const parsed = newAccountSchema.safeParse(values);
      if (!parsed.success) {
        const next: typeof errors = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as "name" | "password";
          if (key && !next[key]) next[key] = issue.message;
        }
        setErrors(next);
        return;
      }
      body = { token, ...parsed.data };
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await acceptInvitation(body);
      if (result.login_required) setNeedsLogin(true);
      else onAccepted("/dashboard");
    } catch (error) {
      if (isApiError(error) && error.status === 410) setFormError("This invitation is no longer open. Ask for a new one.");
      else if (isApiError(error) && error.reason === "account_details_required") setFormError("Enter your name and a password to create your account.");
      else if (isApiError(error) && error.status === 400 && /password/i.test(error.message)) setErrors({ password: error.message });
      else setFormError(rateLimitMessage(error) ?? GENERIC_AUTH_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  if (needsLogin) {
    return (
      <AuthLayout>
        <AuthStatePanel
          tone="success"
          icon={<Building2 className="size-5" />}
          title={`You've joined ${invitation.organization.name}`}
          description="Log in with your existing account to open it."
        >
          <Button className="w-full" onClick={() => onAccepted("/login", invitation.email)}>Log in</Button>
        </AuthStatePanel>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading
        title={`Join ${invitation.organization.name}`}
        description={`You're invited as ${ROLE_LABEL[invitation.role] ?? invitation.role} with ${invitation.email}.`}
      />
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void accept();
        }}
      >
        {formError ? <AuthFormError message={formError} /> : null}
        {existing ? (
          <p className="text-sm text-muted-foreground">
            You already have a Mypageseo account with this email. Accept to add this organization to it, then log in.
          </p>
        ) : (
          <>
            <AuthField required label="Full name" htmlFor="invite-name" error={errors.name}>
              <AuthInput
                id="invite-name"
                autoComplete="name"
                value={values.name}
                invalid={Boolean(errors.name)}
                onChange={(e) => {
                  setValues((v) => ({ ...v, name: e.target.value }));
                  setErrors((p) => ({ ...p, name: undefined }));
                }}
              />
            </AuthField>
            <AuthField required label="Password" htmlFor="invite-password" error={errors.password} hint="At least 8 characters, including a letter and a number.">
              <AuthPasswordInput
                id="invite-password"
                autoComplete="new-password"
                value={values.password}
                invalid={Boolean(errors.password)}
                onChange={(e) => {
                  setValues((v) => ({ ...v, password: e.target.value }));
                  setErrors((p) => ({ ...p, password: undefined }));
                }}
              />
            </AuthField>
          </>
        )}
        <Button type="submit" className="h-10 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {existing ? "Accept invitation" : "Create account and join"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default InvitePage;
