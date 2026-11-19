/**
 * The words of the agency's reply authorization (Phase 25a; Google's Business Profile API policy:
 * an agency replies to its client's reviews only with the client's authorization).
 *
 * The consent and attestation texts are recorded by their version: the app sends
 * `REPLY_AUTH_CONSENT_VERSION` ("2026-11-13") as `consent_version`, so the wording of
 * `consentText` must stay exactly as it is for that version. A new wording needs a new version.
 *
 * Names: `agency` is the organization's name (the workspace), `client` the location's client
 * (falls back to "our client"), `location` the location's name.
 */
import { isApiError, type ReplyAuthorization } from "@/api";
import { byActor, grantRole } from "@/lib/ai-settings/names";
import { formatDate } from "@/lib/datetime";
import { REPLY_AUTH_CONSENT_VERSION } from "./reply-checks";

export { REPLY_AUTH_CONSENT_VERSION };

/** `grant_method` when the signed-in user can grant or withdraw the authorization. */
export type GrantMethod = NonNullable<ReplyAuthorization["grant_method"]>;

export type ReplyAuthorizationNames = {
  /** The agency (the organization's name). */
  agency: string | null | undefined;
  /** The location's client. */
  client: string | null | undefined;
  /** The location's name. */
  location: string;
};

const clean = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text ? text : null;
};

const agencyName = (names: ReplyAuthorizationNames) => clean(names.agency) ?? "our agency";

/**
 * The text the user agrees to, version 2026-11-13. Fixed wording: it is what `consent_version`
 * records.
 * - `client`: a client user of the location's client gives the client's consent;
 * - `owner_attestation`: the agency owner attests that the client authorized it.
 */
export function consentText(method: GrantMethod, names: ReplyAuthorizationNames): string {
  const agency = agencyName(names);
  if (method === "client") {
    return `I authorize ${agency} to reply to Google reviews of ${names.location} on our behalf. I can withdraw this at any time.`;
  }
  return `I confirm that ${clean(names.client) ?? "our client"} has authorized ${agency} to reply to Google reviews of ${names.location} on their behalf.`;
}

export type ReplyAuthorizationBannerCopy = {
  title: string;
  body: string;
  /** The banner's button (opens the dialog); null when the user can't grant it (a member). */
  action: string | null;
};

/** The banner shown while replies need the authorization, for what the signed-in user can do. */
export function replyAuthorizationBanner(method: ReplyAuthorization["grant_method"], names: ReplyAuthorizationNames): ReplyAuthorizationBannerCopy {
  const agency = agencyName(names);
  const client = clean(names.client);
  if (method === "client") {
    return {
      title: `Allow ${agency} to reply to your Google reviews`,
      body: `Google asks for your OK before an agency replies to reviews for you. Until you give it, ${agency} can prepare replies but can't send them.`,
      action: "Authorize replies",
    };
  }
  if (method === "owner_attestation") {
    return {
      title: "Replies need your client's OK",
      body: `Google lets an agency reply to a client's reviews only with the client's authorization. Record it once ${client ?? "your client"} has agreed. Until then, replies can be drafted but not sent.`,
      action: "Record authorization",
    };
  }
  return {
    title: "Replies need your client's OK",
    body: "Your client or the account owner must authorize replies before they can be sent. You can still draft replies meanwhile.",
    action: null,
  };
}

export type ReplyAuthorizationDialogCopy = {
  title: string;
  description: string;
  checkbox: string;
  confirm: string;
  pending: string;
  note: string;
  success: string;
  successDetail: string;
};

/** The grant dialog: the client's consent, or the owner's attestation. */
export function replyAuthorizationDialog(method: GrantMethod, names: ReplyAuthorizationNames): ReplyAuthorizationDialogCopy {
  const agency = agencyName(names);
  const client = clean(names.client);
  if (method === "client") {
    return {
      title: `Allow ${agency} to reply to your reviews`,
      description: `Google requires your authorization before an agency replies to your reviews. ${agency} drafts each reply and sends it to Google for you.`,
      checkbox: "I agree",
      confirm: "Authorize replies",
      pending: "Authorizing…",
      note: "It's saved with your name and today's date. You can withdraw it at any time on this page.",
      success: "Replies authorized",
      successDetail: `${agency} can now send replies to the reviews of ${names.location}.`,
    };
  }
  return {
    title: "Record your client's authorization",
    description: `Record this only if ${client ?? "your client"} has told you that ${agency} may reply to their Google reviews.`,
    checkbox: "I confirm this is true",
    confirm: "Record authorization",
    pending: "Recording…",
    note: `It's saved with your name and today's date. You${client ? ` or ${client}` : ""} can withdraw it at any time.`,
    success: "Authorization recorded",
    successDetail: `Replies to the reviews of ${names.location} can be sent now.`,
  };
}

/**
 * "Replies authorized by Ana Diaz on Nov 13, 2026" (the quiet line once it's granted). Who, by the 2026-11-17 names
 * rule shared with series approvals and AI Settings (`src/lib/ai-settings/names.ts`): "you"; the person's name; else
 * the client's own consent reads "Harbor Dental" ("someone at Harbor Dental" for a client user) and the owner's
 * attestation "the account owner" ("your agency" for a client user). `viewerIsClientUser`: the signed-in user is a
 * client user.
 */
export function authorizedByText(authorization: ReplyAuthorization, names: ReplyAuthorizationNames, byMe: boolean, viewerIsClientUser = false): string {
  const by = byActor({ name: authorization.user_name, mine: byMe, role: grantRole(authorization.method), client: names.client }, { clientUser: viewerIsClientUser });
  const when = authorization.at ? formatDate(authorization.at, "") : "";
  return `Replies authorized${by}${when ? ` on ${when}` : ""}`;
}

/** The confirmation before withdrawing it. */
export function withdrawCopy(method: GrantMethod, names: ReplyAuthorizationNames): { title: string; description: string } {
  return {
    title: "Withdraw the authorization?",
    description:
      method === "client"
        ? `${agencyName(names)} won't be able to send replies to the reviews of ${names.location} until you authorize them again. Drafts are kept.`
        : `Replies to the reviews of ${names.location} can't be sent until the authorization is given again. Drafts are kept.`,
  };
}

/** Why Send is disabled while replies need the authorization (a tooltip or a line under the button). */
export function sendBlockedByAuthorization(method: ReplyAuthorization["grant_method"]): string {
  if (method === "client") return "Authorize replies first: see the note at the top of the page.";
  if (method === "owner_attestation") return "Record your client's authorization first: see the note at the top of the page.";
  return "Replies need your client's authorization first. Your client or the account owner can give it.";
}

export type ReplyAuthorizationError =
  /** Show the message (with "Reload" when `reload`). */
  | { kind: "message"; message: string; reload?: boolean }
  /** A business organization: nothing to authorize (hide the banner). */
  | { kind: "not_required" };

/**
 * A failed grant or withdrawal: 403 `client_or_owner_only` (a member), 400
 * `reply_authorization_not_required` (a business organization), 409 `client_changed` (the
 * location's client changed meanwhile: reload).
 */
export function replyAuthorizationError(error: unknown, granting: boolean): ReplyAuthorizationError {
  const fallback = granting ? "The authorization couldn't be saved. Try again." : "The authorization couldn't be withdrawn. Try again.";
  if (!isApiError(error)) return { kind: "message", message: fallback };
  switch (error.reason) {
    case "reply_authorization_not_required":
      return { kind: "not_required" };
    case "client_or_owner_only":
      return { kind: "message", message: "Only the client or the account owner can authorize replies, or withdraw the authorization." };
    case "client_changed":
      return { kind: "message", message: "The location's client changed. Reload to see who can authorize replies.", reload: true };
    case "invalid_input":
      return { kind: "message", message: fallback };
    default: {
      // A plain sentence from the backend is better than a generic one, unless it is technical.
      const message = error.message;
      return { kind: "message", message: message && error.status < 500 && !/server|request failed|internal/i.test(message) ? message : fallback };
    }
  }
}
