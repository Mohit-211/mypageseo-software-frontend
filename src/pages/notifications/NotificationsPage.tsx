import { Link } from "react-router-dom";
import { Bell, BellRing, LayoutDashboard, MessageSquareHeart } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { pickNavLocationId, resolveAppLink } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/** Notifications aren't built yet: say so, and point to where the same signals already are. */
function NotificationsPage() {
  const workspace = useWorkspace();
  const navLocationId = pickNavLocationId({ activeLocationId: workspace.activeLocation?.id ?? null, locationIds: workspace.locations.map((location) => location.id) });
  return (
    <>
      <PageHeader icon={Bell} tone="settings" title="Notifications" description="Alerts about your rankings, reviews and posts, in one place." />
      <EmptyState
        variant="coming-soon"
        icon={BellRing}
        tone="settings"
        title="Notifications are on the way"
        description="Alerts for ranking drops, new reviews and posts waiting for approval aren't available yet. Until then, the dashboard's next steps show what needs your attention."
        action={
          <Button asChild>
            <Link to="/dashboard">
              <LayoutDashboard aria-hidden /> Open the dashboard
            </Link>
          </Button>
        }
        secondaryAction={
          workspace.locations.length > 0 ? (
            <Button asChild variant="outline">
              <Link to={resolveAppLink("/reputation", navLocationId)}>
                <MessageSquareHeart aria-hidden /> Check your reviews
              </Link>
            </Button>
          ) : undefined
        }
      />
    </>
  );
}

export default NotificationsPage;
