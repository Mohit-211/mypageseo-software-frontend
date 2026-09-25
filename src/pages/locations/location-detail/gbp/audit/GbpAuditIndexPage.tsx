import { GbpAuditContent } from "@/components/gbp-audit/gbp-audit-main";
import { PageHeader } from "@/components/layout/shared/data-display";
import { getGbpAudit } from "@/lib/mypageseo/gbp-audit";
import { useRequiredParams } from "@/hooks/use-required-params";



function LocationGbpAuditPage() {
  const { locationId } = useRequiredParams("locationId");
  const data = getGbpAudit(locationId);
  return <><PageHeader title="GBP Audit" description="Evaluate this profile across important Google Business Profile and local SEO signals." meta={data.checkedAt ? <p className="text-xs text-muted-foreground">Last checked {data.checkedAt}</p> : undefined} /><GbpAuditContent data={data} onRetry={() => window.location.reload()} /></>;
}

export default LocationGbpAuditPage;
