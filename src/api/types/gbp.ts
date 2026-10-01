/** Response of `GET gbp/connect/url` (redirect fallback): the Google OAuth consent URL. */
export type GbpConnectUrlResponse =
  | string
  | {
      url?: string;
      authUrl?: string;
      auth_url?: string;
      data?: string | { url?: string; authUrl?: string; auth_url?: string };
    }
  | undefined;

/** `GET gbp/connect/popup`: config for `google.accounts.oauth2.initCodeClient`. `state` lasts 10 minutes and works once. */
export type GbpPopupConfig = {
  client_id: string;
  scope: string;
  state: string;
  ux_mode: "popup";
  select_account: boolean;
};

/** `POST gbp/connect/code`. */
export type GbpConnectCodeResult = {
  connected: boolean;
  google_email: string;
  google_sub: string;
};

export type GbpConnectionStatus = "active" | "revoked";

/** One connected Google account, from `GET gbp/connections`. */
export type GbpConnection = {
  google_sub: string;
  google_email: string;
  status: GbpConnectionStatus;
  /** Picks not bound yet. */
  picked: number;
  /** Picks bound to a location. */
  bound: number;
};

export type GbpConnectionsResponse = {
  limit: number;
  connections: GbpConnection[];
};

/** A Business Profile location in the connect modal's checklist. */
export type GbpAccountLocation = {
  gbpAccountId?: string;
  gbpLocationId: string;
  title: string;
  address: string | null;
  city: string | null;
  region_code: string | null;
  place_id: string | null;
  /** False outside the US and Canada: greyed out, can't be picked. */
  supported: boolean;
  picked: boolean;
  /** Another user of the organization picked it. */
  picked_by_other: boolean;
  pick_id: string | null;
  /** Already bound to this location; not selectable. */
  bound_location_id: string | null;
};

/** `GET gbp/connections/:googleSub/locations`. */
export type GbpAccountLocationsResponse = {
  google_sub: string;
  google_email: string;
  locations: GbpAccountLocation[];
  /** Business accounts inside the Google account whose locations could not be listed. */
  errors: unknown[];
};

/** `PUT gbp/connections/:googleSub/picks`. */
export type GbpSavePicksResponse = GbpAccountLocationsResponse & {
  picked: number;
  removed: number;
  kept_bound: number;
};

/** `POST gbp/picks/:pickId/bind`. */
export type GbpBindResult = {
  pick_id: string;
  location: {
    location_id: string;
    name: string;
    address?: string | null;
    place_id?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  /** False when the pick linked an existing location (no new slot). */
  created: boolean;
  /** Service-area business: ask for a city or ZIP, then `PUT locations/:id/center`. */
  center_needed: boolean;
  binding: unknown;
};

/** `POST gbp/disconnect`. */
export type GbpDisconnectResult = {
  revoked: boolean;
  bindings_removed: number;
  picks_removed: number;
  google_email: string;
};

/** `POST gbp/unbind`. */
export type GbpUnbindResult = {
  unbound: boolean;
  jobs_cancelled: { gbp_sync: number; scheduled_posts: number };
};
