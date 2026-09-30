import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { disconnectGbp, getGbpConnectUrl, isApiError } from "@/api";
import { GBP_QUERY_KEY } from "./use-gbp";

const POPUP_NAME = "mypageseo-gbp-connect";
const POPUP_FLAG_KEY = "mypageseo.gbp.popup";
/** A popup flag older than this is treated as stale (the popup was abandoned). */
const POPUP_FLAG_TTL_MS = 15 * 60 * 1000;
const CHANNEL_NAME = "mypageseo-gbp-connect";
/** Where the app goes after the popup finishes: the GBP page on success, locations otherwise. */
export const GBP_CONNECT_SUCCESS_PATH = "/gbp";
export const GBP_CONNECT_FAILURE_PATH = "/locations";
/** Frontend route the backend redirects to once the connection finishes. */
const CALLBACK_PATH = "/gbp/connect/callback";

/** Messages the callback page (inside the popup) sends to the page that opened it. */
export type GbpConnectStatus = "connected" | "denied" | "failed" | "invalid";

export type GbpConnectMessage =
  | { type: "result"; status: GbpConnectStatus }
  | { type: "done" };

function errorMessage(err: unknown, fallback: string): string {
  return isApiError(err) || err instanceof Error ? err.message : fallback;
}

function setPopupFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(POPUP_FLAG_KEY, String(Date.now()));
    else localStorage.removeItem(POPUP_FLAG_KEY);
  } catch {
    // Storage can be blocked; the callback page still detects the popup through `window.opener`.
  }
}

/** True when the current window is the connection popup opened by `useGbpConnect`. */
export function isGbpConnectPopup(): boolean {
  if (window.opener && window.opener !== window) return true;
  try {
    const openedAt = Number(localStorage.getItem(POPUP_FLAG_KEY));
    return openedAt > 0 && Date.now() - openedAt < POPUP_FLAG_TTL_MS;
  } catch {
    return false;
  }
}

/** Sends a message from the popup to the page that opened it. */
export function postGbpConnectMessage(message: GbpConnectMessage) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(message);
  channel.close();
}

/** Opens an empty, centered popup. Must run synchronously inside the click so it isn't blocked. */
function openCenteredPopup(): Window | null {
  const width = 520;
  const height = 680;
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
  return window.open(
    "about:blank",
    POPUP_NAME,
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  );
}

/**
 * Starts the Google Business Profile connection in a popup: fetches the OAuth URL
 * from `gbp/connect/url` and shows Google's sign-in there. The popup ends on the
 * callback page, which reports the result here; this page then refreshes the
 * connection and moves to the GBP page (or locations on failure). Falls back to a full-page redirect
 * when the browser blocks the popup.
 */
export function useGbpConnect() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const result = useRef<GbpConnectStatus | null>(null);
  /** Only the page that opened the popup reacts to its messages (not other tabs). */
  const waiting = useRef(false);

  const stopWatching = useCallback(() => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = null;
    popupRef.current = null;
    waiting.current = false;
    setPopupFlag(false);
    setConnecting(false);
  }, []);

  const finish = useCallback(() => {
    const status = result.current;
    result.current = null;
    stopWatching();
    if (!status) return;
    navigate(status === "connected" ? GBP_CONNECT_SUCCESS_PATH : GBP_CONNECT_FAILURE_PATH, { replace: true });
  }, [navigate, stopWatching]);

  // Listen for the popup's result for as long as this page is mounted.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<GbpConnectMessage>) => {
      if (!waiting.current) return;
      if (event.data?.type === "result") {
        result.current = event.data.status;
        if (event.data.status === "connected") void queryClient.invalidateQueries({ queryKey: GBP_QUERY_KEY });
      } else if (event.data?.type === "done") {
        finish();
      }
    };
    return () => channel.close();
  }, [queryClient, finish]);

  useEffect(() => () => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
  }, []);

  const connect = useCallback(async () => {
    // Reuse an open popup instead of stacking a second one.
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }

    const popup = openCenteredPopup();
    setConnecting(true);
    setError(null);
    result.current = null;

    try {
      const url = await getGbpConnectUrl(`${window.location.origin}${CALLBACK_PATH}`);
      if (!popup || popup.closed) {
        window.location.assign(url);
        return;
      }
      setPopupFlag(true);
      waiting.current = true;
      popupRef.current = popup;
      popup.location.href = url;
      popup.focus();
      // The user may close the popup at any point; stop waiting when they do.
      pollRef.current = window.setInterval(() => {
        if (popup.closed) finish();
      }, 500);
    } catch (err) {
      popup?.close();
      setConnecting(false);
      setError(errorMessage(err, "Google Business Profile could not be connected. Try again."));
    }
  }, [finish]);

  return { connect, connecting, error };
}

/** Revokes the Google Business Profile connection through `gbp/disconnect`. */
export function useGbpDisconnect() {
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Resolves `true` when the backend confirmed the disconnect. */
  const disconnect = useCallback(async (): Promise<boolean> => {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnectGbp();
      await queryClient.invalidateQueries({ queryKey: GBP_QUERY_KEY });
      return true;
    } catch (err) {
      setError(errorMessage(err, "Google Business Profile could not be disconnected. Try again."));
      return false;
    } finally {
      setDisconnecting(false);
    }
  }, [queryClient]);

  return { disconnect, disconnecting, error };
}
