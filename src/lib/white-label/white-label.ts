import { useEffect, useSyncExternalStore } from "react";
import type { StatusTone } from "@/components/layout/shared/data-display";
import {
  DEMO_AGENCY_BRANDING,
  DEMO_AGENCY_CLIENTS,
  DEMO_AGENCY_SLUG,
  DEMO_EMAIL_BRANDING,
  DEMO_REPORT_ACCESS,
  demoClientReports,
  demoDomainSettings,
  demoReportPreview,
} from "../mypageseo/demo/white-label";

/* -------------------------------------------------------------------------- */
/* Contract                                                                   */
/*                                                                            */
/* Shapes the white-label backend is expected to return. Components only read */
/* these types, so connecting the real branding, domain and client report     */
/* APIs means replacing the store's loaders/actions below — not components.   */
/* -------------------------------------------------------------------------- */

export type ButtonStyle = "rounded" | "medium" | "square";

/** Fonts already loaded by the app, so previews render exactly as saved. */
export type BrandFont = "plex" | "system" | "serif";

export type AgencyBranding = {
  agencyName: string;
  /** Hosted asset URL (a local data URL until upload storage is connected). */
  logoUrl: string | null;
  logoFileName: string | null;
  faviconUrl: string | null;
  faviconFileName: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  buttonStyle: ButtonStyle;
  font: BrandFont;
  footerText: string;
  contactEmail: string;
  website: string;
  /** Hide the MyPageSEO logo, name and promotional links on client-facing pages. */
  hidePlatformBranding: boolean;
};

export type DomainStatus = "not_connected" | "pending_verification" | "connected" | "ssl_pending" | "failed";

export type SslStatus = "active" | "pending" | "none";

export type DnsRecord = { type: "CNAME" | "TXT"; host: string; value: string };

export type CustomDomain = {
  hostname: string;
  status: DomainStatus;
  sslStatus: SslStatus;
  records: DnsRecord[];
  lastCheckedAt: string | null;
  connectedAt: string | null;
};

export type DomainSettings = {
  defaultDomain: string;
  defaultDomainStatus: DomainStatus;
  customDomain: CustomDomain | null;
};

export type AgencyClient = {
  id: string;
  name: string;
  slug: string;
  category: string;
  city: string;
};

export type ReportModule = "gbp" | "ai_visibility" | "reviews" | "posts" | "seo";

export type ReportStatus = "published" | "draft" | "disabled";

export type ReportVisibility = "public" | "password" | "private";

/** "default" renders a neutral theme with no agency logo or colours. */
export type ReportBrandingMode = "agency" | "default";

export type ClientReport = {
  id: string;
  clientId: string;
  status: ReportStatus;
  modules: ReportModule[];
  visibility: ReportVisibility;
  branding: ReportBrandingMode;
  createdAt: string;
  updatedAt: string;
};

export type ReportExpiration = "never" | "7d" | "30d" | "custom";

/** Agency-wide defaults for how clients reach their reports. */
export type ReportAccessSettings = {
  visibility: ReportVisibility;
  expiration: ReportExpiration;
  /** ISO date (yyyy-MM-dd) when `expiration` is "custom". */
  customExpiresOn: string | null;
  allowDownload: boolean;
  allowClientSharing: boolean;
};

export type EmailBranding = {
  senderName: string;
  senderEmail: string;
  /** Null = use the agency logo. */
  logoUrl: string | null;
  logoFileName: string | null;
  footer: string;
};

/** Everything a client-facing report renders (Get Report Preview). */
export type ReportPreviewData = {
  clientId: string;
  periodStart: string;
  rating: number;
  ratingChange: number;
  totalReviews: number;
  newReviews: number;
  responseRate: number;
  ratingDistribution: { stars: number; count: number }[];
  aiScore: number;
  aiScoreChange: number;
  aiPlatforms: { platform: string; visibility: number }[];
  aiMentions: number;
  gbp: {
    views: number;
    viewsChange: number;
    calls: number;
    callsChange: number;
    directions: number;
    directionsChange: number;
    websiteClicks: number;
    websiteClicksChange: number;
  };
  monthlyViews: { month: string; views: number }[];
  postsPublished: number;
  postViews: number;
  postClicks: number;
  topPosts: { id: string; title: string; publishedAt: string; views: number; clicks: number }[];
  recentReviews: { id: string; author: string; rating: number; text: string; createdAt: string }[];
  seo: { trackedKeywords: number; top3Keywords: number; averagePosition: number; averagePositionChange: number };
};

export type CreateClientReportInput = {
  clientId: string;
  modules: ReportModule[];
  visibility: Extract<ReportVisibility, "public" | "password">;
  password: string | null;
  branding: ReportBrandingMode;
};

/* -------------------------------------------------------------------------- */
/* Labels                                                                     */
/* -------------------------------------------------------------------------- */

export const DOMAIN_STATUS_LABEL: Record<DomainStatus, string> = {
  not_connected: "Not Connected",
  pending_verification: "Pending Verification",
  connected: "Connected",
  ssl_pending: "SSL Pending",
  failed: "Connection Failed",
};

export const DOMAIN_STATUS_TONE: Record<DomainStatus, StatusTone> = {
  not_connected: "neutral",
  pending_verification: "warning",
  connected: "success",
  ssl_pending: "info",
  failed: "critical",
};

export const DOMAIN_STATUS_DESCRIPTION: Record<DomainStatus, string> = {
  not_connected: "No custom domain has been added.",
  pending_verification: "Waiting for the DNS record to be detected.",
  connected: "Verified and serving reports over HTTPS.",
  ssl_pending: "Verified. The SSL certificate is being issued.",
  failed: "The DNS record could not be verified. Check the record and try again.",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  published: "Published",
  draft: "Draft",
  disabled: "Disabled",
};

export const REPORT_STATUS_TONE: Record<ReportStatus, StatusTone> = {
  published: "success",
  draft: "neutral",
  disabled: "critical",
};

export const REPORT_MODULES: ReportModule[] = ["gbp", "ai_visibility", "reviews", "posts", "seo"];

export const REPORT_MODULE_LABEL: Record<ReportModule, string> = {
  gbp: "Google Business Profile",
  ai_visibility: "AI Visibility",
  reviews: "Review Management",
  posts: "Post Performance",
  seo: "SEO Performance",
};

export const REPORT_VISIBILITY_LABEL: Record<ReportVisibility, string> = {
  public: "Public Link",
  password: "Password Protected",
  private: "Private",
};

export const REPORT_EXPIRATION_LABEL: Record<ReportExpiration, string> = {
  never: "Never",
  "7d": "7 Days",
  "30d": "30 Days",
  custom: "Custom",
};

export const BUTTON_STYLE_LABEL: Record<ButtonStyle, string> = {
  rounded: "Rounded",
  medium: "Medium",
  square: "Square",
};

export const BUTTON_STYLE_RADIUS: Record<ButtonStyle, string> = {
  rounded: "9999px",
  medium: "8px",
  square: "2px",
};

export const BRAND_FONT_LABEL: Record<BrandFont, string> = {
  plex: "IBM Plex Sans (default)",
  system: "System Sans",
  serif: "Serif",
};

export const BRAND_FONT_FAMILY: Record<BrandFont, string> = {
  plex: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
};

/** Starting values when an agency has not configured branding yet. */
export const EMPTY_BRANDING: AgencyBranding = {
  agencyName: "",
  logoUrl: null,
  logoFileName: null,
  faviconUrl: null,
  faviconFileName: null,
  primaryColor: "#000000",
  secondaryColor: "#FFFFFF",
  accentColor: "#3B82F6",
  buttonStyle: "medium",
  font: "plex",
  footerText: "",
  contactEmail: "",
  website: "",
  hidePlatformBranding: true,
};

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export const AGENCY_NAME_MAX_LENGTH = 80;

/** Example shown in the custom domain input. */
export const CUSTOM_DOMAIN_PLACEHOLDER = "reports.abcmarketing.com";

export type ImageRules = { types: string[]; extensions: string; maxBytes: number };

export const LOGO_RULES: ImageRules = {
  types: ["image/png", "image/jpeg", "image/svg+xml"],
  extensions: "PNG, JPG or SVG",
  maxBytes: 5 * 1024 * 1024,
};

export const FAVICON_RULES: ImageRules = {
  types: ["image/png", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"],
  extensions: "PNG, SVG or ICO",
  maxBytes: 1024 * 1024,
};

export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function validateImage(file: File, rules: ImageRules): string | null {
  if (!rules.types.includes(file.type)) return `Upload a ${rules.extensions} file.`;
  if (file.size > rules.maxBytes) return `The file is larger than ${formatBytes(rules.maxBytes)}.`;
  return null;
}

const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = (value: string) => HEX.test(value);

/** Accepts "abc", "#abc" or "#aabbcc"; returns "#AABBCC" or null. */
export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw.split("").map((c) => c + c).join("")}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toUpperCase();
  return null;
}

/** Near-black or white, whichever reads better on the given background. */
export function readableTextColor(hex: string) {
  if (!isHexColor(hex)) return "#0F172A";
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#0F172A" : "#FFFFFF";
}

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export function isValidWebsite(value: string) {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Accepts "reports.example.com" (optionally pasted with a scheme or path); returns the bare host or null. */
export function normalizeHostname(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const host = new URL(/^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`).hostname;
    return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(host) && /\.[a-z]{2,}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

export type BrandingErrors = Partial<Record<"agencyName" | "contactEmail" | "website" | "primaryColor" | "secondaryColor" | "accentColor", string>>;

export function validateBranding(branding: AgencyBranding): BrandingErrors {
  const errors: BrandingErrors = {};
  const name = branding.agencyName.trim();
  if (!name) errors.agencyName = "Enter your agency name.";
  else if (name.length > AGENCY_NAME_MAX_LENGTH) errors.agencyName = `Use ${AGENCY_NAME_MAX_LENGTH} characters or fewer.`;
  if (branding.contactEmail.trim() && !isValidEmail(branding.contactEmail)) errors.contactEmail = "Enter a valid email address.";
  if (branding.website.trim() && !isValidWebsite(branding.website)) errors.website = "Enter a full URL, e.g. https://example.com.";
  for (const key of ["primaryColor", "secondaryColor", "accentColor"] as const) {
    if (!isHexColor(branding[key])) errors[key] = "Use a 6-digit hex colour, e.g. #1D4ED8.";
  }
  return errors;
}

/* -------------------------------------------------------------------------- */
/* Derived values                                                             */
/* -------------------------------------------------------------------------- */

/** Theme applied to a client-facing report. Never contains MyPageSEO assets. */
export type ReportTheme = {
  agencyName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  buttonStyle: ButtonStyle;
  font: BrandFont;
  footerText: string;
  contactEmail: string;
  website: string;
  /** Show the "Powered by MyPageSEO" credit (only when the agency has not hidden it). */
  showPlatformCredit: boolean;
};

const NEUTRAL_THEME = {
  primaryColor: "#1F2937",
  secondaryColor: "#F3F4F6",
  accentColor: "#2563EB",
  buttonStyle: "medium",
  font: "system",
} as const;

export function reportTheme(branding: AgencyBranding | null, mode: ReportBrandingMode = "agency"): ReportTheme {
  const source = branding ?? EMPTY_BRANDING;
  const base = {
    agencyName: source.agencyName.trim() || "Your Agency",
    faviconUrl: source.faviconUrl,
    footerText: source.footerText.trim() || source.agencyName.trim(),
    contactEmail: source.contactEmail.trim(),
    website: source.website.trim(),
    showPlatformCredit: !source.hidePlatformBranding,
  };
  if (mode === "default" || !branding) return { ...base, ...NEUTRAL_THEME, logoUrl: null };
  return {
    ...base,
    logoUrl: source.logoUrl,
    primaryColor: source.primaryColor,
    secondaryColor: source.secondaryColor,
    accentColor: source.accentColor,
    buttonStyle: source.buttonStyle,
    font: source.font,
  };
}

/** The domain client reports are served from right now. */
export function activeReportDomain(domain: DomainSettings): { hostname: string; custom: boolean } {
  const custom = domain.customDomain;
  if (custom && custom.status === "connected") return { hostname: custom.hostname, custom: true };
  return { hostname: domain.defaultDomain, custom: false };
}

/** Report URL without the scheme, as shown in the UI (e.g. googleprofile.report/abc-digital/xyz-restaurant). */
export function reportPath(domain: DomainSettings, agencySlug: string, client: Pick<AgencyClient, "slug">): string {
  const active = activeReportDomain(domain);
  // A custom domain belongs to one agency, so it does not need the agency segment.
  return active.custom ? `${active.hostname}/${client.slug}` : `${active.hostname}/${agencySlug}/${client.slug}`;
}

export const withScheme = (path: string) => `https://${path}`;

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function summarizeWhiteLabel(state: Pick<WhiteLabelSnapshot, "branding" | "clients" | "reports" | "domain">) {
  const published = state.reports.filter((r) => r.status === "published");
  const branded = state.branding ? published.filter((r) => r.branding === "agency") : [];
  const custom = state.domain.customDomain;
  return {
    activeClients: state.clients.length,
    clientsWithReports: new Set(state.reports.map((r) => r.clientId)).size,
    published: published.length,
    drafts: state.reports.filter((r) => r.status === "draft").length,
    disabled: state.reports.filter((r) => r.status === "disabled").length,
    branded: branded.length,
    domain: activeReportDomain(state.domain),
    domainStatus: state.domain.defaultDomainStatus,
    customDomainStatus: custom?.status ?? ("not_connected" as DomainStatus),
    sslStatus: (custom && custom.status === "connected" ? custom.sslStatus : "active") as SslStatus,
  };
}

export type WhiteLabelSummary = ReturnType<typeof summarizeWhiteLabel>;

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/*                                                                            */
/* No white-label service is connected yet, so settings live in a frontend-   */
/* only store seeded with demo data. Each action names the API it stands in   */
/* for; replace its body with the backend call when available. Uploads are    */
/* read locally as data URLs and never leave the browser.                     */
/* -------------------------------------------------------------------------- */

export type WhiteLabelSnapshot = {
  status: "loading" | "ready";
  agencySlug: string;
  /** Null until the agency configures branding. */
  branding: AgencyBranding | null;
  domain: DomainSettings;
  clients: AgencyClient[];
  reports: ClientReport[];
  access: ReportAccessSettings;
  email: EmailBranding;
  verifyingDomain: boolean;
};

/** `?scenario=new` opens the page as a brand-new agency, to review the empty states. */
export type WhiteLabelScenario = "demo" | "new";

let state: WhiteLabelSnapshot = {
  status: "loading",
  agencySlug: DEMO_AGENCY_SLUG,
  branding: null,
  domain: demoDomainSettings(),
  clients: [],
  reports: [],
  access: DEMO_REPORT_ACCESS,
  email: DEMO_EMAIL_BRANDING,
  verifyingDomain: false,
};
let loadStarted = false;
const listeners = new Set<() => void>();

function setState(patch: Partial<WhiteLabelSnapshot> | ((current: WhiteLabelSnapshot) => Partial<WhiteLabelSnapshot>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const LOAD_MS = 700;
const SAVE_MS = 900;
const UPLOAD_MS = 700;
const VERIFY_MS = 1600;

/** Stands in for: Get Agency Branding, Get Domain Settings, Get Client Reports. */
function ensureLoaded(scenario: WhiteLabelScenario) {
  if (loadStarted) return;
  loadStarted = true;
  window.setTimeout(() => {
    const fresh = scenario === "new";
    setState({
      status: "ready",
      branding: fresh ? null : DEMO_AGENCY_BRANDING,
      domain: demoDomainSettings(),
      clients: DEMO_AGENCY_CLIENTS,
      reports: fresh ? [] : demoClientReports(),
    });
  }, LOAD_MS);
}

export function useWhiteLabel(scenario: WhiteLabelScenario = "demo") {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => ensureLoaded(scenario), [scenario]);
  return snapshot;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

const now = () => new Date().toISOString();

function dnsRecordsFor(hostname: string, agencySlug: string): DnsRecord[] {
  const sub = hostname.split(".").slice(0, -2).join(".") || "@";
  return [
    { type: "CNAME", host: sub, value: `${agencySlug}.cname.googleprofile.report` },
    { type: "TXT", host: `_wl-verify.${sub === "@" ? hostname : sub}`, value: `wl-verify=${agencySlug}-${hostname.length.toString(16)}7c9d` },
  ];
}

export const whiteLabelActions = {
  /** Update Agency Branding. */
  async updateBranding(branding: AgencyBranding) {
    await delay(SAVE_MS);
    const saved: AgencyBranding = {
      ...branding,
      agencyName: branding.agencyName.trim(),
      footerText: branding.footerText.trim(),
      contactEmail: branding.contactEmail.trim(),
      website: branding.website.trim(),
    };
    setState({ branding: saved });
    return saved;
  },

  /** Removes the agency branding; client reports fall back to the neutral theme. */
  async removeBranding() {
    await delay(SAVE_MS);
    setState({ branding: null });
  },

  /** Upload Agency Logo. Returns the hosted URL (a local data URL for now). */
  async uploadLogo(file: File) {
    const [url] = await Promise.all([readAsDataUrl(file), delay(UPLOAD_MS)]);
    return url;
  },

  /** Upload Favicon. */
  async uploadFavicon(file: File) {
    const [url] = await Promise.all([readAsDataUrl(file), delay(UPLOAD_MS)]);
    return url;
  },

  /** Connect Custom Domain. Starts in "Pending Verification"; no DNS is touched. */
  async connectCustomDomain(hostname: string) {
    await delay(SAVE_MS);
    setState((s) => ({
      domain: {
        ...s.domain,
        customDomain: {
          hostname,
          status: "pending_verification",
          sslStatus: "none",
          records: dnsRecordsFor(hostname, s.agencySlug),
          lastCheckedAt: null,
          connectedAt: null,
        },
      },
    }));
  },

  /**
   * Verify Domain. The demo advances one step per check
   * (pending verification → SSL pending → connected).
   */
  async verifyDomain() {
    if (state.verifyingDomain || !state.domain.customDomain) return;
    setState({ verifyingDomain: true });
    await delay(VERIFY_MS);
    setState((s) => {
      const current = s.domain.customDomain;
      if (!current) return { verifyingDomain: false };
      const next: CustomDomain =
        current.status === "pending_verification" || current.status === "failed"
          ? { ...current, status: "ssl_pending", sslStatus: "pending", lastCheckedAt: now() }
          : { ...current, status: "connected", sslStatus: "active", lastCheckedAt: now(), connectedAt: current.connectedAt ?? now() };
      return { verifyingDomain: false, domain: { ...s.domain, customDomain: next } };
    });
  },

  async removeCustomDomain() {
    await delay(SAVE_MS / 2);
    setState((s) => ({ domain: { ...s.domain, customDomain: null } }));
  },

  /** Create Client Report. New reports start as drafts until published. */
  async createClientReport(input: CreateClientReportInput) {
    await delay(SAVE_MS);
    const report: ClientReport = {
      id: `wl_report_${input.clientId}_${Date.now().toString(36)}`,
      clientId: input.clientId,
      status: "draft",
      modules: REPORT_MODULES.filter((m) => input.modules.includes(m)),
      visibility: input.visibility,
      branding: input.branding,
      createdAt: now(),
      updatedAt: now(),
    };
    setState((s) => ({ reports: [report, ...s.reports.filter((r) => r.clientId !== input.clientId)] }));
    return report;
  },

  /** Update Client Report (publish, re-enable, change modules or visibility). */
  async updateClientReport(id: string, patch: Partial<Pick<ClientReport, "status" | "modules" | "visibility" | "branding">>) {
    await delay(SAVE_MS / 2);
    setState((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: now() } : r)) }));
  },

  /** Disable Client Report. The link stops working for the client. */
  async disableClientReport(id: string) {
    await delay(SAVE_MS / 2);
    setState((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, status: "disabled", updatedAt: now() } : r)) }));
  },

  /** Get Report Preview. Synchronous here; becomes a query when the API lands. */
  getReportPreview(client: AgencyClient): ReportPreviewData {
    return demoReportPreview(client, new Date());
  },

  /**
   * Update Report Access. `password` (null = keep the current one) belongs in
   * the request body only; it is never kept in frontend state.
   */
  async updateReportAccess(input: ReportAccessSettings & { password: string | null }) {
    await delay(SAVE_MS);
    const { visibility, expiration, customExpiresOn, allowDownload, allowClientSharing } = input;
    setState({ access: { visibility, expiration, customExpiresOn, allowDownload, allowClientSharing } });
  },

  /** Update Email Branding. */
  async updateEmailBranding(settings: EmailBranding) {
    await delay(SAVE_MS);
    setState({ email: settings });
  },
};
