/**
 * Every backend path the frontend calls, in one place.
 *
 * Paths are relative to `API_BASE_URL`. Keep them here rather than inline in the
 * endpoint files so a backend route change is a one-line edit.
 */
export const ENDPOINTS = {
  auth: {
    signup: "auth/signup",
    verifyEmail: "auth/verify-email",
    resendVerification: "auth/resend-verification",
    login: "auth/login",
    logout: "auth/logout",
    /** Exchanges `{ refresh_token }` for a new token pair; both tokens rotate. */
    refresh: "auth/refresh",
    forgotPassword: "auth/forgot-password",
    resetPassword: "auth/reset-password",
    changePassword: "auth/change-password",
    deactivate: "auth/deactivate",
    inspectInvitation: "auth/invitations/inspect",
    acceptInvitation: "auth/invitations/accept",
  },
  profile: {
    get: "auth/me",
    update: "auth/me",
  },
  gbp: {
    /** Redirect-flow fallback; the app uses the popup flow below. */
    connectUrl: "gbp/connect/url",
    connectPopup: "gbp/connect/popup",
    connectCode: "gbp/connect/code",
    connections: "gbp/connections",
    connectionLocations: (googleSub: string) => `gbp/connections/${encodeURIComponent(googleSub)}/locations`,
    connectionPicks: (googleSub: string) => `gbp/connections/${encodeURIComponent(googleSub)}/picks`,
    bindPick: (pickId: string) => `gbp/picks/${encodeURIComponent(pickId)}/bind`,
    pick: (pickId: string) => `gbp/picks/${encodeURIComponent(pickId)}`,
    unbind: "gbp/unbind",
    disconnect: "gbp/disconnect",
  },
  locations: {
    list: "locations",
    detail: (locationId: string) => `locations/${encodeURIComponent(locationId)}`,
    overview: (locationId: string) => `locations/${encodeURIComponent(locationId)}/overview`,
    center: (locationId: string) => `locations/${encodeURIComponent(locationId)}/center`,
    tracking: (locationId: string) => `locations/${encodeURIComponent(locationId)}/tracking`,
    trackingEstimate: (locationId: string) => `locations/${encodeURIComponent(locationId)}/tracking/estimate`,
    keywordGroups: (locationId: string) => `locations/${encodeURIComponent(locationId)}/keyword-groups`,
    keywordGroup: (locationId: string, groupId: string) =>
      `locations/${encodeURIComponent(locationId)}/keyword-groups/${encodeURIComponent(groupId)}`,
    keywordHistory: (locationId: string) => `locations/${encodeURIComponent(locationId)}/keyword-history`,
    competitorSuggestions: (locationId: string) =>
      `locations/${encodeURIComponent(locationId)}/competitor-suggestions`,
    rankRun: (locationId: string, runId: string) =>
      `locations/${encodeURIComponent(locationId)}/rank-runs/${encodeURIComponent(runId)}`,
    rankRuns: (locationId: string) => `locations/${encodeURIComponent(locationId)}/rank-runs`,
    rankTracker: (locationId: string) => `locations/${encodeURIComponent(locationId)}/rank-tracker`,
    grid: (locationId: string) => `locations/${encodeURIComponent(locationId)}/grid`,
    mapRanking: (locationId: string) => `locations/${encodeURIComponent(locationId)}/map-ranking`,
    refresh: (locationId: string) => `locations/${encodeURIComponent(locationId)}/refresh`,
  },
  reports: {
    list: "reports",
    create: "reports",
    detail: (reportId: string) => `reports/${encodeURIComponent(reportId)}`,
    pdf: (reportId: string) => `reports/${encodeURIComponent(reportId)}/pdf`,
    share: (reportId: string) => `reports/${encodeURIComponent(reportId)}/share`,
    email: (reportId: string) => `reports/${encodeURIComponent(reportId)}/email`,
  },
  places: {
    search: "places/search",
  },
  onboarding: {
    state: "onboarding/state",
    complete: "onboarding/complete",
  },
  clients: {
    list: "clients",
  },
  billing: {
    locationSlots: "billing/location-slots",
    sync: "billing/sync",
    captureOrder: (orderId: string) => `billing/orders/${encodeURIComponent(orderId)}/capture`,
  },
  location: {
    countries: "countries",
    statesByCountry: (countryId: string) => `countries/states/${encodeURIComponent(countryId)}`,
    citiesByState: (stateId: string) => `countries/cities/${encodeURIComponent(stateId)}`,
  },
} as const;
