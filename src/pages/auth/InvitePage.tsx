import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, Info, Loader2, LinkIcon, TimerOff } from "lucide-react";
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
import {
  acceptInvitation,
  getProfile,
  hasUsableSession,
  inspectInvitation,
  isApiError,
  logout,
  subscribeToAccessToken,
  type InvitationInfo,
} from "@/api";
import { GENERIC_AUTH_ERROR, passwordSchema, rateLimitMessage } from "@/lib/auth/auth-recovery";
import { useWorkspace } from "@/lib/mypageseo/workspace";
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

const FIELD_IDS = { name: "invite-name", password: "invite-password" } as const;

/** Router state for /login after joining with an existing account: the email to fill in and the organization to open. */
type JoinedLoginState = { email: string; organizationId: string };

/** After an existing account joined: what this browser's session lets the user do next. */
type Joined =
  /** Signed out: sign in as the invited email, straight into the organization. */
  | { kind: "sign_in"; organizationId: string }
  /** Signed in as the invited email: the organization is open in this tab now. */
  | { kind: "open" }
  /** Signed in as someone else (or we couldn't tell who): switch accounts first. */
  | { kind: "switch"; organizationId: string; signedInAs: string | null };

function sameEmail(a: string | null | undefined, b: string): boolean {
  return typeof a === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
}

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
        <AuthStatePanel icon={<Loader2 className="animate-spin" />} title="Opening your invitation" description="One moment…" />
      </AuthLayout>
    );
  }
  if (state.kind === "unknown" || state.kind === "closed" || state.kind === "failed") {
    const copy =
      state.kind === "closed"
        ? state.reason === "accepted"
          ? { title: "This invitation was already accepted", description: "Sign in to open the organization." }
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
          icon={state.kind === "closed" ? <TimerOff /> : state.kind === "failed" ? <AlertTriangle /> : <LinkIcon />}
          title={copy.title}
          description={copy.description}
        >
          <Button asChild size="lg" className="w-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </AuthStatePanel>
      </AuthLayout>
    );
  }

  return (
    <AcceptInvitation
      token={token!}
      invitation={state.invitation}
      onAccepted={(path, state) => void navigate(path, { replace: true, ...(state ? { state } : {}) })}
    />
  );
}

function AcceptInvitation({
  token,
  invitation,
  onAccepted,
}: {
  token: string;
  invitation: InvitationInfo;
  onAccepted: (path: string, state?: JoinedLoginState) => void;
}) {
  const queryClient = useQueryClient();
  const workspace = useWorkspace();
  const signedIn = useSyncExternalStore(subscribeToAccessToken, hasUsableSession, () => false);
  // Who this browser is signed in as (shared with the workspace's profile query, usually loaded).
  const profile = useQuery({ queryKey: ["profile"], queryFn: ({ signal }) => getProfile(signal), enabled: signedIn, staleTime: 5 * 60_000 });
  const [values, setValues] = useState({ name: "", password: "" });
  const [errors, setErrors] = useState<{ name?: string | undefined; password?: string | undefined }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [switching, setSwitching] = useState(false);
  const existing = invitation.account_exists;
  const role = ROLE_LABEL[invitation.role] ?? invitation.role;
  const organizationName = invitation.organization.name;
  const signedInEmail = signedIn ? (profile.data?.email ?? null) : null;

  /**
   * An existing account was added to the organization. A session in this browser doesn't know
   * yet: re-read the profile (which lists the new organization), then open it here if the session
   * is the invited account's. The organization is picked only after that read, or the workspace
   * would drop it as one the user isn't a member of.
   */
  const afterJoin = async (organizationId: string): Promise<Joined> => {
    if (!hasUsableSession()) return { kind: "sign_in", organizationId };
    try {
      const me = await queryClient.fetchQuery({ queryKey: ["profile"], queryFn: ({ signal }) => getProfile(signal), staleTime: 0 });
      if (!sameEmail(me.email, invitation.email)) return { kind: "switch", organizationId, signedInAs: me.email ?? null };
      if (me.organizations?.some((org) => org.organization_id === organizationId)) workspace.setOrganizationId(organizationId);
      return { kind: "open" };
    } catch {
      return { kind: "switch", organizationId, signedInAs: null };
    }
  };

  /** Signed in as someone else: sign out here, then sign in as the invited email into the organization. */
  const switchAccount = async (organizationId: string) => {
    if (switching) return;
    setSwitching(true);
    try {
      await logout();
    } finally {
      queryClient.clear();
      onAccepted("/login", { email: invitation.email, organizationId });
    }
  };

  const showErrors = (next: typeof errors) => {
    setErrors(next);
    const first = (["name", "password"] as const).find((key) => next[key]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  };

  const accept = async () => {
    if (submitting) return;
    let body: { token: string; name?: string; password?: string } = { token };
    if (!existing) {
      const parsed = newAccountSchema.safeParse(values);
      if (!parsed.success) {
        const next: typeof errors = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as "name" | "password";
          if (key && !next[key]) next[key] = issue.message;
        }
        showErrors(next);
        return;
      }
      body = { token, ...parsed.data };
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await acceptInvitation(body);
      if (result.login_required) setJoined(await afterJoin(result.organization_id));
      // Signed in (and kept signed in): straight into the organization.
      else onAccepted("/dashboard");
    } catch (error) {
      if (isApiError(error) && error.status === 410) setFormError("This invitation is no longer open. Ask for a new one.");
      else if (isApiError(error) && error.reason === "account_details_required") setFormError("Enter your name and a password to create your account.");
      else if (isApiError(error) && error.status === 400 && /password/i.test(error.message)) showErrors({ password: error.message });
      else setFormError(rateLimitMessage(error) ?? GENERIC_AUTH_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  if (joined) {
    return (
      <AuthLayout>
        {joined.kind === "open" ? (
          <AuthStatePanel
            tone="success"
            icon={<Building2 />}
            title={`You've joined ${organizationName}`}
            description="It's ready for you in MyPageSEO. Switch between your organizations any time from the organization menu."
          >
            <Button size="lg" className="h-auto min-h-11 w-full whitespace-normal py-2.5" onClick={() => onAccepted("/dashboard")}>
              Open {organizationName}
            </Button>
          </AuthStatePanel>
        ) : joined.kind === "switch" ? (
          <AuthStatePanel
            tone="success"
            icon={<Building2 />}
            title={`You've joined ${organizationName}`}
            description={
              <>
                {joined.signedInAs ? (
                  <>
                    You're signed in as <span className="font-medium break-all text-foreground">{joined.signedInAs}</span>.{" "}
                  </>
                ) : (
                  "This browser is signed in to another account. "
                )}
                The invitation is for <span className="font-medium break-all text-foreground">{invitation.email}</span>: sign in with it to
                open {organizationName}.
              </>
            }
          >
            <Button
              size="lg"
              className="h-auto min-h-11 w-full whitespace-normal py-2.5 [overflow-wrap:anywhere]"
              disabled={switching}
              aria-busy={switching || undefined}
              onClick={() => void switchAccount(joined.organizationId)}
            >
              {switching ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Sign out and continue as {invitation.email}
            </Button>
          </AuthStatePanel>
        ) : (
          <AuthStatePanel
            tone="success"
            icon={<Building2 />}
            title={`You've joined ${organizationName}`}
            description="Sign in with your existing account to open it."
          >
            <Button
              size="lg"
              className="w-full"
              onClick={() => onAccepted("/login", { email: invitation.email, organizationId: joined.organizationId })}
            >
              Sign in
            </Button>
          </AuthStatePanel>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading
        title={`Join ${invitation.organization.name}`}
        description={
          existing
            ? "Accept the invitation to add this organization to your MyPageSEO account."
            : "Create your MyPageSEO account to accept the invitation."
        }
      />
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-surface-strong p-3.5">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-tint text-primary">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold text-foreground">{invitation.organization.name}</p>
          {/* The full address, never cut off: it's how people check the invitation is theirs. */}
          <p className="break-words text-muted-foreground">
            {role} · {invitation.email}
          </p>
        </div>
      </div>
      {/* Signed in as someone else: say what accepting does to that session before it happens. */}
      {signedIn && (!existing || (signedInEmail && !sameEmail(signedInEmail, invitation.email))) ? (
        <div role="note" className="mb-5 flex items-start gap-2.5 rounded-lg border border-info/25 bg-info-surface px-3.5 py-3 text-sm text-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
          <p className="min-w-0">
            {signedInEmail ? (
              <>
                You're signed in as <span className="font-medium break-all">{signedInEmail}</span>.{" "}
                {existing ? (
                  <>
                    After accepting, sign in as <span className="font-medium break-all">{invitation.email}</span> to open {organizationName}.
                  </>
                ) : (
                  <>
                    Creating this account signs <span className="font-medium break-all">{signedInEmail}</span> out in this browser.
                  </>
                )}
              </>
            ) : (
              "You're signed in with another account. Creating this account signs it out in this browser."
            )}
          </p>
        </div>
      ) : null}
      <form
        noValidate
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void accept();
        }}
      >
        {formError ? <AuthFormError message={formError} /> : null}
        {existing ? (
          <p className="text-sm leading-6 text-muted-foreground">
            You already have a MyPageSEO account with this email. Accept to add this organization to it, then sign in.
          </p>
        ) : (
          <>
            <AuthField required label="Full name" htmlFor={FIELD_IDS.name} error={errors.name}>
              <AuthInput
                id={FIELD_IDS.name}
                autoComplete="name"
                placeholder="Your name"
                required
                value={values.name}
                invalid={Boolean(errors.name)}
                onChange={(e) => {
                  setValues((v) => ({ ...v, name: e.target.value }));
                  setErrors((p) => ({ ...p, name: undefined }));
                }}
              />
            </AuthField>
            <AuthField
              required
              label="Password"
              htmlFor={FIELD_IDS.password}
              error={errors.password}
              hint="At least 8 characters, including a letter and a number."
            >
              <AuthPasswordInput
                id={FIELD_IDS.password}
                autoComplete="new-password"
                placeholder="Create a password"
                required
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
        <Button type="submit" size="lg" className="w-full" disabled={submitting} aria-busy={submitting || undefined}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {existing ? "Accept invitation" : "Create account and join"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default InvitePage;
