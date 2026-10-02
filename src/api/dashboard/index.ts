import { api, unwrapData } from "../client";
import type { Dashboard, DashboardSort } from "../types/dashboard";

/** The organization's dashboard (business or agency shape). Agency table: sort / order / page. */
export async function getDashboard(
  params: { page?: number; limit?: number; sort?: DashboardSort; order?: "asc" | "desc" } = {},
  signal?: AbortSignal,
): Promise<Dashboard> {
  return unwrapData(await api.get("dashboard", { query: params, ...(signal ? { signal } : {}) }));
}
