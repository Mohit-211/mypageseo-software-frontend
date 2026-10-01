import { useCallback, useState, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { disconnectGbp, isApiError, type GbpDisconnectResult } from "@/api";
import { LOCATIONS_QUERY_KEY } from "../locations/use-locations";
import { GBP_QUERY_KEY } from "./use-gbp";

/**
 * The Google Business Profile connect modal: connect a Google account (GIS popup),
 * then pick that account's locations. The modal is rendered once by
 * `GbpConnectDialogHost`; any screen opens it with `useGbpConnect().connect()`.
 */
export type GbpConnectTarget = {
  /** Skip the Google step and open the checklist for an account that is already connected. */
  googleSub: string;
  googleEmail: string;
};

type ConnectModalState = { open: false } | { open: true; target: GbpConnectTarget | null; key: number };

let modalState: ConnectModalState = { open: false };
let openCount = 0;
const listeners = new Set<() => void>();

function setModalState(next: ConnectModalState) {
  modalState = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openGbpConnect(target: GbpConnectTarget | null = null) {
  openCount += 1;
  setModalState({ open: true, target, key: openCount });
}

export function closeGbpConnect() {
  setModalState({ open: false });
}

/** Modal state for `GbpConnectDialogHost`. */
export function useGbpConnectModal(): ConnectModalState {
  return useSyncExternalStore(subscribe, () => modalState);
}

/** Opens the connect modal. `connect(target)` jumps straight to an account's checklist. */
export function useGbpConnect() {
  const state = useGbpConnectModal();
  const connect = useCallback((target?: GbpConnectTarget) => openGbpConnect(target ?? null), []);
  return { connect, connecting: state.open, error: null as string | null };
}

/** Refreshes everything a connect, pick, bind or disconnect can change. */
export function invalidateGbpQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: GBP_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY }),
  ]);
}

function errorMessage(err: unknown, fallback: string): string {
  return isApiError(err) || err instanceof Error ? err.message : fallback;
}

/**
 * Disconnects one Google account (`POST gbp/disconnect { google_sub }`). The locations
 * bound through it are deleted and its picks removed; other accounts keep working.
 */
export function useGbpDisconnect() {
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Resolves with the backend's answer (incl. `locations_removed`), or null when it failed. */
  const disconnect = useCallback(
    async (googleSub: string): Promise<GbpDisconnectResult | null> => {
      setDisconnecting(true);
      setError(null);
      try {
        const result = await disconnectGbp(googleSub);
        // Its locations were deleted: refresh the locations list, the header and reports.
        await invalidateGbpQueries(queryClient);
        await queryClient.invalidateQueries({ queryKey: ["reports"] });
        return result;
      } catch (err) {
        setError(errorMessage(err, "The Google account could not be disconnected. Try again."));
        return null;
      } finally {
        setDisconnecting(false);
      }
    },
    [queryClient],
  );

  return { disconnect, disconnecting, error };
}
