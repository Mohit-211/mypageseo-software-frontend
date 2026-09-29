/**
 * Demo dataset for the Citations screens. One record per directory, derived
 * from the shared demo location facts so summary totals reconcile with
 * `citationTotal` / `citationIssues` / `citationHealth`.
 */
import { demoDate, pickInt, rng, seedFrom } from "./demo-mode";
import { DEMO_DIRECTORIES, demoLocation, type DemoLocationFacts } from "./entities";
import type {
  Citation,
  CitationDetailData,
  CitationDiscrepancy,
  CitationHistoryEvent,
  CitationIssue,
  CitationNap,
  CitationState,
  CitationsCapabilities,
  CitationsData,
} from "@/lib/citations/citations";

const DIRECTORY_TYPE: Record<string, string> = {
  "Google Business Profile": "Search engine",
  "Apple Business Connect": "Search engine",
  "Bing Places": "Search engine",
  Yelp: "Review site",
  Facebook: "Social",
  Foursquare: "Social",
  "Better Business Bureau": "Trust directory",
  "Yellow Pages": "General directory",
  MapQuest: "Maps",
  Nextdoor: "Social",
  Superpages: "General directory",
  "Chamber of Commerce": "Trust directory",
  Citysearch: "General directory",
  Manta: "General directory",
  Hotfrog: "General directory",
  Angi: "Review site",
  Brownbook: "General directory",
  "Local.com": "General directory",
  "Data Axle": "Data aggregator",
  "Neustar Localeze": "Data aggregator",
  Infogroup: "Data aggregator",
  Factual: "Data aggregator",
};

const AUTHORITY_OVERRIDES: Record<string, number> = {
  "Google Business Profile": 99,
  "Apple Business Connect": 92,
  "Bing Places": 88,
  Yelp: 90,
  Facebook: 91,
  Foursquare: 74,
  "Better Business Bureau": 82,
  "Data Axle": 76,
  "Neustar Localeze": 71,
};

function directoryType(name: string): string {
  return DIRECTORY_TYPE[name] ?? "Data aggregator";
}

function directoryAuthority(name: string): number {
  return AUTHORITY_OVERRIDES[name] ?? pickInt(seedFrom("directory-authority", name), 35, 78);
}

function priorityFor(authority: number): "high" | "medium" | "low" {
  if (authority >= 80) return "high";
  if (authority >= 50) return "medium";
  return "low";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function expectedNapFor(location: DemoLocationFacts): CitationNap {
  return {
    name: location.businessName,
    address: `${location.street}, ${location.city}, ${location.state} ${location.postalCode}`,
    phone: location.phone,
    website: location.website,
  };
}

function withoutSuite(address: string): string {
  return address.replace(/,\s*(Suite|Ste\.?)\s*[\w-]+/i, "");
}

function oldPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  const line = (parseInt(digits.slice(6), 10) + 41) % 10000;
  return `(${area}) ${exchange}-${String(line).padStart(4, "0")}`;
}

function expandStreetAbbrev(address: string): string {
  return address
    .replace(/\bRd\b\.?/, "Road")
    .replace(/\bAve\b\.?/, "Avenue")
    .replace(/\bBlvd\b\.?/, "Boulevard")
    .replace(/\bSt\b\.?/, "Street");
}

function applyDiscrepancy(profile: number, expected: CitationNap): { nap: CitationNap; discrepancies: CitationDiscrepancy[] } {
  switch (profile % 5) {
    case 0: {
      const found = expected.address ? withoutSuite(expected.address) : expected.address;
      if (found === expected.address) return applyDiscrepancy(1, expected);
      return { nap: { ...expected, address: found }, discrepancies: [{ field: "address", expected: expected.address, found }] };
    }
    case 1: {
      const found = expected.phone ? oldPhone(expected.phone) : expected.phone;
      return { nap: { ...expected, phone: found }, discrepancies: [{ field: "phone", expected: expected.phone, found }] };
    }
    case 2: {
      const found = expected.address ? expandStreetAbbrev(expected.address) : expected.address;
      if (found === expected.address) return applyDiscrepancy(0, expected);
      return { nap: { ...expected, address: found }, discrepancies: [{ field: "address", expected: expected.address, found }] };
    }
    case 3: {
      const found = expected.name ? expected.name.replace(" — ", " - ") : expected.name;
      if (found === expected.name) return applyDiscrepancy(1, expected);
      return { nap: { ...expected, name: found }, discrepancies: [{ field: "name", expected: expected.name, found }] };
    }
    default: {
      const found = expected.website ? expected.website.replace("https://", "http://").replace(/\/$/, "") : expected.website;
      if (found === expected.website) return applyDiscrepancy(0, expected);
      return { nap: { ...expected, website: found }, discrepancies: [{ field: "website", expected: expected.website, found }] };
    }
  }
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  const random = rng(seed);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = arr[i] as T;
    const b = arr[j] as T;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

function buildStatePlan(location: DemoLocationFacts): CitationState[] {
  const total = location.citationTotal;
  const issues = location.citationIssues;
  let inconsistentCount = Math.round(issues * 0.5);
  let missingCount = Math.round(issues * 0.3);
  let duplicateCount = Math.round(issues * 0.15);
  let pendingCount = issues - inconsistentCount - missingCount - duplicateCount;
  if (pendingCount < 0) {
    inconsistentCount += pendingCount;
    pendingCount = 0;
  }
  const correctCount = Math.max(0, total - inconsistentCount - missingCount - duplicateCount - pendingCount);
  const plan: CitationState[] = [
    ...Array(correctCount).fill("correct" as const),
    ...Array(inconsistentCount).fill("inconsistent" as const),
    ...Array(missingCount).fill("missing" as const),
    ...Array(duplicateCount).fill("duplicate" as const),
    ...Array(pendingCount).fill("pending" as const),
  ];
  return deterministicShuffle(plan, seedFrom(location.id, "citation-state-order"));
}

export function demoCitations(locationId?: string | null): Citation[] {
  const location = demoLocation(locationId);
  const plan = buildStatePlan(location);
  const directories = DEMO_DIRECTORIES.slice(0, plan.length);
  const expected = expectedNapFor(location);
  const slug = slugify(location.businessName);

  return directories.map((directory, index) => {
    const state = plan[index]!;
    const seed = seedFrom(location.id, directory, index);
    const authority = directoryAuthority(directory);
    const id = `cit_${location.id}_${index + 1}`;

    if (state === "missing") {
      const campaignOptions = ["ordered", "submitted", "todo"] as const;
      return {
        id,
        directory,
        directoryType: directoryType(directory),
        state,
        campaignState: campaignOptions[index % campaignOptions.length]!,
        nap: { name: null, address: null, phone: null, website: null },
        discrepancies: [],
        authority,
        priority: priorityFor(authority),
        lastChecked: demoDate(pickInt(seed, 2, 21)),
        listingUrl: null,
      } satisfies Citation;
    }

    if (state === "pending") {
      return {
        id,
        directory,
        directoryType: directoryType(directory),
        state,
        campaignState: "pending",
        nap: { name: null, address: null, phone: null, website: null },
        discrepancies: [],
        authority,
        priority: priorityFor(authority),
        lastChecked: null,
        listingUrl: null,
      } satisfies Citation;
    }

    if (state === "duplicate") {
      const found = expected.name ? `${expected.name} (2)` : expected.name;
      return {
        id,
        directory,
        directoryType: directoryType(directory),
        state,
        campaignState: null,
        nap: { ...expected, name: found },
        discrepancies: [{ field: "name", expected: expected.name, found }],
        authority,
        priority: priorityFor(authority),
        lastChecked: demoDate(pickInt(seed, 2, 45)),
        listingUrl: `https://www.${slugify(directory)}.com/biz/${slug}-duplicate`,
      } satisfies Citation;
    }

    if (state === "inconsistent") {
      const { nap, discrepancies } = applyDiscrepancy(index, expected);
      return {
        id,
        directory,
        directoryType: directoryType(directory),
        state,
        campaignState: null,
        nap,
        discrepancies,
        authority,
        priority: priorityFor(authority),
        lastChecked: demoDate(pickInt(seed, 1, 30)),
        listingUrl: `https://www.${slugify(directory)}.com/biz/${slug}`,
      } satisfies Citation;
    }

    return {
      id,
      directory,
      directoryType: directoryType(directory),
      state: "correct",
      campaignState: null,
      nap: expected,
      discrepancies: [],
      authority,
      priority: priorityFor(authority),
      lastChecked: demoDate(pickInt(seed, 1, 30)),
      listingUrl: `https://www.${slugify(directory)}.com/biz/${slug}`,
    } satisfies Citation;
  });
}

const CAPABILITIES: CitationsCapabilities = {
  canScan: true,
  canSearch: true,
  canFilterByDate: true,
  canFixListing: true,
  canRunCampaign: true,
};

export function demoCitationsData(locationId?: string | null): CitationsData {
  const location = demoLocation(locationId);
  const citations = demoCitations(locationId);
  const correct = citations.filter((c) => c.state === "correct").length;
  const inconsistent = citations.filter((c) => c.state === "inconsistent").length;
  const missing = citations.filter((c) => c.state === "missing").length;
  const duplicate = citations.filter((c) => c.state === "duplicate").length;
  const recentlyChanged = citations.filter((c) => c.state !== "correct" && c.lastChecked && c.lastChecked >= demoDate(10)).length;

  const flagged = citations.filter((c) => c.state !== "correct" && c.state !== "pending").slice(0, 5);
  const issues: CitationIssue[] = flagged.map((citation) => {
    if (citation.state === "missing") {
      return {
        id: `issue_${citation.id}`,
        title: `${citation.directory} listing is missing`,
        detail: `No listing was found for ${location.businessName} on ${citation.directory}. Add this location to close the gap.`,
        severity: "critical",
        citationId: citation.id,
      };
    }
    if (citation.state === "duplicate") {
      return {
        id: `issue_${citation.id}`,
        title: `Duplicate listing detected on ${citation.directory}`,
        detail: `A second listing for ${location.businessName} appears on ${citation.directory} and should be merged or removed.`,
        severity: "warning",
        citationId: citation.id,
      };
    }
    const field = citation.discrepancies[0]?.field ?? "information";
    return {
      id: `issue_${citation.id}`,
      title: `${field} mismatch on ${citation.directory}`,
      detail: `The ${field} listed on ${citation.directory} does not match your stored business information.`,
      severity: "warning",
      citationId: citation.id,
    };
  });

  return {
    status: "ready",
    lastCheckedAt: demoDate(1),
    summary: {
      checked: location.citationTotal,
      correct,
      inconsistent,
      missing,
      duplicate,
      recentlyChanged,
    },
    citations,
    issues,
    capabilities: CAPABILITIES,
  };
}

function buildHistory(citation: Citation, location: DemoLocationFacts): CitationHistoryEvent[] {
  const seed = seedFrom(location.id, citation.id, "history");
  const events: CitationHistoryEvent[] = [
    {
      id: `${citation.id}_h1`,
      occurredAt: demoDate(pickInt(seed, 90, 160)),
      label: "Listing first discovered",
      detail: `${citation.directory} listing indexed during initial directory sweep.`,
      state: "pending",
    },
  ];
  if (citation.state === "inconsistent" || citation.state === "duplicate") {
    events.push({
      id: `${citation.id}_h2`,
      occurredAt: demoDate(pickInt(seed + 1, 45, 89)),
      label: "Listing verified",
      detail: "Listing matched stored business information at time of check.",
      state: "correct",
    });
  }
  events.push({
    id: `${citation.id}_h3`,
    occurredAt: citation.lastChecked ?? demoDate(1),
    label: citation.state === "missing" ? "Listing not found in latest scan" : citation.state === "duplicate" ? "Duplicate listing detected" : citation.state === "inconsistent" ? "Discrepancy detected" : "Listing re-verified",
    detail: citation.discrepancies[0] ? `${citation.discrepancies[0].field} now reads "${citation.discrepancies[0].found ?? "unavailable"}".` : null,
    state: citation.state,
  });
  return events;
}

export function demoCitationDetail(citationId: string, locationId?: string | null): CitationDetailData {
  const location = demoLocation(locationId);
  const citations = demoCitations(locationId);
  const citation = citations.find((item) => item.id === citationId) ?? null;

  if (!citation) {
    return {
      status: "not_found",
      citation: null,
      expectedNap: null,
      category: null,
      history: null,
      issues: [],
      capabilities: CAPABILITIES,
    };
  }

  const issues: CitationIssue[] = citation.discrepancies.map((discrepancy) => ({
    id: `${citation.id}_${discrepancy.field}`,
    title: `${discrepancy.field} does not match your record`,
    detail: `Detected "${discrepancy.found ?? "no value"}" but your stored record has "${discrepancy.expected ?? "no value"}".`,
    severity: "warning",
    citationId: citation.id,
  }));

  return {
    status: "ready",
    citation,
    expectedNap: expectedNapFor(location),
    category: location.primaryCategory,
    history: buildHistory(citation, location),
    issues,
    capabilities: CAPABILITIES,
  };
}
