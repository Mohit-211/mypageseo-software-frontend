/**
 * An agency client's approval of a series' automatic publishing (Phase 25c; Google's Business Profile API policy, as
 * for the reply authorization of 25a). In an agency organization a series in `publish_mode: auto` publishes its posts
 * without a person only once the location's client approved it: given by a client user of that client (their own
 * consent, `grant_method: client`) or recorded by the agency owner, who attests that the client agreed
 * (`owner_attestation`). A member can't (`grant_method: null`); a Business organization needs none (`required: false`).
 * Until it is given, the series' automatic posts wait for review (`approval.held: client_consent_required`).
 *
 * The consent text is the app's own (the server sends none): `PUT …/post-series/:id/auto-consent { granted: true,
 * consent_version }` records `SERIES_AUTO_CONSENT_VERSION`, so `autoConsentText` must keep its wording for that
 * version; a new wording needs a new version. `{ granted: false }` withdraws it (scheduled automatic posts go back to
 * review). It is void once the location's client changes.
 *
 * Errors: 400 `auto_consent_not_required` (a Business organization), 403 `client_or_owner_only` (a member), 409
 * `client_changed` (reload), 404 `series_not_found`. Backend: docs/API.md "Auto-posts (series)"; CUSTOMER_APP.md
 * 2026-11-16 "The review queue, approvals with reasons, series publish modes" item 4.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isApiError, setSeriesAutoConsent, type PostSeries, type SeriesAutoConsent } from "@/api";
import { byActor, grantRole, isViewer } from "@/lib/ai-settings/names";
import { formatDate } from "@/lib/datetime";
import { ORGANIZATION_POSTS_KEY } from "./ai-runs";
import { seriesPublishMode } from "./series-form";
import { postsKey } from "./use-posts";

/** The version of the consent and attestation texts below (1–40 characters, recorded with the approval). */
export const SERIES_AUTO_CONSENT_VERSION = "2026-11-18";

/** How the signed-in user can give or withdraw the approval. */
export type AutoConsentGrantMethod = NonNullable<SeriesAutoConsent["grant_method"]>;

export type AutoConsentNames = {
  /** The agency (the organization's name). */
  agency: string | null | undefined;
  /** The location's client. */
  client: string | null | undefined;
  location: string;
  series: string;
};

const clean = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text ? text : null;
};

const agencyName = (names: AutoConsentNames) => clean(names.agency) ?? "our agency";
const clientName = (names: AutoConsentNames) => clean(names.client) ?? "our client";

/**
 * What a series card shows of the approval: `ask` (it's needed and missing: the series publishes on its own and
 * automatic publishing is switched on), `granted` (shown whatever the mode, so it can always be withdrawn), or
 * `none` (a Business organization, an older server, a review-mode series, or automatic publishing not switched on).
 */
export function autoConsentState(series: Pick<PostSeries, "auto_publish" | "publish_mode">): "ask" | "granted" | "none" {
  const consent = series.auto_publish?.consent;
  if (!consent?.required) return "none";
  if (consent.granted) return "granted";
  return seriesPublishMode(series) === "auto" && series.auto_publish?.switch === "on" ? "ask" : "none";
}

/**
 * The text the user agrees to, version 2026-11-18 (fixed wording: it is what `consent_version` records).
 * - `client`: a client user of the location's client gives the client's consent;
 * - `owner_attestation`: the agency owner attests that the client agreed.
 */
export function autoConsentText(method: AutoConsentGrantMethod, names: AutoConsentNames): string {
  const agency = agencyName(names);
  if (method === "client") {
    return `I agree that ${agency} may publish the posts its AI writes for ${names.location} in the series “${names.series}” on Google at their scheduled times, without my approval of each post. Posts that the safety checks hold still wait for a person. I can withdraw this at any time.`;
  }
  return `I confirm that ${clientName(names)} has agreed that ${agency} may publish the posts its AI writes for ${names.location} in the series “${names.series}” on Google at their scheduled times, without approving each post.`;
}

export type AutoConsentAskCopy = { title: string; body: string; action: string | null };

/** The note on a series card while the approval is missing, for what the signed-in user can do. */
export function autoConsentAsk(method: SeriesAutoConsent["grant_method"], names: AutoConsentNames): AutoConsentAskCopy {
  const agency = agencyName(names);
  if (method === "client") {
    return {
      title: "Approve automatic posts",
      body: `${agency} would like the posts of this series to go out on Google at their times, without your approval of each one. Until you approve, each post waits for review.`,
      action: "Approve automatic posts",
    };
  }
  if (method === "owner_attestation") {
    return {
      title: "Automatic posts need your client's OK",
      body: `Google lets an agency publish a client's posts without a review of each one only with the client's approval. Record it once ${clean(names.client) ?? "your client"} has agreed. Until then, each post of this series waits for review.`,
      action: "Record approval",
    };
  }
  return {
    title: "Automatic posts need your client's OK",
    body: "Your client or the account owner must approve automatic posts for this series. Until then, each post waits for review.",
    action: null,
  };
}

export type AutoConsentDialogCopy = {
  title: string;
  description: string;
  checkbox: string;
  confirm: string;
  pending: string;
  note: string;
  success: string;
  successDetail: string;
};

/** The dialog: the client's consent, or the owner's attestation. */
export function autoConsentDialog(method: AutoConsentGrantMethod, names: AutoConsentNames): AutoConsentDialogCopy {
  const client = clean(names.client);
  const after = `Posts of “${names.series}” can now go out on their own, unless a safety check holds one for a person.`;
  if (method === "client") {
    return {
      title: "Approve automatic posts",
      description: `Google asks for your OK before an agency publishes posts for you without a review of each one. ${agencyName(names)} still writes every post with AI from your business's facts.`,
      checkbox: "I agree",
      confirm: "Approve automatic posts",
      pending: "Approving…",
      note: "It's saved with your name and today's date. You can withdraw it at any time on this page.",
      success: "Automatic posts approved",
      successDetail: after,
    };
  }
  return {
    title: "Record your client's approval",
    description: `Record this only if ${client ?? "your client"} has told you that ${agencyName(names)} may publish these posts without approving each one.`,
    checkbox: "I confirm this is true",
    confirm: "Record approval",
    pending: "Recording…",
    note: `It's saved with your name and today's date. You${client ? ` or ${client}` : ""} can withdraw it at any time.`,
    success: "Approval recorded",
    successDetail: after,
  };
}

/**
 * The quiet line once it's given: "Automatic posts approved by Morgan Patel on Nov 15, 2026" (the client's own
 * consent) or "Client's approval of automatic posts recorded by Jordan Lee on …" (the owner's attestation). Who, by
 * the 2026-11-17 names rule shared with the reply authorization and AI Settings (`src/lib/ai-settings/names.ts`):
 * "you"; the person's name; else the client's own consent reads the client's name ("someone at <client>" for a client
 * user) and the owner's attestation "the account owner" ("your agency" for a client user). `client`: the location's
 * client, by name.
 */
export function autoConsentGrantedText(consent: SeriesAutoConsent, viewer: { userId: string | null; clientUser: boolean }, client?: string | null): string {
  const by = byActor(
    { name: consent.user_name, mine: isViewer(consent.user_id, viewer.userId), role: grantRole(consent.method), client },
    { clientUser: viewer.clientUser },
  );
  const when = consent.at ? formatDate(consent.at, "") : "";
  const what = consent.method === "owner_attestation" ? "Client's approval of automatic posts recorded" : "Automatic posts approved";
  return `${what}${by}${when ? ` on ${when}` : ""}`;
}

/** The confirmation before withdrawing it. */
export function autoConsentWithdrawCopy(names: AutoConsentNames): { title: string; description: string } {
  return {
    title: "Withdraw the approval?",
    description: `Posts of “${names.series}” will wait for review again, including the ones already scheduled. You can approve automatic posts again later.`,
  };
}

export type AutoConsentError =
  /** Show the message; `reload` when the series must be read again. */
  | { kind: "message"; message: string; reload?: boolean }
  /** A Business organization: nothing to approve (read the series again; the note goes). */
  | { kind: "not_required" };

/**
 * A failed grant or withdrawal: 400 `auto_consent_not_required`, 403 `client_or_owner_only`, 409 `client_changed`,
 * 404 `series_not_found`.
 */
export function autoConsentError(error: unknown, granting: boolean): AutoConsentError {
  const fallback = granting ? "The approval couldn't be saved. Try again." : "The approval couldn't be withdrawn. Try again.";
  if (!isApiError(error)) return { kind: "message", message: fallback };
  switch (error.reason) {
    case "auto_consent_not_required":
      return { kind: "not_required" };
    case "client_or_owner_only":
      return { kind: "message", message: "Only the client or the account owner can approve automatic posts, or withdraw the approval." };
    case "client_changed":
      return { kind: "message", message: "The location's client changed. Reload to see who can approve automatic posts.", reload: true };
    case "series_not_found":
      return { kind: "message", message: "This series was deleted meanwhile.", reload: true };
    case "read_only":
      return { kind: "message", message: "Your access is read-only." };
    case "invalid_input":
      return { kind: "message", message: fallback };
    default: {
      const message = error.message;
      return { kind: "message", message: message && error.status < 500 && !/server|request failed|internal/i.test(message) ? message : fallback };
    }
  }
}

/**
 * Grants (`true`) or withdraws (`false`) the approval of a series' automatic publishing. On success the series in the
 * location's list is replaced by the answer and the posts are read again (scheduled automatic posts may go back to
 * review).
 */
export function useSetSeriesAutoConsent(locationId: string, seriesId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (granted: boolean) =>
      setSeriesAutoConsent(locationId, seriesId, granted ? { granted: true, consent_version: SERIES_AUTO_CONSENT_VERSION } : { granted: false }),
    onSuccess: (series) => {
      queryClient.setQueryData<{ series: PostSeries[]; limit: number }>([...postsKey(locationId), "series"], (current) =>
        current ? { ...current, series: current.series.map((entry) => (entry.series_id === series.series_id ? { ...entry, ...series } : entry)) } : current,
      );
      void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATION_POSTS_KEY });
    },
  });
}

/** Reads the location's series (and posts) again, e.g. after a 409 `client_changed` or a 400 `auto_consent_not_required`. */
export function useReloadSeries(locationId: string): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
  };
}
