import { useQuery } from "@tanstack/react-query";
import { getWhiteLabelLinks, isApiError, type WhiteLabelLinkRow } from "@/api";
import type { Client, LocationSummary } from "@/lib/mypageseo/workspace";
import { byBoolean, byNumber, byText, byTime, chain, type Comparator } from "@/lib/sort";
import { WHITE_LABEL_LINKS_KEY, isClientLinksUnavailable } from "./client-links";

/**
 * Every active client link, all pages. Under `WHITE_LABEL_LINKS_KEY`, so the editor's
 * invalidations (create, save, rotate, turn off) refresh it.
 */
export const ALL_LINKS_KEY = [...WHITE_LABEL_LINKS_KEY, "all"] as const;

/** `GET white-label-links` answers at most 100 a page. */
const PAGE_SIZE = 100;

async function loadAllLinks(signal: AbortSignal): Promise<WhiteLabelLinkRow[]> {
  const rows: WhiteLabelLinkRow[] = [];
  for (let page = 1; ; page += 1) {
    const result = await getWhiteLabelLinks({ page, limit: PAGE_SIZE }, signal);
    rows.push(...result.results);
    if (rows.length >= result.total || result.results.length === 0) break;
  }
  return rows;
}

/**
 * The agency's live client links (newest first, as the backend sends them). A plan without white
 * label answers 403 `feature_not_included`: no retry, the page shows the upsell instead.
 */
export function useAllWhiteLabelLinks(enabled: boolean) {
  return useQuery({
    queryKey: ALL_LINKS_KEY,
    queryFn: ({ signal }) => loadAllLinks(signal),
    enabled,
    staleTime: 30_000,
    retry: (count, error) => !isClientLinksUnavailable(error) && count < 2,
  });
}

/** The plan doesn't include white label (learned from a 403 on the links list). */
export function isWhiteLabelFeatureMissing(error: unknown): boolean {
  return isApiError(error) && error.reason === "feature_not_included";
}

/** One location in the client links table, with its live link if it has one. */
export type ClientLinkRow = {
  id: string;
  name: string;
  /** "Toronto, Canada" ("" when unknown). */
  area: string;
  clientId: string | null;
  clientName: string | null;
  link: WhiteLabelLinkRow | null;
};

/**
 * Every location of the workspace (already scoped to what this user may see) with its live link.
 * A link whose location isn't in the workspace list is kept (never hide a live link).
 */
export function mergeLocationsWithLinks(locations: LocationSummary[], clients: Client[], links: WhiteLabelLinkRow[]): ClientLinkRow[] {
  const clientName = new Map(clients.map((client) => [client.id, client.name]));
  const linkByLocation = new Map(links.map((link) => [link.location.id, link]));
  const rows: ClientLinkRow[] = locations.map((location) => ({
    id: location.id,
    name: location.businessName,
    area: location.area,
    clientId: location.clientId ?? null,
    clientName: location.clientId ? (clientName.get(location.clientId) ?? null) : null,
    link: linkByLocation.get(location.id) ?? null,
  }));
  const known = new Set(locations.map((location) => location.id));
  for (const link of links) {
    if (known.has(link.location.id)) continue;
    rows.push({
      id: link.location.id,
      name: link.location.name,
      area: [link.location.city, link.location.state].filter(Boolean).join(", "),
      clientId: link.location.client_id,
      clientName: link.location.client_id ? (clientName.get(link.location.client_id) ?? null) : null,
      link,
    });
  }
  return rows;
}

export type ClientLinkSort = "default" | "name" | "visits" | "updated";

/**
 * Default order: live links first, newest first (the backend's order), then locations without a
 * link from A to Z. Column sorts keep "no link" rows last in both directions.
 */
export function clientLinkComparator(sort: ClientLinkSort, order: "asc" | "desc"): Comparator<ClientLinkRow> {
  const tieBreak = chain(byText<ClientLinkRow>((row) => row.name), byText((row) => row.id));
  switch (sort) {
    case "name":
      return chain(byText((row) => row.name, order), byText((row) => row.id));
    case "visits":
      return chain(byNumber((row) => row.link?.views, order), tieBreak);
    case "updated":
      return chain(byTime((row) => row.link?.last_edition_at ?? row.link?.created_at, order), tieBreak);
    default:
      return chain(
        byBoolean((row) => row.link !== null),
        byTime((row) => row.link?.created_at, "desc"),
        tieBreak,
      );
  }
}

/** Search across the location's name, area and client. */
export function matchesClientLinkSearch(row: ClientLinkRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [row.name, row.area, row.clientName ?? ""].some((value) => value.toLocaleLowerCase().includes(needle));
}
