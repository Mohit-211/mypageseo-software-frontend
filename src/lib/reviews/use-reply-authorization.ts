/**
 * Phase 25a, agency organizations: the client's authorization to reply to this location's reviews
 * (Google's API policy). Read from `GET reviews/summary` → `reply_authorization`; while it is required
 * and not granted, Send is disabled and a banner offers the right grant flow:
 * - `grant_method: "client"`: a client user of the location's client gives the client's consent;
 * - `grant_method: "owner_attestation"`: the agency owner attests that the client authorized it;
 * - `grant_method: null`: a member can't ("Your client or the account owner must authorize replies").
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { setReplyAuthorization, type ReplyAuthorization, type ReviewsSummary } from "@/api";
import { REPLY_AUTH_CONSENT_VERSION } from "./reply-checks";
import { setCachedReplyAuthorization } from "./review-cache";
import { reviewsSummaryQuery } from "./use-reviews";

export type ReplyAuthorizationState = {
  authorization: ReplyAuthorization | null;
  /** Required and not granted: sending is refused (409 `reply_authorization_required`). */
  blocked: boolean;
  /** What the signed-in user can do about it. */
  grantMethod: ReplyAuthorization["grant_method"];
  isPending: boolean;
};

const selectAuthorization = (summary: ReviewsSummary) => summary.reply_authorization ?? null;

/** The location's reply authorization (shares the cached reviews summary). */
export function useReplyAuthorization(locationId: string, enabled = true): ReplyAuthorizationState {
  const query = useQuery({ ...reviewsSummaryQuery(locationId), select: selectAuthorization, enabled });
  const authorization = query.data ?? null;
  return {
    authorization,
    blocked: Boolean(authorization?.required && !authorization.granted),
    grantMethod: authorization?.grant_method ?? null,
    isPending: enabled && query.isPending,
  };
}

/**
 * Grants (with the consent text's version) or revokes the authorization, then writes the answer into
 * the cached summary so every banner and Send button updates at once, and re-reads the summary.
 * Errors: 403 `client_or_owner_only`, 400 `reply_authorization_not_required`, 409 `client_changed` (reload).
 */
export function useSetReplyAuthorization(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (granted: boolean) =>
      setReplyAuthorization(locationId, granted ? { granted: true, consent_version: REPLY_AUTH_CONSENT_VERSION } : { granted: false }),
    onSuccess: (authorization) => setCachedReplyAuthorization(queryClient, locationId, authorization),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reviewsSummaryQuery(locationId).queryKey });
    },
  });
}
