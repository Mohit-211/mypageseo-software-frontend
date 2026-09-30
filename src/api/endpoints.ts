/**
 * Every backend path the frontend calls, in one place.
 *
 * Paths are relative to `API_BASE_URL`. Keep them here rather than inline in the
 * endpoint files so a backend route change is a one-line edit.
 */
export const ENDPOINTS = {
  auth: {
    signup: "auth/signup",
    login: "auth/login",
    logout: "auth/logout",
    /** Exchanges `{ refresh_token }` for a new token pair. Confirm path with the backend. */
    refresh: "auth/refresh-tokens",
    sendOtp: "auth/otp",
    verifyOtp: "auth/verify-otp",
    verifyEmail: "auth/verify-email",
    forgotPassword: "auth/forgot-password",
    resetPassword: "auth/reset-password",

  },
  profile: {
    get: "auth/me",
    update: "auth/me",
  },
  gbp: {
    get: "gbp",
    connectUrl: "gbp/connect/url",
    disconnect: "gbp/disconnect",
  },
  location: {
    countries: "countries",
    statesByCountry: (countryId: string) => `countries/states/${encodeURIComponent(countryId)}`,
    citiesByState: (stateId: string) => `countries/cities/${encodeURIComponent(stateId)}`,
  },
} as const;
