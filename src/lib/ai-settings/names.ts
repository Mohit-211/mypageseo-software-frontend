/**
 * Who did something, by name (2026-11-17, G6): the one rule for every "… by <who>" line, so they all say the same
 * for the same case: the reply authorization (`user_name`), a series' approval of automatic posts (`user_name`),
 * restricted mode switched off (`restricted.attested_by_name`), the logo's confirmation (`attested_by_name`) and the
 * automatic replies' agreement (`consent.user_name`).
 *
 * The backend sends the person's profile name (as the team list shows it), never an email, and null for a deleted
 * or unnamed account. Owners and members see every name. A client user sees the owner's and its own client's users'
 * names, and null for anyone else: the agency's other staff.
 *
 * The words, first that applies:
 * 1. the signed-in user did it: "you";
 * 2. the name;
 * 3. no name to show, by who can have done it (`Actor.role`):
 *
 *    | `role`                                    | an owner or a member        | a client user              |
 *    | ----------------------------------------- | --------------------------- | -------------------------- |
 *    | `owner`: the account owner                | "the account owner"         | "your agency"              |
 *    | `client`: a user of the location's client | the client: "Harbor Dental" | "someone at Harbor Dental" |
 *    | `team`: the owner or a member             | nothing (no "by …")         | "your agency"              |
 *
 *    A client user gets the names of its own client's users, so its null there is a deleted or unnamed account.
 *    Without the client's name: "your client" and "someone at your business".
 *
 * Our own words are lower case, as every line puts them after "by" ("Switched on by your agency"); a person's or a
 * client's name is always shown as it is.
 *
 * Also the business's short name for examples ("The team at Harbor Dental"), as the signature field and the
 * readiness checklist show them.
 */

/** Who can have done it, for the words when there is no name to show. */
export type ActorRole =
  /** The account owner: an agency owner's attestation, a Business owner's consent, restricted mode switched off. */
  | "owner"
  /** A user of the location's client, giving the client's own consent. */
  | "client"
  /** The owner or a member (the logo's confirmation). */
  | "team";

export type Actor = {
  /** The profile name the backend sent: null for a deleted or unnamed account, or one hidden from a client user. */
  name: string | null | undefined;
  role: ActorRole;
  /** The signed-in user did it ("you"). */
  mine?: boolean;
  /** The location's client, by name: "someone at Harbor Dental", or "Harbor Dental" for the client's own consent. */
  client?: string | null | undefined;
};

/** Who is looking: a client user gets fewer names (see above). */
export type NamesViewer = { clientUser: boolean };

/** The role behind a grant's `method`: the client's own consent, or the owner's (an agency owner's attestation, a Business owner's consent). */
export function grantRole(method: "client" | "owner_attestation" | "owner" | null | undefined): ActorRole {
  if (method === "client") return "client";
  return method === "owner_attestation" || method === "owner" ? "owner" : "team";
}

/** True when `userId` is the signed-in user's (`viewerId`, the session's subject); false when either is unknown. */
export function isViewer(userId: string | null | undefined, viewerId: string | null | undefined): boolean {
  return Boolean(userId && viewerId && userId === viewerId);
}

const clean = (value: string | null | undefined): string | null => value?.trim() || null;

/**
 * Who did it, inside a sentence: "Ana Diaz", "you", "your agency", "someone at Harbor Dental", "the account owner",
 * "Harbor Dental", or null when there is nothing to say (an owner or a member looking at a teammate's unnamed account).
 */
export function actorName(actor: Actor, viewer: NamesViewer): string | null {
  if (actor.mine) return "you";
  const name = clean(actor.name);
  if (name) return name;
  const client = clean(actor.client);
  if (viewer.clientUser) return actor.role === "client" ? `someone at ${client ?? "your business"}` : "your agency";
  if (actor.role === "owner") return "the account owner";
  if (actor.role === "client") return client ?? "your client";
  return null;
}

/**
 * To follow a verb: " by Ana Diaz", " by you", " by your agency", " by someone at Harbor Dental", " by the account
 * owner", or "" when there is nothing to say: "Switched off by Ana Diaz on Nov 13, 2026".
 */
export function byActor(actor: Actor, viewer: NamesViewer): string {
  const text = actorName(actor, viewer);
  return text ? ` by ${text}` : "";
}

/**
 * The business's name without the location's part: "Harbor Dental" for "Harbor Dental – Downtown Toronto", for
 * examples built from it ("The team at Harbor Dental"). Empty when there is no name.
 */
export function shortBusinessName(locationName: string | null | undefined): string {
  const name = locationName?.trim() ?? "";
  return name.split(/\s+[–—-]\s+/)[0]?.trim() || name;
}
