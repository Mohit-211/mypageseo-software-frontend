import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Building2,
  FileText,
  ListChecks,
  MapPin,
  Search,
  Users,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, NotConnectedState } from "@/components/layout/shared/feedback/states";
import { ConnectGbpButton } from "@/components/gbp-audit/connect-gbp-button";

/**
 * Canonical empty states.
 *
 * One component per entity so wording, icon, spacing and action hierarchy stay
 * identical everywhere the same situation occurs. These describe genuinely
 * empty data — never a failure, and never a data source that is unavailable.
 */

export function NoLocationsEmpty({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={MapPin}
      title="No locations yet"
      description="Mypageseo tracks local search performance per Google Business Profile location. Add your first location to start collecting rankings, profile health and citation data."
      action={
        <Button asChild size="sm">
          <Link to="/locations/add">Add location</Link>
        </Button>
      }
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function NoKeywordsEmpty({ action, className }: { action?: ReactNode; className?: string }) {
  return (
    <EmptyState
      icon={ListChecks}
      title="No tracked keywords"
      description="This location has no keywords set up yet. Positions, movement and distribution appear once keywords are tracked and the first ranking collection completes."
      {...(action ? { action } : {})}
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function NoRankingDataEmpty({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={BarChart3}
      title="No ranking data for this period"
      description="Keywords are tracked for this location, but no positions have been collected for the selected period yet. Results appear after the next ranking collection."
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function GbpNotConnectedState({
  action,
  className,
}: {
  action?: ReactNode;
  className?: string;
}) {
  return (
    <NotConnectedState
      title="Google Business Profile not connected"
      description="Connect this location's Google Business Profile to see profile health, business information, reviews, photos and recommended actions."
      action={action ?? <ConnectGbpButton variant="outline" />}
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function NoCitationsEmpty({ action, className }: { action?: ReactNode; className?: string }) {
  return (
    <EmptyState
      icon={Building2}
      title="No citation data yet"
      description="This location hasn't been scanned for directory listings, so listing consistency, missing listings and duplicates can't be shown yet."
      {...(action ? { action } : {})}
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function NoCompetitorsEmpty({
  action,
  className,
}: {
  action?: ReactNode;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Users}
      title="No competitors tracked"
      description="No competitors have been added for this location and none have been discovered from local search results, so there is nothing to compare rankings, reviews and citations against yet."
      {...(action ? { action } : {})}
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function NoReportsEmpty({ canCreate = true, className }: { canCreate?: boolean; className?: string }) {
  return (
    <EmptyState
      icon={FileText}
      title="No reports yet"
      description="Reports package ranking, Google Business Profile, citation and competitor results into a shareable document for a chosen period."
      {...(canCreate
        ? {
            action: (
              <Button asChild size="sm">
                <Link to="/reports/create">Create report</Link>
              </Button>
            ),
          }
        : {})}
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function NoAutomationsEmpty({
  canCreate = true,
  className,
}: {
  canCreate?: boolean;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Workflow}
      title="No automations yet"
      description="Automations handle recurring work: ranking and review alerts, citation monitoring, scheduled profile posts and recurring report delivery."
      {...(canCreate
        ? {
            action: (
              <Button asChild size="sm">
                <Link to="/automations/create">Create automation</Link>
              </Button>
            ),
          }
        : {})}
      {...(className === undefined ? {} : { className })}
    />
  );
}

export function NoNotificationsEmpty({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={Bell}
      title="No notifications yet"
      description="Ranking movement, profile changes, new reviews, citation issues and automation results will appear here as they happen."
      {...(className === undefined ? {} : { className })}
    />
  );
}

/**
 * Filters or a search returned nothing. Distinct from an empty entity: the
 * data exists, the current query just doesn't match it.
 */
export function NoResultsEmpty({
  label = "results",
  onClear,
  className,
}: {
  /** Plural noun, e.g. "keywords", "clients". */
  label?: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      compact
      icon={Search}
      title={`No ${label} match these filters`}
      description="Adjust the search or filters to see more. Your data hasn't changed."
      {...(onClear
        ? {
            action: (
              <Button variant="outline" size="sm" onClick={onClear}>
                Clear filters
              </Button>
            ),
          }
        : {})}
      {...(className === undefined ? {} : { className })}
    />
  );
}
