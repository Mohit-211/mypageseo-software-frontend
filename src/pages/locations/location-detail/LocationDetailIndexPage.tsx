import { Link, generatePath } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, ArrowRight, Building2, FileBarChart, ListChecks, TrendingUp, Users } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { LocationHeader, LocationNavigation } from "@/components/location_component/location-workspace";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useRequiredParams } from "@/hooks/use-required-params";

const description =
  "Everything tracked for this location: rankings, Google Business Profile health, citations, competitors and reports.";



const modules: {
  label: string;
  to: string;
  icon: typeof TrendingUp;
  summary: string;
}[] = [
  {
    label: "Rankings",
    to: "/locations/:locationId/rankings",
    icon: TrendingUp,
    summary: "Keyword positions, keyword groups, map rankings and the local search grid.",
  },
  {
    label: "GBP",
    to: "/locations/:locationId/gbp",
    icon: Building2,
    summary: "Profile completeness, audit findings, reviews and posts.",
  },
  {
    label: "Citations",
    to: "/locations/:locationId/citations",
    icon: ListChecks,
    summary: "Directory listings, NAP consistency, duplicates and missing listings.",
  },
  {
    label: "Competitors",
    to: "/locations/:locationId/competitors",
    icon: Users,
    summary: "Local competitors tracked against this location.",
  },
  {
    label: "Reports",
    to: "/locations/:locationId/reports",
    icon: FileBarChart,
    summary: "Reports generated or scheduled for this location.",
  },
];

function LocationOverviewPage() {
  const { locationId } = useRequiredParams("locationId");
  const workspace = useWorkspace();
  const location = workspace.locations.find((item) => item.id === locationId) ?? null;

  useEffect(() => {
    if (location && workspace.activeLocation?.id !== location.id) {
      workspace.setActiveClientId(location.clientId ?? null);
      workspace.setActiveLocationId(location.id);
    }
  }, [location, workspace]);

  if (workspace.status === "loading") {
    return (
      <AppShell>
        <PageSkeleton />
      </AppShell>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <AppShell>
        <ErrorState
          description="We couldn't load this location workspace. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  if (!location) {
    return (
      <AppShell>
        <EmptyState
          title="Location not found"
          description="This location isn't available in the current workspace. Choose one from your locations list."
          action={
            <Button asChild variant="outline">
              <Link to="/locations">
                <ArrowLeft aria-hidden /> Back to locations
              </Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <LocationHeader location={location} />
      <LocationNavigation locationId={location.id} activeSection="overview" />
      <PageHeader title="Location Overview" description={description} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.label}
              to={generatePath(module.to, { locationId: location.id })}
              className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Icon className="size-4 text-brand-soft" aria-hidden />
                {module.label}
                <ArrowRight
                  className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
              <p className="mt-2 text-sm text-muted-foreground">{module.summary}</p>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

export default LocationOverviewPage;
