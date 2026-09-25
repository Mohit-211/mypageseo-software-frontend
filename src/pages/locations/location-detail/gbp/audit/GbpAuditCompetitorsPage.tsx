import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { GbpAuditCompetitorsContent } from "@/components/gbp-audit/gbp-audit-competitors";
import { PageHeader } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { getGbpAuditCompetitors, type GbpAuditCompetitorOrder, type GbpAuditCompetitorSort } from "@/lib/mypageseo/gbp-audit-competitors";
import { useRequiredParams } from "@/hooks/use-required-params";



function GbpAuditCompetitorsPage() {
  const { locationId } = useRequiredParams("locationId");
  const data = getGbpAuditCompetitors(locationId);
  const [sort, setSort] = useState<GbpAuditCompetitorSort>("local_pack_position");
  const [order, setOrder] = useState<GbpAuditCompetitorOrder>("asc");
  function handleSort(next: GbpAuditCompetitorSort) { if (next === sort) setOrder((current) => current === "asc" ? "desc" : "asc"); else { setSort(next); setOrder("asc"); } }
  return <><PageHeader title="GBP Audit Competitors" description="Compare this business with relevant local competitors to identify measurable GBP and local SEO gaps." actions={<Button asChild variant="outline" size="sm"><NavLink end to={`/locations/${locationId}/gbp/audit`}><ArrowLeft aria-hidden /> Back to GBP Audit</NavLink></Button>} meta={data.analyzedAt ? <p className="text-xs text-muted-foreground">Analysis completed {data.analyzedAt}</p> : undefined} /><GbpAuditCompetitorsContent data={data} locationId={locationId} sort={sort} order={order} onSort={handleSort} onContextChange={() => undefined} onRetry={() => window.location.reload()} /></>;
}

export default GbpAuditCompetitorsPage;
