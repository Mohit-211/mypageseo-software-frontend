import { Link, generatePath } from "react-router-dom";
import { ChevronRight, Star } from "lucide-react";
import type { LocationSummary } from "@/lib/mypageseo/workspace";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";

export type LocationSection =
  | "overview"
  | "rankings"
  | "gbp"
  | "citations"
  | "competitors"
  | "reports";

const locationSections: { label: string; key: LocationSection; to: string }[] = [
  { label: "Overview", key: "overview", to: "/locations/:locationId" },
  { label: "Rankings", key: "rankings", to: "/locations/:locationId/rankings" },
  { label: "GBP", key: "gbp", to: "/locations/:locationId/gbp" },
  { label: "Citations", key: "citations", to: "/locations/:locationId/citations" },
  { label: "Competitors", key: "competitors", to: "/locations/:locationId/competitors" },
  { label: "Reports", key: "reports", to: "/locations/:locationId/reports" },
];

const gbpViews: { label: string; key: "overview" | "audit" | "reviews" | "posts"; to: string }[] = [
  { label: "Overview", key: "overview", to: "/locations/:locationId/gbp" },
  { label: "Audit", key: "audit", to: "/locations/:locationId/gbp/audit" },
  { label: "Reviews", key: "reviews", to: "/locations/:locationId/gbp/reviews" },
  { label: "Posts", key: "posts", to: "/locations/:locationId/gbp/posts" },
];

const rankingViews: { label: string; key: "overview" | "keywords" | "groups" | "map" | "grid" | "competitors"; to: string }[] = [
  { label: "Rank Tracker", key: "overview", to: "/locations/:locationId/rankings" },
  { label: "Keywords", key: "keywords", to: "/locations/:locationId/rankings/keywords" },
  { label: "Keyword Groups", key: "groups", to: "/locations/:locationId/rankings/groups" },
  { label: "Map Rankings", key: "map", to: "/locations/:locationId/rankings/map" },
  { label: "Local Search Grid", key: "grid", to: "/locations/:locationId/rankings/grid" },
  { label: "Competitors", key: "competitors", to: "/locations/:locationId/rankings/competitors" },
];

/** Breadcrumb trail: Locations (or Clients → client) → this location. */
function LocationBreadcrumb({ location }: { location: LocationSummary }) {
  const { organization, clients } = useWorkspace();
  const isAgency = organization?.accountType === "agency";
  const client = location.clientId ? clients.find((item) => item.id === location.clientId) ?? null : null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {isAgency && client ? (
        <>
          <Link to="/clients" className="hover:text-foreground hover:underline">
            Clients
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <Link
            to={`/clients/${client.id}`}
            className="truncate hover:text-foreground hover:underline"
          >
            {client.name}
          </Link>
          <ChevronRight className="size-3" aria-hidden />
          <Link
            to={`/clients/${client.id}/locations`}
            className="hover:text-foreground hover:underline"
          >
            Locations
          </Link>
        </>
      ) : (
        <Link to="/locations" className="hover:text-foreground hover:underline">
          Locations
        </Link>
      )}
      <ChevronRight className="size-3" aria-hidden />
      <span className="truncate font-medium text-foreground">{location.businessName}</span>
    </nav>
  );
}

export function LocationHeader({ location }: { location: LocationSummary }) {
  console.log(location,"location")
  return (
    <header className="flex flex-col gap-2 rounded-lg border border-border bg-brand-tint px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <LocationBreadcrumb location={location} />
        <h2 className="mt-1 text-xl font-semibold text-foreground md:text-2xl">{location.businessName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{location.area}</p>
      </div>
      {typeof location.rating === "number" ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Star className="size-4 fill-warning text-warning" aria-hidden />
          <span className="font-semibold tabular text-foreground">{location.rating.toFixed(1)}</span>
          {typeof location.reviewCount === "number" ? (
            <span className="tabular">{location.reviewCount.toLocaleString()} reviews</span>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

export function LocationNavigation({
  locationId,
  activeSection,
}: {
  locationId: string;
  activeSection: LocationSection;
}) {
  return (
    <nav aria-label="Location" className="overflow-x-auto border-b border-border">
      <ul className="flex min-w-max gap-6">
        {locationSections.map((section) => {
          const isActive = section.key === activeSection;
          return (
            <li key={section.key}>
              <Link
                to={generatePath(section.to, { locationId })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block border-b-2 px-0.5 py-3 text-sm font-semibold",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function GbpNavigation({
  locationId,
  activeView,
}: {
  locationId: string;
  activeView: "overview" | "audit" | "reviews" | "posts";
}) {
  return (
    <nav aria-label="GBP views" className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 rounded-md bg-brand-tint-strong/60 p-1">
        {gbpViews.map((view) => {
          const isActive = view.key === activeView;
          return (
            <li key={view.key}>
              <Link
                to={generatePath(view.to, { locationId })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block rounded px-3 py-1.5 text-xs font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function RankingsNavigation({
  locationId,
  activeView,
}: {
  locationId: string;
  activeView: "overview" | "keywords" | "groups" | "map" | "grid" | "competitors";
}) {
  return (
    <nav aria-label="Rankings views" className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 rounded-md bg-brand-tint-strong/60 p-1">
        {rankingViews.map((view) => {
          const isActive = view.key === activeView;
          return (
            <li key={view.key}>
              <Link
                to={generatePath(view.to, { locationId })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block rounded px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
