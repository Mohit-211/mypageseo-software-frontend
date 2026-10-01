import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { resendVerification } from "@/api";
import { AuthField, AuthInput } from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { GENERIC_AUTH_ERROR, emailSchema, rateLimitMessage } from "@/lib/auth/auth-recovery";

/**
 * "Send a new link" for email verification. Asks for the email when it isn't known.
 * The backend answers the same for every email, so the confirmation never says
 * whether an account exists.
 */
export function ResendVerification({ email: knownEmail }: { email?: string | null }) {
  const [email, setEmail] = useState(knownEmail ?? "");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await resendVerification(parsed.data);
      setSent(true);
    } catch (err) {
      setError(rateLimitMessage(err) ?? GENERIC_AUTH_ERROR);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-md border border-border bg-secondary p-3 text-sm text-foreground">
        <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        If {email.trim() || "that address"} is waiting for verification, a new link is on its way. Only the newest link works.
      </p>
    );
  }

  return (
    <form
      noValidate
      className="space-y-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {knownEmail ? null : (
        <AuthField label="Email address" htmlFor="resend-email" error={fieldError}>
          <AuthInput
            id="resend-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            invalid={Boolean(fieldError)}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldError(undefined);
            }}
          />
        </AuthField>
      )}
      {error ? <p role="alert" className="text-xs font-medium text-critical">{error}</p> : null}
      <Button type="submit" variant={knownEmail ? "outline" : "default"} className="w-full" disabled={sending}>
        {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Send a new link
      </Button>
    </form>
  );
}
