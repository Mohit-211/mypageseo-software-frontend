import type React from "react";
import { createBrowserRouter, type LoaderFunction, type RouteObject } from "react-router-dom";
import { AppLayout } from "@/components/layout/shell/app-layout";
import { GuestOnly, RequireAuth } from "@/lib/auth/auth-guards";
import { PORTFOLIO_SECTIONS, locationPath } from "@/lib/mypageseo/section-links";
import { LocationReportsRedirect } from "@/pages/redirects/LocationReportsRedirect";
import { PortfolioRedirect } from "@/pages/redirects/PortfolioRedirect";
import { AppRoot, Redirecting, RootErrorBoundary, RootLoading, RootNotFound } from "./App";
import { PageErrorBoundary } from "./page-error-boundary";
import { guestOnlyLoader, indexLoader, locationLoader, toParams, toPath, unlessSearchOnly } from "./route-loaders";
import { APP_ROUTE_ID, registerRouter } from "./route-preload";

/** Pages load on first visit (each is its own chunk), so the first download stays small. */
const page = (module: { default: React.ComponentType }) => ({ Component: module.default });

/** An address that only forwards to another one, decided in its loader before anything renders. */
const redirectRoute = (path: string, loader: LoaderFunction): RouteObject => ({ path, loader, Component: Redirecting });

/**
 * Bookmarks, help articles and emails still use the portfolio addresses (`/rankings/tracker`,
 * `/gbp`, `/ai/posts`, …). Each opens that page for a location (the one picked last, else the
 * first), from inside the shell, since which one is only known once the workspace has loaded.
 */
const portfolioRoutes: RouteObject[] = [
  ...Object.keys(PORTFOLIO_SECTIONS).map((path) => ({ path: path.slice(1), Component: PortfolioRedirect })),
  { path: "gbp/ai-posts/*", Component: PortfolioRedirect },
];

/** Every page of one location, under `LocationLayout` (loads the location once, owns its not-found and error states). */
const locationPages: RouteObject[] = [
  { index: true, lazy: () => import("@/pages/locations/location-detail/LocationDetailIndexPage").then(page) },
  { path: "keywords", lazy: () => import("@/pages/keywords/KeywordsPage").then(page) },
  {
    path: "rankings",
    children: [
      { index: true, lazy: () => import("@/pages/locations/location-detail/rankings/RankingsIndexPage").then(page) },
      { path: "tracker", lazy: () => import("@/pages/locations/location-detail/rankings/RankingsTrackerPage").then(page) },
      { path: "map", lazy: () => import("@/pages/locations/location-detail/rankings/RankingsMapPage").then(page) },
      { path: "grid", lazy: () => import("@/pages/locations/location-detail/rankings/RankingsGridPage").then(page) },
      { path: "competitors", lazy: () => import("@/pages/locations/location-detail/rankings/RankingsCompetitorsPage").then(page) },
    ],
  },
  {
    path: "gbp",
    children: [
      { index: true, lazy: () => import("@/pages/locations/location-detail/gbp/GbpIndexPage").then(page) },
      { path: "posts", lazy: () => import("@/pages/locations/location-detail/gbp/GbpPostsPage").then(page) },
      {
        path: "audit",
        children: [
          { index: true, lazy: () => import("@/pages/locations/location-detail/gbp/audit/GbpAuditIndexPage").then(page) },
          { path: "competitors", lazy: () => import("@/pages/locations/location-detail/gbp/audit/GbpAuditCompetitorsPage").then(page) },
        ],
      },
    ],
  },
  {
    path: "reputation",
    children: [
      { index: true, lazy: () => import("@/pages/locations/location-detail/reputation/ReviewsPage").then(page) },
      { path: "insights", lazy: () => import("@/pages/locations/location-detail/reputation/InsightsPage").then(page) },
    ],
  },
  { path: "citations", lazy: () => import("@/pages/locations/location-detail/citations/CitationsIndexPage").then(page) },
  {
    path: "ai",
    children: [
      { index: true, lazy: () => import("@/pages/ai/AiStudioPage").then(page) },
      { path: "posts", lazy: () => import("@/pages/ai/AiPostsPage").then(page) },
      { path: "replies", lazy: () => import("@/pages/ai/AiRepliesPage").then(page) },
      // How the AI writes for this location, and the facts it may use (Phase 25a).
      { path: "settings", lazy: () => import("@/pages/ai/AiSettingsPage").then(page) },
    ],
  },
];

/** Older addresses under a location. Siblings of the location layout, so they never mount it. */
const legacyLocationRoutes: RouteObject[] = [
  redirectRoute(":locationId/rankings/keywords", toParams((p) => locationPath(p.locationId ?? "", "keywords"))),
  redirectRoute(":locationId/rankings/groups", toParams((p) => locationPath(p.locationId ?? "", "keywords", "#groups"))),
  redirectRoute(":locationId/gbp/reviews", toParams((p) => locationPath(p.locationId ?? "", "reputation"))),
  redirectRoute(":locationId/competitors", toParams((p) => locationPath(p.locationId ?? "", "competitors"))),
  redirectRoute(":locationId/competitors/:competitorId", toParams((p) => locationPath(p.locationId ?? "", "competitors"))),
  // White Label (agency staff) or Reports: depends on the role, so it waits for the workspace.
  { path: ":locationId/reports", Component: LocationReportsRedirect },
  redirectRoute(":locationId/reports/:reportId", toParams((p) => `/reports/${encodeURIComponent(p.reportId ?? "")}`)),
];

/** Signed-in pages, all drawn inside the persistent shell. */
const appPages: RouteObject[] = [
  { path: "dashboard", lazy: () => import("@/pages/dashboard/DashboardPage").then(page) },
  {
    path: "locations",
    lazy: () => import("@/pages/locations/LocationsLayout").then(page),
    children: [
      { index: true, lazy: () => import("@/pages/locations/LocationsIndexPage").then(page) },
      { path: "add", lazy: () => import("@/pages/locations/LocationsAddPage").then(page) },
      // The setup wizard has its own header and back link: no location layout.
      { path: ":locationId/setup", lazy: () => import("@/pages/locations/location-detail/LocationSetupPage").then(page) },
      ...legacyLocationRoutes,
      {
        path: ":locationId",
        lazy: () => import("@/pages/locations/location-detail/LocationLayout").then(page),
        loader: locationLoader,
        shouldRevalidate: unlessSearchOnly,
        children: locationPages,
      },
    ],
  },
  ...portfolioRoutes,
  // The organization-wide posts calendar (not a location page).
  { path: "gbp/posts", lazy: () => import("@/pages/gbp/GbpPostsPage").then(page) },
  { path: "ai-visibility", lazy: () => import("@/pages/ai-visibility/AiVisibilityPage").then(page) },
  redirectRoute("ai/visibility", toPath("/ai-visibility")),
  // White Label (agency owner and members) and Reports (everyone else) send each other's
  // audience to the right one, so both stay safe to link to.
  { path: "white-label", lazy: () => import("@/pages/white-label/WhiteLabelPage").then(page) },
  { path: "reports", lazy: () => import("@/pages/reports/ReportsIndexPage").then(page) },
  redirectRoute("reports/create", toPath("/reports?create=report")),
  redirectRoute("reports/scheduled", toPath("/reports#schedules")),
  redirectRoute("reports/client-links", toPath("/white-label#links")),
  { path: "reports/:reportId", lazy: () => import("@/pages/reports/ReportDetailPage").then(page) },
  { path: "clients", lazy: () => import("@/pages/clients/ClientsIndexPage").then(page) },
  {
    path: "clients/:clientId",
    lazy: () => import("@/pages/clients/client-detail/ClientLayout").then(page),
    children: [{ index: true, lazy: () => import("@/pages/clients/client-detail/ClientIndexPage").then(page) }],
  },
  // The client page shows its locations and users itself.
  redirectRoute("clients/:clientId/locations", toParams((p) => `/clients/${encodeURIComponent(p.clientId ?? "")}`)),
  redirectRoute("clients/:clientId/users", toParams((p) => `/clients/${encodeURIComponent(p.clientId ?? "")}`)),
  // Not in the sidebar (coming soon), kept for links.
  { path: "automations", lazy: () => import("@/pages/automations/AutomationsIndexPage").then(page) },
  { path: "automations/create", lazy: () => import("@/pages/automations/AutomationsCreatePage").then(page) },
  { path: "automations/:automationId", lazy: () => import("@/pages/automations/AutomationDetailPage").then(page) },
  {
    path: "settings",
    lazy: () => import("@/pages/settings/SettingsLayout").then(page),
    children: [
      { index: true, lazy: () => import("@/pages/settings/SettingsIndexPage").then(page) },
      { path: "profile", lazy: () => import("@/pages/settings/SettingsProfilePage").then(page) },
      // PayPal and billing emails return here (`?checkout=`, `?order=`): keep the address.
      { path: "billing", lazy: () => import("@/pages/settings/SettingsBillingPage").then(page) },
      { path: "team", lazy: () => import("@/pages/settings/SettingsTeamPage").then(page) },
      { path: "integrations", lazy: () => import("@/pages/settings/SettingsIntegrationsPage").then(page) },
      { path: "notifications", lazy: () => import("@/pages/settings/SettingsNotificationsPage").then(page) },
    ],
  },
  // Branding moved to White Label.
  redirectRoute("settings/white-label", toPath("/white-label#brand")),
  redirectRoute("settings/white-label/preview/:reportId?", toPath("/white-label#brand")),
  { path: "notifications", lazy: () => import("@/pages/notifications/NotificationsPage").then(page) },
  { path: "help", lazy: () => import("@/pages/help/HelpPage").then(page) },
  { path: "support", lazy: () => import("@/pages/support/SupportPage").then(page) },
  // Ticket emails link here.
  { path: "support/:ticketId", lazy: () => import("@/pages/support/SupportTicketPage").then(page) },
  { path: "403", lazy: () => import("@/pages/errors/ForbiddenPage").then(page) },
  { path: "404", lazy: () => import("@/pages/errors/NotFoundPage").then(page) },
];

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppRoot,
    ErrorBoundary: RootErrorBoundary,
    HydrateFallback: RootLoading,
    children: [
      // No landing page: a usable session goes to the app, anyone else to Sign in.
      { index: true, loader: indexLoader, Component: Redirecting },
      {
        // Signed-in pages: no usable session sends the user to /login.
        Component: RequireAuth,
        children: [
          // Full-screen signed-in flows, outside the app shell.
          { path: "onboarding", lazy: () => import("@/pages/onboarding/OnboardingIndexPage").then(page) },
          redirectRoute("onboarding/business", toPath("/onboarding")),
          redirectRoute("onboarding/agency", toPath("/onboarding")),
          // Google OAuth returns here after connecting a Business Profile.
          { path: "gbp/connect/callback", lazy: () => import("@/pages/gbp/GbpConnectCallbackPage").then(page) },
          {
            // The shell is drawn once and stays mounted between pages. It is also the first-load
            // fallback (same component), so the frame shows while the first page's code downloads.
            id: APP_ROUTE_ID,
            Component: AppLayout,
            HydrateFallback: AppLayout,
            children: [
              {
                // Page errors render inside the shell. (A boundary on the layout route itself
                // would replace the shell.)
                ErrorBoundary: PageErrorBoundary,
                children: appPages,
              },
            ],
          },
        ],
      },
      {
        // Sign in / Sign up. A signed-in visitor is sent on by the loader, before anything renders;
        // after signing in, the login page navigates itself.
        Component: GuestOnly,
        loader: guestOnlyLoader,
        children: [
          { path: "login", lazy: () => import("@/pages/auth/LoginPage").then(page) },
          { path: "signup", lazy: () => import("@/pages/auth/SignupPage").then(page) },
        ],
      },
      {
        // Staff dashboard (sales audit): its own sign-in with an admin session.
        path: "staff",
        children: [
          { index: true, loader: toPath("/staff/audits"), Component: Redirecting },
          { path: "login", lazy: () => import("@/pages/staff/StaffLoginPage").then(page) },
          { path: "audits", lazy: () => import("@/pages/staff/StaffAuditsPage").then(page) },
        ],
      },
      // Emailed links: open whether or not someone is signed in.
      { path: "forgot-password", lazy: () => import("@/pages/auth/ForgotPasswordPage").then(page) },
      { path: "reset-password", lazy: () => import("@/pages/auth/ResetPasswordPage").then(page) },
      { path: "verify-email", lazy: () => import("@/pages/auth/VerifyEmailPage").then(page) },
      { path: "invite", lazy: () => import("@/pages/auth/InvitePage").then(page) },
      { path: "*", Component: RootNotFound },
    ],
  },
]);

registerRouter(router);

export default router;
