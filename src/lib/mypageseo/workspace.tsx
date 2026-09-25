import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AccountType } from "./navigation";
import { DEMO_CLIENTS, DEMO_LOCATIONS, DEMO_ORGANIZATIONS } from "./demo/entities";
import { useOnboardingSession } from "../auth-lib/onboarding-state";

export type Organization = {
  id: string;
  name: string;
  accountType: AccountType;
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

type WorkspaceValue = {
  status: WorkspaceStatus;
  organization: Organization | null;
  clients: Client[];
  activeClient: Client | null;
  locations: LocationSummary[];
  activeLocation: LocationSummary | null;
  setAccountType: (type: AccountType) => void;
  setActiveClientId: (id: string | null) => void;
  setActiveLocationId: (id: string | null) => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/**
 * Representative workspace context (organization -> client -> location).
 *
 * The backend that supplies organizations, clients and locations is not wired
 * into this frontend yet. These values stand in for the shape of that response
 * so every screen can be built against the real structure; replace this
 * provider's body with the backend read when it is available.
 */
const REPRESENTATIVE_ORG: Record<AccountType, Organization> = {
  business: { id: DEMO_ORGANIZATIONS.business.id, name: DEMO_ORGANIZATIONS.business.name, accountType: "business" },
  agency: { id: DEMO_ORGANIZATIONS.agency.id, name: DEMO_ORGANIZATIONS.agency.name, accountType: "agency" },
};

const AGENCY_CLIENTS: Client[] = DEMO_CLIENTS.map((client) => ({
  id: client.id,
  name: client.name,
}));

const BUSINESS_LOCATIONS: LocationSummary[] = DEMO_LOCATIONS.filter(
  (location) => location.clientId === "cl_riverside",
).map((location) => ({
  id: location.id,
  businessName: location.businessName,
  area: location.area,
  rating: location.rating,
  reviewCount: location.reviewCount,
}));

const AGENCY_LOCATIONS: LocationSummary[] = DEMO_LOCATIONS.map((location) => ({
  id: location.id,
  clientId: location.clientId,
  businessName: location.businessName,
  area: location.area,
  rating: location.rating,
  reviewCount: location.reviewCount,
}));

const DEFAULT_BUSINESS_LOCATION_ID = "loc_riverside_north";

/**
 * Frontend-only persistence of the selected workspace context, so a refresh or
 * a direct link keeps the same organization, client and location. Replace with
 * the backend account read when it is available.
 */
const STORAGE_KEY = "mypageseo.workspace-context";

type StoredContext = {
  accountType: AccountType;
  activeClientId: string | null;
  activeLocationId: string | null;
};

function readStoredContext(): StoredContext | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredContext>;
    if (parsed.accountType !== "business" && parsed.accountType !== "agency") return null;
    return {
      accountType: parsed.accountType,
      activeClientId: typeof parsed.activeClientId === "string" ? parsed.activeClientId : null,
      activeLocationId: typeof parsed.activeLocationId === "string" ? parsed.activeLocationId : null,
    };
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // SPA: no server render to match, so read storage once, synchronously,
  // in the initial state. Replaces the old post-hydration restore effect.
  const [stored] = useState(readStoredContext);
  const [accountType, setAccountType] = useState<AccountType>(stored?.accountType ?? "business");
  const [activeClientId, setActiveClientId] = useState<string | null>(
    stored ? stored.activeClientId : null,
  );
  const [activeLocationId, setActiveLocationId] = useState<string | null>(
    stored ? stored.activeLocationId : DEFAULT_BUSINESS_LOCATION_ID,
  );

  // Completed setup decides which account type, client and location the
  // product opens in. Replace with the backend account read when available.
  const session = useOnboardingSession();
  useEffect(() => {
    if (!session?.finishedAt) return;
    setAccountType(session.accountType);
    setActiveClientId(session.progress.clientId);
    if (session.progress.selectedProfileId) setActiveLocationId(session.progress.selectedProfileId);
  }, [session]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ accountType, activeClientId, activeLocationId } satisfies StoredContext),
      );
    } catch {
      // Persistence is a convenience only; ignore storage failures.
    }
  }, [accountType, activeClientId, activeLocationId]);

  const value = useMemo<WorkspaceValue>(() => {
    const configuredName = session?.finishedAt
      ? session.progress.organization.organizationName.trim()
      : "";
    const clients = accountType === "agency" ? AGENCY_CLIENTS : [];
    const organization = {
      ...REPRESENTATIVE_ORG[accountType],
      ...(configuredName ? { name: configuredName } : {}),
    };
    const locations = accountType === "agency" ? AGENCY_LOCATIONS : BUSINESS_LOCATIONS;
    return {
      status: "ready",
      organization,
      clients,
      activeClient: clients.find((c) => c.id === activeClientId) ?? null,
      locations,
      activeLocation: locations.find((l) => l.id === activeLocationId) ?? null,
      setAccountType: (type) => {
        setAccountType(type);
        setActiveClientId(null);
        setActiveLocationId(type === "business" ? DEFAULT_BUSINESS_LOCATION_ID : null);
      },
      setActiveClientId,
      setActiveLocationId,
    };
  }, [accountType, activeClientId, activeLocationId, session]);

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
