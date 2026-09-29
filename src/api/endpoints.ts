/**
 * Every backend path the frontend calls, in one place.
 *
 * Paths are relative to `API_BASE_URL`. Keep them here rather than inline in the
 * endpoint files so a backend route change is a one-line edit.
 */
export const ENDPOINTS = {
  auth: {
    signup: "user/auth/register",
    login: "user/auth/login",
    logout: "user/auth/logout",
    /** Exchanges `{ refresh_token }` for a new token pair. Confirm path with the backend. */
    refresh: "user/auth/refresh-tokens",
    sendOtp: "user/auth/otp",
    verifyOtp: "user/auth/verify-otp",
    forgotPassword: "user/auth/forgot-password",
  },
  profile: {
    get: "user/profile",
  },
  location: {
    countries: "countries",
    statesByCountry: (countryId: string) => `countries/states/${encodeURIComponent(countryId)}`,
    citiesByState: (stateId: string) => `countries/cities/${encodeURIComponent(stateId)}`,
  },
} as const;
