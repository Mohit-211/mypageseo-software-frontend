import { useQuery } from "@tanstack/react-query";
import { getGbpConnections } from "@/api";

export const GBP_CONNECTIONS_QUERY_KEY = ["gbp", "connections"] as const;
/** Prefix shared by every GBP query; invalidate it after connect, pick, bind or disconnect. */
export const GBP_QUERY_KEY = ["gbp"] as const;

/** Connected Google accounts (`GET gbp/connections`). */
export function useGbpConnections() {
  const query = useQuery({
    queryKey: GBP_CONNECTIONS_QUERY_KEY,
    queryFn: ({ signal }) => getGbpConnections(signal),
  });
  const connections = query.data?.connections ?? [];
  return {
    ...query,
    connections,
    limit: query.data?.limit ?? 3,
    /** True while at least one Google account is usable. */
    connected: connections.some((connection) => connection.status === "active"),
  };
}
