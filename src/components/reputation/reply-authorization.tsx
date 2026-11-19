import { useId, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, RotateCw, ShieldCheck } from "lucide-react";
import { getSessionSubject, subscribeToAccessToken } from "@/api";
import { ConfirmDialog, FormAlert } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/hooks/use-access";
import { formatDateTime } from "@/lib/datetime";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import {
  authorizedByText,
  consentText,
  replyAuthorizationBanner,
  replyAuthorizationDialog,
  replyAuthorizationError,
  withdrawCopy,
  type GrantMethod,
  type ReplyAuthorizationNames,
} from "@/lib/reviews/reply-authorization-copy";
import { setCachedReplyAuthorization } from "@/lib/reviews/review-cache";
import { REPLY_AUTHORIZATION_ANCHOR, REPLY_AUTHORIZATION_STATUS_ID } from "@/lib/reviews/review-spotlight";
import { useReplyAuthorization, useSetReplyAuthorization } from "@/lib/reviews/use-reply-authorization";
import { cn } from "@/lib/utils";

type LocationNames = {
  locationId: string;
  /** The location's name (in the consent text). */
  locationName: string;
  /** The location's client (agency), for the owner's attestation and "authorized by". */
  clientName?: string | null | undefined;
};

function useNames(locationName: string, clientName: string | null | undefined): ReplyAuthorizationNames {
  const { organization } = useWorkspace();
  return { agency: organization?.name, client: clientName, location: locationName };
}

/** 400 `reply_authorization_not_required` (a business organization): nothing to authorize, so the banner goes. */
function markNotRequired(queryClient: QueryClient, locationId: string) {
  setCachedReplyAuthorization(queryClient, locationId, (current) => (current ? { ...current, required: false } : null));
}

/**
 * Phase 25a, agency organizations: Google lets an agency reply to its client's reviews only with
 * the client's authorization. While it is missing, this banner (`#reply-authorization`) leads the
 * Reviews and AI Review Replies pages and every Send stays disabled. What it offers depends on who
 * is looking (`grant_method`):
 * - a client user of the location's client: "Allow <agency> to reply…" → the consent, "I agree";
 * - the agency owner: "Replies need your client's OK" → the attestation, "Record authorization";
 * - a member: who can give it, no button.
 * Business organizations never need it (nothing is shown).
 */
export function ReplyAuthorizationBanner({ locationId, locationName, clientName, className }: LocationNames & { className?: string }) {
  const { blocked, grantMethod } = useReplyAuthorization(locationId);
  const names = useNames(locationName, clientName);
  const titleId = useId();
  // The way it was opened stays while the dialog is open, even if the summary is read again meanwhile.
  const [dialog, setDialog] = useState<GrantMethod | null>(null);
  const copy = blocked ? replyAuthorizationBanner(grantMethod, names) : null;

  return (
    <>
      {copy ? (
        <section
          id={REPLY_AUTHORIZATION_ANCHOR}
          tabIndex={-1}
          aria-labelledby={titleId}
          className={cn(
            "flex scroll-mt-24 flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-warning/45 bg-warning-surface px-4 py-3 shadow-card outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-warning/20 text-warning-foreground">
            <ShieldCheck className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-[1_1_14rem]">
            <h2 id={titleId} className="text-sm font-semibold text-warning-foreground">
              {copy.title}
            </h2>
            <p className="text-sm text-foreground">{copy.body}</p>
          </div>
          {copy.action && grantMethod ? (
            <Button size="sm" className="shrink-0 max-sm:ml-13" onClick={() => setDialog(grantMethod)}>
              <ShieldCheck aria-hidden /> {copy.action}
            </Button>
          ) : null}
        </section>
      ) : null}
      {/* Beside the banner, not in it: the grant removes the banner, and the dialog still closes the
          usual way, handing focus to "Replies authorized by …". */}
      {dialog ? <GrantDialog locationId={locationId} method={dialog} names={names} onClose={() => setDialog(null)} /> : null}
    </>
  );
}

/** The consent (a client user) or the attestation (the owner), with the box to tick before it is recorded. */
function GrantDialog({ locationId, method, names, onClose }: { locationId: string; method: GrantMethod; names: ReplyAuthorizationNames; onClose: () => void }) {
  const queryClient = useQueryClient();
  const grant = useSetReplyAuthorization(locationId);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<{ message: string; reload: boolean } | null>(null);
  // Recorded: on close, focus goes to the new "Replies authorized by …" line (the banner and its button are gone).
  const granted = useRef(false);
  const checkboxId = useId();
  const copy = replyAuthorizationDialog(method, names);
  const pending = grant.isPending;

  const submit = async () => {
    if (!agreed || pending) return;
    setError(null);
    try {
      await grant.mutateAsync(true);
      granted.current = true;
      toast.success(copy.success, { description: copy.successDetail });
      onClose();
    } catch (err) {
      const mapped = replyAuthorizationError(err, true);
      if (mapped.kind === "not_required") {
        markNotRequired(queryClient, locationId);
        onClose();
        return;
      }
      setError({ message: mapped.message, reload: Boolean(mapped.reload) });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || pending ? undefined : onClose())}>
      <DialogContent
        className="sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          // Not recorded (cancelled, or nothing to authorize): back to what opened it, else the page heading.
          const status = granted.current ? document.getElementById(REPLY_AUTHORIZATION_STATUS_ID) : null;
          if (!status) return;
          event.preventDefault();
          status.focus({ preventScroll: true });
        }}
      >
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {/* The exact text recorded with its version (`consent_version`). */}
          <blockquote className="rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">{consentText(method, names)}</blockquote>
          <label htmlFor={checkboxId} className="-my-1 flex min-h-9 cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
            <Checkbox id={checkboxId} checked={agreed} disabled={pending} onCheckedChange={(value) => setAgreed(value === true)} />
            {copy.checkbox}
          </label>
          <p className="text-xs text-muted-foreground">{copy.note}</p>
          {error ? (
            <FormAlert tone="critical">
              <span>{error.message}</span>
              {error.reload ? (
                <Button type="button" variant="outline" size="sm" className="mt-2 flex bg-card" onClick={() => window.location.reload()}>
                  <RotateCw aria-hidden /> Reload
                </Button>
              ) : null}
            </FormAlert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!agreed || pending} aria-busy={pending || undefined}>
              {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <ShieldCheck aria-hidden />}
              {pending ? copy.pending : copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Once replies are authorized (agency organizations): a quiet line for the page header's facts,
 * "Replies authorized by Ana Diaz on Nov 13, 2026" (2026-11-17: the person's name, `user_name`; a client
 * user reads "your agency" for the agency's staff, whose names it doesn't get), with "Withdraw" for
 * whoever can (the client's users and the owner). Nothing in a business organization or before it's granted.
 */
export function ReplyAuthorizationStatus({ locationId, locationName, clientName }: LocationNames) {
  const { authorization, grantMethod } = useReplyAuthorization(locationId);
  const names = useNames(locationName, clientName);
  const me = useSyncExternalStore(subscribeToAccessToken, getSessionSubject, () => null);
  const clientUser = useAccess().role === "client_user";
  const queryClient = useQueryClient();
  const withdraw = useSetReplyAuthorization(locationId);
  const [confirming, setConfirming] = useState(false);
  if (!authorization?.required || !authorization.granted) return null;

  const text = authorizedByText(authorization, names, Boolean(me && authorization.user_id === me), clientUser);
  const confirm = grantMethod ? withdrawCopy(grantMethod, names) : null;

  const run = async () => {
    setConfirming(false);
    try {
      await withdraw.mutateAsync(false);
      toast.success("Authorization withdrawn", { description: "Replies can't be sent until it's given again." });
    } catch (err) {
      const mapped = replyAuthorizationError(err, false);
      if (mapped.kind === "not_required") {
        markNotRequired(queryClient, locationId);
        return;
      }
      toast.error(mapped.message, mapped.reload ? { action: { label: "Reload", onClick: () => window.location.reload() } } : undefined);
    }
  };

  return (
    // Focusable from script only: focus lands here once replies are authorized (the grant dialog closes on it).
    <div
      id={REPLY_AUTHORIZATION_STATUS_ID}
      tabIndex={-1}
      className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-sm text-xs text-muted-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-success" />
      <span title={authorization.at ? formatDateTime(authorization.at) : undefined}>{text}</span>
      {confirm ? (
        <>
          <span aria-hidden>·</span>
          {/* An inline link in a line of small print: the invisible hit area makes it about 40px tall. */}
          <Button
            variant="link"
            size="sm"
            disabled={withdraw.isPending}
            className="relative h-auto p-0 text-xs after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-['']"
            onClick={() => setConfirming(true)}
          >
            {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={confirm.title}
            description={confirm.description}
            confirmLabel="Withdraw"
            cancelLabel="Keep it"
            onConfirm={() => void run()}
          />
        </>
      ) : null}
    </div>
  );
}
