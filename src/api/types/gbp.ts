/** Response of `GET gbp/connect/url`: the Google OAuth consent URL to send the user to. */
export type GbpConnectUrlResponse =
  | string
  | {
      url?: string;
      authUrl?: string;
      auth_url?: string;
      data?: string | { url?: string; authUrl?: string; auth_url?: string };
    }
  | undefined;

/** Response of `POST gbp/disconnect`. */
export type GbpConnectionResponse = {
  success?: boolean;
  message?: string;
  data?: {
    /** Google account email that authorized the connection. */
    email?: string;
    account?: string;
    [key: string]: unknown;
  } | null;
};

/** Connected Google Business Profile as returned by `GET gbp`. Fields vary by backend version. */
export type GbpConnection = {
  id?: string;
  connected?: boolean;
  is_connected?: boolean;
  status?: string;
  /** Google account email that authorized the connection. */
  email?: string;
  account?: string;
  connected_at?: string;
  /** Backend explanation when no profile is connected, e.g. "Please connect with Google Business Profile". */
  message?: string;
  [key: string]: unknown;
};

/** Response of `GET gbp`: the connection, possibly wrapped in a `{ data }` envelope. */
export type GetGbpResponse = GbpConnection | { data?: GbpConnection | null; message?: string } | null | undefined;
