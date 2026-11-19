import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import type { AutoReplySettings } from "@/api";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useAccess } from "@/hooks/use-access";
import {
  autoReplyAgreedText,
  autoReplyErrorText,
  canChangeAutoReply,
  canConsentAutoReply,
  canResume,
  capMaxOf,
  consentDialogCopy,
  pauseCopy,
  scopeChanged,
  scopeOf,
  scopeText,
  scopeUpdate,
  weekText,
  whoCanConsentText,
  widens,
  wideningParts,
  withFourStars,
  type AutoReplyErrorAction,
  type AutoReplyScope,
} from "@/lib/ai-settings/auto-reply";
import { useUpdateAutoReply } from "@/lib/ai-settings/use-auto-reply";
import { useOptionalLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useViewerUserId } from "@/lib/posts/ai-runs";
import { REPLY_AUTHORIZATION_ANCHOR } from "@/lib/reviews/review-spotlight";
import { cn } from "@/lib/utils";

type ErrorState = { text: string; action: AutoReplyErrorAction | null };

/**
 * "Automatic replies" (`#auto-replies`, Phase 25b): new 5★ reviews (and positive 4★ ones, if chosen) get a reply on
 * Google without anyone pressing Send, 30 minutes to 3 hours after they arrive, between 8 am and 8 pm. The page shows
 * this card only while the server's `feature` is `on`.
 *
 * - Switching on, or widening (4★, stars-only reviews, a higher daily cap), shows the consent text for the caller's
 *   `consent_method` and sends its `consent_version`; a member can't ("Ask the account owner or your client"), and an
 *   agency needs the client's reply authorization first (a link to the Reviews page's banner).
 * - Switching off, narrowing and pausing need no consent: owners and members, and a client user of the location's
 *   client (who sees the off switch too). Pauses show why and who may resume them; MyPageSEO's can't be lifted here.
 */
export function AutoRepliesCard({ locationId, view, isAgency }: { locationId: string; view: AutoReplySettings; isAgency: boolean }) {
  const { role } = useAccess();
  const isClientUser = role === "client_user";
  const viewerId = useViewerUserId();
  const clientName = useOptionalLocationRoute()?.location.client?.name ?? null;
  const update = useUpdateAutoReply(locationId);
  const ids = useId();
  const current = scopeOf(view);
  const capMax = capMaxOf(view);
  const canChange = canChangeAutoReply(view, role);
  const canConsent = canConsentAutoReply(view);
  const blocker = !view.gbp_connected
    ? { text: "Connect this location to its Google Business Profile to switch automatic replies on.", authorization: false }
    : view.reply_authorization_required
      ? { text: "Your client's authorization to reply comes first. Once it's recorded, automatic replies can be switched on.", authorization: true }
      : null;
  const canSwitchOn = canChange && canConsent && !blocker;

  // The user's changes on top of what is in force (a refetch never drops them).
  const [draft, setDraft] = useState<AutoReplyScope | null>(null);
  const [capText, setCapText] = useState<string | null>(null);
  const [consentFor, setConsentFor] = useState<AutoReplyScope | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [askResume, setAskResume] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const shown: AutoReplyScope = { ...(draft ?? current), enabled: current.enabled };
  const capValue = capText ?? String(shown.daily_cap);
  const capNumber = Number(capValue.trim());
  const capValid = /^\d+$/.test(capValue.trim()) && capNumber >= 1 && capNumber <= capMax;
  const next: AutoReplyScope = { ...shown, daily_cap: capValid ? capNumber : shown.daily_cap };
  const dirty = current.enabled && (scopeChanged(current, next) || (capText !== null && !capValid));
  const widening = widens(current, next);
  const pending = update.isPending;
  const paused = view.paused;

  const reset = () => {
    setDraft(null);
    setCapText(null);
  };

  const edit = (patch: Partial<AutoReplyScope>) => {
    setDraft({ ...shown, ...patch });
    setError(null);
  };

  /** Sends a change; a widening (or switching on) asks for the consent first. */
  const apply = (target: AutoReplyScope, options: { consent?: boolean; success: string }) => {
    const needsConsent = widens(current, target);
    if (needsConsent && !options.consent) {
      setAgreed(false);
      setDialogError(null);
      setConsentFor(target);
      return;
    }
    setError(null);
    setDialogError(null);
    update.mutate(scopeUpdate(current, target, needsConsent ? view.consent_version : null), {
      onSuccess: () => {
        reset();
        setConsentFor(null);
        toast.success(options.success);
      },
      onError: (err) => {
        const copy = autoReplyErrorText(err, isAgency);
        if (consentFor) {
          setDialogError(copy.text);
          if (copy.action === "reload") setAgreed(false);
        } else {
          setError(copy);
        }
      },
    });
  };

  const switchOn = () => apply({ ...next, enabled: true }, { success: "Automatic replies are on. New reviews that qualify get a reply within a few hours." });
  const switchOff = () =>
    apply({ ...current, enabled: false }, { success: "Automatic replies are off. New reviews wait for you. Switching them on again needs a new agreement." });
  const saveScope = () => apply({ ...next, enabled: true }, { success: "Automatic replies saved." });

  const setPaused = (value: boolean) => {
    setError(null);
    update.mutate(
      { paused: value },
      {
        onSuccess: () => {
          setAskResume(false);
          toast.success(value ? "Automatic replies are paused. New reviews wait for you." : "Automatic replies are back on.");
        },
        onError: (err) => {
          setAskResume(false);
          setError(autoReplyErrorText(err, isAgency));
        },
      },
    );
  };

  const consentLine = autoReplyAgreedText(view.consent, { userId: viewerId, clientUser: isClientUser }, clientName);
  const pause = paused ? pauseCopy(paused) : null;
  const status = !current.enabled ? { label: "Off", tone: "neutral" as const } : paused ? { label: "Paused", tone: "warning" as const } : { label: "On", tone: "success" as const };
  const copy = consentFor && view.consent_method ? consentDialogCopy(view.consent_method, current.enabled) : null;
  const added = consentFor ? wideningParts(current, consentFor) : [];
  // While off, the scope can be chosen only by someone who can then switch them on.
  const editable = canChange && !pending && (current.enabled || canSwitchOn);
  const scopeEditable = canChange && (current.enabled || canSwitchOn);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-strong px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span id={`${ids}-state`} className="text-sm font-medium text-foreground">
              Reply automatically
            </span>
            <StatusBadge tone={status.tone} size="sm" dot>
              {status.label}
            </StatusBadge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {current.enabled ? `${scopeText(current)}.` : "New reviews wait for a person, as now."}
            {consentLine ? ` ${consentLine}` : ""}
          </p>
        </div>
        {current.enabled && canChange ? (
          <div className="flex items-center gap-2">
            {pending && !consentFor ? <Loader2 aria-label="Saving" className="size-4 animate-spin text-muted-foreground" /> : null}
            <Switch checked aria-labelledby={`${ids}-state`} disabled={pending} onCheckedChange={(value) => (value ? undefined : switchOff())} />
          </div>
        ) : null}
      </div>

      {pause ? (
        <FormAlert tone={pause.tone === "critical" ? "critical" : pause.tone === "warning" ? "warning" : "info"} title={pause.title}>
          <p>{pause.detail}</p>
          {canResume(view, role) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={pending}
              onClick={() => (paused?.resume === "consent" ? setAskResume(true) : setPaused(false))}
            >
              <PlayCircle aria-hidden /> Resume
            </Button>
          ) : paused?.resume === "admin" ? (
            <p className="mt-1">
              <Link to="/support" className="font-medium text-primary underline-offset-2 hover:underline">
                Contact support
              </Link>{" "}
              to find out more.
            </p>
          ) : paused?.resume === "consent" ? (
            <p className="mt-1">{isAgency ? "Only your client or the account owner can resume them." : "Only the account owner can resume them."}</p>
          ) : null}
        </FormAlert>
      ) : null}

      <fieldset disabled={!editable} className="grid gap-4 rounded-lg border border-border p-3.5 md:grid-cols-3">
        <legend className="sr-only">What automatic replies answer</legend>
        <div className="min-w-0">
          <p id={`${ids}-ratings`} className="text-sm font-medium text-foreground">
            Ratings
          </p>
          <div className="mt-2">
            {scopeEditable ? (
              <SegmentedControl<"5" | "45">
                aria-label="Ratings answered automatically"
                value={withFourStars(shown.ratings) ? "45" : "5"}
                onValueChange={(value) => edit({ ratings: value === "45" ? [4, 5] : [5] })}
                options={[
                  { value: "5", label: "5★ only" },
                  { value: "45", label: "4★ and 5★" },
                ]}
              />
            ) : (
              <p className="text-sm text-foreground">{withFourStars(shown.ratings) ? "4★ and 5★" : "5★ only"}</p>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">A 4★ review with a “but” always waits for a person.</p>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`${ids}-stars`} className="text-sm font-medium text-foreground">
              Stars-only reviews
            </label>
            <Switch id={`${ids}-stars`} checked={shown.stars_only} disabled={!editable} onCheckedChange={(value) => edit({ stars_only: value })} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">Also reply to reviews that have stars and no text.</p>
        </div>

        <div className="min-w-0">
          <label htmlFor={`${ids}-cap`} className="text-sm font-medium text-foreground">
            At most a day
          </label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id={`${ids}-cap`}
              type="number"
              inputMode="numeric"
              min={1}
              max={capMax}
              step={1}
              className="w-24"
              value={capValue}
              readOnly={!scopeEditable}
              aria-invalid={capText !== null && !capValid ? true : undefined}
              aria-describedby={`${ids}-cap-hint`}
              onChange={(event) => {
                setCapText(event.target.value);
                setError(null);
              }}
            />
            <span className="text-sm text-muted-foreground">replies</span>
          </div>
          <p id={`${ids}-cap-hint`} className={cn("mt-1.5 text-xs", capText !== null && !capValid ? "font-medium text-critical" : "text-muted-foreground")}>
            {capText !== null && !capValid ? `Use a whole number from 1 to ${capMax}.` : `1 to ${capMax}. Any more wait for a person.`}
          </p>
        </div>
      </fieldset>

      {error ? (
        <FormAlert tone={error.action === "reload" ? "warning" : "critical"}>
          {error.text} <ErrorActionLink action={error.action} locationId={locationId} isClientUser={isClientUser} />
        </FormAlert>
      ) : null}

      {!current.enabled ? (
        canSwitchOn ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={switchOn} disabled={pending || !capValid}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Switch on…
            </Button>
            <span className="text-xs text-muted-foreground">You'll see what you agree to first.</span>
          </div>
        ) : blocker ? (
          <FormAlert tone="info">
            {blocker.text}{" "}
            {blocker.authorization ? (
              <Link
                to={locationPath(locationId, "reputation", `#${REPLY_AUTHORIZATION_ANCHOR}`)}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Go to the authorization
              </Link>
            ) : null}
          </FormAlert>
        ) : canChange || !isClientUser ? (
          <FormAlert tone="info">{whoCanConsentText(isAgency)}</FormAlert>
        ) : null
      ) : canChange ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={saveScope} disabled={!dirty || !capValid || pending || (widening && !canConsent)}>
            {pending && dirty ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {widening ? "Save…" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={reset} disabled={!dirty || pending}>
            Discard
          </Button>
          {!paused ? (
            <Button type="button" variant="ghost" onClick={() => setPaused(true)} disabled={pending} className="sm:ml-auto">
              <PauseCircle aria-hidden /> Pause
            </Button>
          ) : null}
          {widening && !canConsent ? <p className="basis-full text-xs text-muted-foreground">{whoCanConsentText(isAgency)}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-border pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">This week:</span> {weekText(view)}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to={locationPath(locationId, "reputation", "?reply=sent")} className="inline-flex min-h-9 items-center font-medium text-primary underline-offset-2 hover:underline">
            See the replies
          </Link>
          {view.held_7d > 0 ? (
            <Link to={locationPath(locationId, "reputation", "?reply=needs")} className="inline-flex min-h-9 items-center font-medium text-primary underline-offset-2 hover:underline">
              Answer the reviews waiting
            </Link>
          ) : null}
        </div>
      </div>

      <AlertDialog open={consentFor !== null} onOpenChange={(open) => (open || pending ? undefined : setConsentFor(null))}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title ?? "Switch on automatic replies?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {consentFor ? `${scopeText(consentFor)}.` : ""}
              {added.length ? ` This adds ${added.join(", ")}.` : ""} Replies go out without anyone pressing Send.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <blockquote className="rounded-lg border border-border bg-surface-strong px-3.5 py-3 text-sm text-foreground">{view.consent_text}</blockquote>
          <div className="flex items-start gap-3">
            <Checkbox id={`${ids}-agree`} checked={agreed} disabled={pending} onCheckedChange={(value) => setAgreed(value === true)} className="mt-0.5" />
            <label htmlFor={`${ids}-agree`} className="cursor-pointer text-sm font-medium text-foreground">
              {copy?.checkbox ?? "I agree"}
            </label>
          </div>
          {dialogError ? <FormAlert>{dialogError}</FormAlert> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={!agreed || pending}
              aria-busy={pending || undefined}
              onClick={() => (consentFor ? apply(consentFor, { consent: true, success: current.enabled ? "Automatic replies saved." : "Automatic replies are on. New reviews that qualify get a reply within a few hours." }) : undefined)}
            >
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {copy?.confirm ?? "I agree, switch on"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={askResume} onOpenChange={(open) => (open || pending ? undefined : setAskResume(false))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume automatic replies?</AlertDialogTitle>
            <AlertDialogDescription>
              {pause?.detail ? `${pause.detail} ` : ""}Check your settings and recent replies first: new reviews that qualify will get a reply on Google again
              without anyone pressing Send.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep them paused</AlertDialogCancel>
            <Button type="button" disabled={pending} aria-busy={pending || undefined} onClick={() => setPaused(false)}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Resume
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** The way forward for an error: the Reviews page's authorization banner, billing, support. */
function ErrorActionLink({ action, locationId, isClientUser }: { action: AutoReplyErrorAction | null; locationId: string; isClientUser: boolean }) {
  const linkClass = "inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline";
  if (action === "authorization") {
    return (
      <Link to={locationPath(locationId, "reputation", `#${REPLY_AUTHORIZATION_ANCHOR}`)} className={linkClass}>
        Go to the authorization
      </Link>
    );
  }
  if (action === "billing" && !isClientUser) {
    return (
      <Link to="/settings/billing" className={linkClass}>
        Open billing
      </Link>
    );
  }
  if (action === "support") {
    return (
      <Link to="/support" className={linkClass}>
        Contact support
      </Link>
    );
  }
  return null;
}
