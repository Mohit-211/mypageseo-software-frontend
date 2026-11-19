import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BellRing, LinkIcon, Loader2, MailCheck, MailX, Undo2 } from "lucide-react";
import { AuthFooterNote, AuthFormError, AuthLayout, AuthLink, AuthStatePanel } from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { hasUsableSession, isApiError, optOutOfPostsDigest, setWeeklyReplyEmailOptOut } from "@/api";
import { rateLimitMessage } from "@/lib/auth/auth-recovery";
import { getPostLoginPath } from "@/lib/auth/auth-session";

/** The two emails this page can stop (`?list=`). */
type EmailList = "auto-replies" | "ai-digest";

const LISTS: readonly EmailList[] = ["auto-replies", "ai-digest"];

/** What the reader asked for, and where it stands. */
type Outcome =
  /** Not yet: the page asks for the one click. */
  | { kind: "ask" }
  /** Stopped (`organizationName`: the weekly email's organization, null for the digest). */
  | { kind: "stopped"; organizationName: string | null }
  /** The weekly email's Undo went through: it comes again. */
  | { kind: "restored"; organizationName: string | null };

/** A failed click: the link is broken (shown instead of the page), or it can be tried again (shown under the button). */
type Problem = { kind: "broken" } | { kind: "retry"; message: string };

const COPY: Record<EmailList, { title: string; description: string; settings: boolean }> = {
  "auto-replies": {
    title: "Stop the weekly automatic replies email?",
    // Only the Undo right after stopping turns it back on (the token's `opt_out: false`): the app has no setting for it.
    description:
      "It sums up the replies MyPageSEO sent to your Google reviews by itself, and the reviews waiting for you. If you change your mind, you can undo it right after.",
    settings: false,
  },
  "ai-digest": {
    title: "Stop the daily review email?",
    description:
      "It tells you each morning about AI posts and AI reply drafts waiting for your review. This stops it for every organization you belong to.",
    settings: true,
  },
};

function problemFrom(error: unknown): Problem {
  // 429 `rate_limited` (30 a quarter of an hour per network, both emails together): later.
  const limited = rateLimitMessage(error);
  if (limited) return { kind: "retry", message: limited };
  // 400 `invalid_token` / `invalid_input`: the token is missing, cut or changed. Any other refusal can't be fixed
  // from here either.
  if (isApiError(error) && error.status >= 400 && error.status < 500) return { kind: "broken" };
  return { kind: "retry", message: "That didn't work. Check your connection, then try again." };
}

/**
 * `/email/opt-out?list=auto-replies|ai-digest&token=…`: the link at the bottom of the weekly automatic-replies
 * email and of the AI review digest (2026-11-17 entry, section 6). Public, outside the app (no sign-in), in the
 * sign-in pages' look.
 *
 * Nothing is sent when the page opens, because email scanners open every link in an email: the reader confirms
 * with one click.
 * - `auto-replies`: `POST /public/reviews/weekly-email/opt-out { token }` → "You won't get these weekly emails for
 *   <organization> any more", with an Undo (`opt_out: false`).
 * - `ai-digest`: `POST /posts/digest/opt-out { token }`, for every organization; it can be switched back on in
 *   Settings › Notifications.
 * - 400 `invalid_token` / `invalid_input`, a missing token or an unknown `list`: "This link doesn't work any
 *   more". 429 `rate_limited`: try again later.
 */
function EmailOptOutPage() {
  const [params] = useSearchParams();
  // Read once: the address is the email's link and nothing on the page changes it.
  const [link] = useState(() => {
    const list = params.get("list");
    const token = params.get("token")?.trim() ?? "";
    return { list: LISTS.find((entry) => entry === list) ?? null, token };
  });
  const [outcome, setOutcome] = useState<Outcome>({ kind: "ask" });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);

  const signedIn = hasUsableSession();
  const home = signedIn ? getPostLoginPath(null) : "/login";
  const footer = (
    <AuthFooterNote>
      <AuthLink to={home}>{signedIn ? "Go to MyPageSEO" : "Sign in to MyPageSEO"}</AuthLink>
    </AuthFooterNote>
  );

  if (!link.list || !link.token || problem?.kind === "broken") {
    return (
      <AuthLayout title="Email preferences">
        <AuthStatePanel
          tone="critical"
          icon={<LinkIcon />}
          title="This link doesn't work any more"
          description="It may have been cut short or changed on the way. Open the link at the bottom of the newest email instead."
        />
        {footer}
      </AuthLayout>
    );
  }

  const list = link.list;
  const copy = COPY[list];

  /** Stops the email (`stop`), or, for the weekly email, turns it back on (Undo). */
  const send = async (stop: boolean) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      if (list === "auto-replies") {
        const result = await setWeeklyReplyEmailOptOut(link.token, stop);
        const organizationName = result.organization_name?.trim() || null;
        setOutcome(result.opted_out ? { kind: "stopped", organizationName } : { kind: "restored", organizationName });
      } else {
        await optOutOfPostsDigest(link.token);
        setOutcome({ kind: "stopped", organizationName: null });
      }
    } catch (error) {
      setProblem(problemFrom(error));
    } finally {
      setBusy(false);
    }
  };

  const retryError = problem?.kind === "retry" ? <AuthFormError message={problem.message} /> : null;

  if (outcome.kind === "stopped") {
    const weekly = list === "auto-replies";
    return (
      <AuthLayout title="Email preferences">
        <AuthStatePanel
          tone="success"
          icon={<MailCheck />}
          title={
            weekly
              ? `You won't get these weekly emails${outcome.organizationName ? ` for ${outcome.organizationName}` : ""} any more`
              : "You won't get the daily review email any more"
          }
          description={weekly ? "Changed your mind? You can undo it now." : "You can switch it back on in your settings."}
        >
          {retryError}
          {weekly ? (
            <Button type="button" variant="outline" size="lg" className="w-full" disabled={busy} aria-busy={busy || undefined} onClick={() => void send(false)}>
              {busy ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Undo2 aria-hidden />}
              Undo
            </Button>
          ) : (
            <Button asChild variant="outline" size="lg" className="w-full">
              {/* Signed out, the sign-in page brings the reader back here afterwards. */}
              <Link to="/settings/notifications">Open notification settings</Link>
            </Button>
          )}
        </AuthStatePanel>
        {footer}
      </AuthLayout>
    );
  }

  if (outcome.kind === "restored") {
    return (
      <AuthLayout title="Email preferences">
        <AuthStatePanel
          tone="info"
          icon={<BellRing />}
          title="The weekly emails are back on"
          description={`You'll get the weekly automatic replies email${outcome.organizationName ? ` for ${outcome.organizationName}` : ""} again.`}
        >
          {retryError}
          <Button type="button" variant="outline" size="lg" className="w-full" disabled={busy} aria-busy={busy || undefined} onClick={() => void send(true)}>
            {busy ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : <MailX aria-hidden />}
            Stop them after all
          </Button>
        </AuthStatePanel>
        {footer}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Email preferences">
      <AuthStatePanel icon={<MailX />} title={copy.title} description={copy.description}>
        {retryError}
        <Button type="button" size="lg" className="w-full" disabled={busy} aria-busy={busy || undefined} onClick={() => void send(true)}>
          {busy ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : null}
          {busy ? "Stopping these emails…" : "Stop these emails"}
        </Button>
        {copy.settings ? <p className="text-center text-xs text-muted-foreground">You can switch it back on in Settings › Notifications.</p> : null}
      </AuthStatePanel>
      {footer}
    </AuthLayout>
  );
}

export default EmailOptOutPage;
