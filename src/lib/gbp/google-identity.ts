/**
 * Loads Google Identity Services (GIS) and opens its OAuth code client in popup
 * mode. The backend supplies the client config (`GET gbp/connect/popup`) and
 * exchanges the returned code (`POST gbp/connect/code`).
 */
import type { GbpPopupConfig } from "@/api";

const GIS_SRC = "https://accounts.google.com/gsi/client";

export type GisCodeResponse = { code?: string; state?: string; error?: string; error_description?: string };
export type GisCodeError = { type?: string; message?: string };

type GisCodeClient = { requestCode: () => void };

type GisOAuth2 = {
  initCodeClient: (
    config: GbpPopupConfig & {
      callback: (response: GisCodeResponse) => void;
      error_callback?: (error: GisCodeError) => void;
    },
  ) => GisCodeClient;
};

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GisOAuth2 } };
  }
}

let loading: Promise<GisOAuth2> | null = null;

/** Loads the GIS script once. Rejects (and allows a retry) when it can't be fetched. */
export function loadGoogleIdentity(): Promise<GisOAuth2> {
  const ready = window.google?.accounts?.oauth2;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GisOAuth2>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error("Google sign-in did not load."));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Google sign-in could not be loaded. Check your connection or ad blocker and try again."));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/**
 * Builds a code client for one `state`. Call `requestCode()` synchronously inside
 * a click handler, or the browser blocks the popup.
 */
export function createGbpCodeClient(
  oauth2: GisOAuth2,
  config: GbpPopupConfig,
  handlers: { onCode: (response: GisCodeResponse) => void; onError: (error: GisCodeError) => void },
): GisCodeClient {
  return oauth2.initCodeClient({
    client_id: config.client_id,
    scope: config.scope,
    state: config.state,
    ux_mode: config.ux_mode,
    select_account: config.select_account,
    callback: handlers.onCode,
    error_callback: handlers.onError,
  });
}
