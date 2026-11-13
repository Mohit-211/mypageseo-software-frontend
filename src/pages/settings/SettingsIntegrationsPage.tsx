import { Link } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";
import { GoogleAccountsPanel } from "@/components/gbp-connect/google-accounts-panel";
import { Panel } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";

/**
 * Integrations: the Google accounts behind your Business Profiles (Google Analytics and Search
 * Console are out of scope). Gated by the settings layout (`integrations.manage`).
 */
function SettingsIntegrationsPage() {
  return (
    <div className="space-y-6">
      <GoogleAccountsPanel />
      <Panel title="How the Google connection is used" icon={Info} tone="settings">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            MyPageSEO reads each connected profile's details, performance, reviews and posts, and publishes the replies and posts you approve. Rankings and citations
            work without it.
          </p>
          <p>Google Analytics and Search Console aren't part of MyPageSEO.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/locations">
              Go to Locations <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}

export default SettingsIntegrationsPage;
