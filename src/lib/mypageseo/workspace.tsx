import { useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClients,
  getLocationsList,
  getProfile,
  getSelectedOrganizationId,
  hasUsableSession,
  isApiError,
  setSelectedOrganizationId,
  subscribeToAccessToken,
  type LocationRow,
} from "@/api";
import type { AccountType } from "./navigation";
import { WorkspaceContext } from "./workspace-context";

export type Organization = {
  id: string;
  name: string;
  accountType: AccountType;
  role: string;
};

export type Client = {
  id: string;
  name: string;
};

export type LocationSummary = {
  id: string;
  clientId?: string;
  businessName: string;
  /** City / region label, e.g. "Austin, TX". */
  area: string;
  rating?: number;
  reviewCount?: number;
};

export type WorkspaceStatus = "loading" | "ready" | "unavailable";

export type WorkspaceValue = {
  status: WorkspaceStatus;
  organization: Organization | null;
  /** Every organization the user belongs to (for the header switcher). */
  organizations: Organization[];
  clients: Client[];
  activeClient: Client | null;
  locations: LocationSummary[];
  activeLocation: LocationSummary | null;
  setOrganizationId: (id: string) => void;
  setActiveClientId: (id: string | null) => void;
  setActiveLocationId: (id: string | null) => void;
};

/**
 * The signed-in user's organization, clients and locations, from the API:
 * organizations from `GET auth/me`, clients from `GET clients` (agency only) and
 * locations from `GET locations`. The picked organization is sent as
 * `X-Organization-Id`; the picked client and location are remembered in this browser.
 */
const STORAGE_KEY = "mypageseo.workspace-context";
/** `GET locations` returns at most 100 per page. */
const LOCATIONS_PAGE_SIZE = 100;

type StoredContext = { activeClientId: string | null; activeLocationId: string | null };

function readStoredContext(): StoredContext {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<StoredContext>;
    return {
      activeClientId: typeof parsed.activeClientId === "string" ? parsed.activeClientId : null,
      activeLocationId: typeof parsed.activeLocationId === "string" ? parsed.activeLocationId : null,
    };
  } catch {
    return { activeClientId: null, activeLocationId: null };
  }
}

function toLocationSummary(row: LocationRow): LocationSummary {
  return {
    id: row.location_id,
    ...(row.client ? { clientId: row.client.client_id } : {}),
    businessName: row.name,
    area: [row.city, row.country].filter(Boolean).join(", "),
    ...(row.reviews?.rating != null ? { rating: row.reviews.rating } : {}),
    ...(row.reviews?.count != null ? { reviewCount: row.reviews.count } : {}),
  };
}

/** Every location of the organization, all pages. */
async function loadAllLocations(signal: AbortSignal): Promise<LocationSummary[]> {
  const rows: LocationRow[] = [];
  for (let page = 1; ; page += 1) {
    const result = await getLocationsList({ sort: "name", order: "asc", limit: LOCATIONS_PAGE_SIZE, page }, signal);
    rows.push(...result.locations);
    if (rows.length >= result.total || result.locations.length === 0) break;
  }
  return rows.map(toLocationSummary);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(readStoredContext);
  const [activeClientId, setActiveClientId] = useState<string | null>(stored.activeClientId);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(stored.activeLocationId);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(getSelectedOrganizationId);

  const signedIn = useSyncExternalStore(subscribeToAccessToken, hasUsableSession, () => false);
  const queryClient = useQueryClient();
  useEffect(() => {
    // Drop the previous user's data on sign-out so the next login starts clean.
    if (!signedIn) queryClient.clear();
  }, [signedIn, queryClient]);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => getProfile(signal),
    enabled: signedIn,
    staleTime: 5 * 60_000,
  });

  const organizations = useMemo<Organization[]>(
    () =>
      (profile.data?.organizations ?? []).map((org) => ({
        id: org.organization_id,
        name: org.name,
        accountType: org.type,
        role: org.role,
      })),
    [profile.data],
  );
  // A remembered organization the user no longer belongs to is ignored (it would make every call 403).
  const selectedIsMember = selectedOrgId !== null && organizations.some((org) => org.id === selectedOrgId);
  const organization =
    (selectedIsMember ? organizations.find((org) => org.id === selectedOrgId) : undefined) ??
    organizations.find((org) => org.id === profile.data?.current_organization_id) ??
    organizations[0] ??
    null;

  useEffect(() => {
    if (selectedOrgId && profile.data && !selectedIsMember) {
      setSelectedOrganizationId(null);
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "profile" });
    }
  }, [selectedOrgId, selectedIsMember, profile.data, queryClient]);

  const agency = organization?.accountType === "agency";
  const orgKey = organization?.id ?? "none";
  const ready = signedIn && Boolean(organization);

  const clientsQuery = useQuery({
    // Under the shared prefixes, so adding, binding or deleting a location refreshes the header too.
    queryKey: ["clients", "workspace", orgKey],
    queryFn: async ({ signal }) => {
      try {
        return (await getClients(signal)).clients.map((client) => ({ id: client.client_id, name: client.name }));
      } catch (err) {
        if (isApiError(err) && err.reason === "agency_only") return [];
        throw err;
      }
    },
    enabled: ready && agency,
    staleTime: 60_000,
  });

  const locationsQuery = useQuery({
    queryKey: ["locations", "workspace", orgKey],
    queryFn: ({ signal }) => loadAllLocations(signal),
    enabled: ready,
    staleTime: 60_000,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeClientId, activeLocationId } satisfies StoredContext));
    } catch {
      // Persistence is a convenience only.
    }
  }, [activeClientId, activeLocationId]);

  const value = useMemo<WorkspaceValue>(() => {
    const clients = agency ? (clientsQuery.data ?? []) : [];
    const locations = locationsQuery.data ?? [];
    const loading =
      signedIn && (profile.isPending || (ready && (locationsQuery.isPending || (agency && clientsQuery.isPending))));
    const failed = signedIn && (profile.isError || locationsQuery.isError);
    return {
      status: loading ? "loading" : failed ? "unavailable" : "ready",
      organization,
      organizations,
      clients,
      activeClient: clients.find((client) => client.id === activeClientId) ?? null,
      locations,
      activeLocation: locations.find((location) => location.id === activeLocationId) ?? null,
      setOrganizationId: (id) => {
        if (id === organization?.id) return;
        setSelectedOrganizationId(id);
        setSelectedOrgId(id);
        setActiveClientId(null);
        setActiveLocationId(null);
        // Everything cached belongs to the previous organization.
        void queryClient.resetQueries({ predicate: (query) => query.queryKey[0] !== "profile" });
      },
      setActiveClientId,
      setActiveLocationId,
    };
  }, [
    agency,
    clientsQuery.data,
    clientsQuery.isPending,
    locationsQuery.data,
    locationsQuery.isPending,
    locationsQuery.isError,
    signedIn,
    ready,
    profile.isPending,
    profile.isError,
    organization,
    organizations,
    activeClientId,
    activeLocationId,
    queryClient,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

/** Account type drives whether client/portfolio surfaces are shown. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAccountType(): AccountType {
  const { organization } = useWorkspace();
  return organization?.accountType ?? "business";
}
