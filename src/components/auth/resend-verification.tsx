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
    if (sending) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      document.getElementById("resend-email")?.focus();
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
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-success/25 bg-success-surface p-3.5 text-sm text-foreground"
      >
        <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
        <span>
          If {email.trim() || "that address"} is waiting for verification, a new link is on its way. Only the newest link
          works.
        </span>
      </p>
    );
  }

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {knownEmail ? null : (
        <AuthField label="Email" htmlFor="resend-email" error={fieldError}>
          <AuthInput
            id="resend-email"
            type="email"
            autoComplete="email"
            inputMode="email"
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
      {error ? (
        <p role="alert" className="text-xs font-medium text-critical">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant={knownEmail ? "outline" : "default"}
        size={knownEmail ? "default" : "lg"}
        className={knownEmail ? "h-10 w-full" : "w-full"}
        disabled={sending}
        aria-busy={sending || undefined}
      >
        {sending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Send a new link
      </Button>
    </form>
  );
}
