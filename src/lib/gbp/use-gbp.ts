import { useQuery } from "@tanstack/react-query";
import { getGbp, type GbpConnection } from "@/api";

export const GBP_QUERY_KEY = ["gbp"] as const;

/** True when the `GET gbp` payload describes a live connection. */
export function isGbpConnected(connection: GbpConnection | null | undefined): boolean {
  if (!connection) return false;
  if (typeof connection.connected === "boolean") return connection.connected;
  if (typeof connection.is_connected === "boolean") return connection.is_connected;
  if (typeof connection.status === "string") return /^(connected|active)$/i.test(connection.status);
  return true;
}

/** Loads the current Google Business Profile connection from `GET gbp`. */
export function useGbp() {
  const query = useQuery({
    queryKey: GBP_QUERY_KEY,
    queryFn: ({ signal }) => getGbp(signal),
  });

  return {
    ...query,
    connection: query.data ?? null,
    connected: isGbpConnected(query.data),
    account: query.data?.email ?? query.data?.account ?? null,
    /** Backend message explaining why no profile is connected, if one was sent. */
    notConnectedMessage: isGbpConnected(query.data) ? null : (query.data?.message ?? null),
  };
}
