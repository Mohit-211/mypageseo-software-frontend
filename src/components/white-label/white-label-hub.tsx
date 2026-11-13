import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, Link2, Stamp, Users } from "lucide-react";
import { getBranding } from "@/api";
import { PageHeader } from "@/components/layout/shared/data-display";
import { LocationFilterChip } from "@/components/report/location-filter-chip";
import { ReportsSection } from "@/components/report/reports-section";
import { WriteBlockNote } from "@/components/report/write-block-note";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccess } from "@/hooks/use-access";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { usePageParams } from "@/lib/reports/page-params";
import { useReadyReportCount } from "@/lib/reports/use-report-counts";
import { useReportSchedules } from "@/lib/reports/use-report-schedules";
import { scrollToSection } from "@/lib/reports/scroll";
import { useWhiteLabelAccess } from "@/lib/white-label/access";
import { BRANDING_KEY } from "@/lib/white-label/client-links";
import { useBrandLogoUrl } from "@/lib/white-label/use-brand-logo";
import { isWhiteLabelFeatureMissing, mergeLocationsWithLinks, useAllWhiteLabelLinks, type ClientLinkRow } from "@/lib/white-label/use-client-links";
import { useWriteBlock } from "@/lib/white-label/write-block";
import { BrandSection } from "./brand-section";
import { ClientLinkSheet } from "./client-link-sheet";
import { ClientLinksSection } from "./client-links-section";
import { LocationPickerDialog } from "./location-picker-dialog";
import { SetupProgress } from "./setup-progress";
import { StepHeading } from "./step-heading";

/**
 * White Label (agency owners and members): everything clients see, from setup to the link, on one
 * page. ① the brand (`#brand`), ② a client link per location (`#links`, drawer `?link=`),
 * ③ PDF reports and monthly emails (`#reports`, `#schedules`). `?client=` / `?location=` narrow
 * the links and reports.
 */
export function WhiteLabelHub() {
  const access = useWhiteLabelAccess();
  const canBilling = useAccess().can("billing.view");
  const workspace = useWorkspace();
  const block = useWriteBlock();
  const [params, setParams] = usePageParams();
  const location = useLocation();
  const navigate = useNavigate();

  const branding = useQuery({ queryKey: BRANDING_KEY, queryFn: ({ signal }) => getBranding(signal) });
  const logoUrl = useBrandLogoUrl(branding.data);
  const links = useAllWhiteLabelLinks(true);
  const featureMissing = isWhiteLabelFeatureMissing(links.error);

  const allRows = useMemo(
    () => mergeLocationsWithLinks(workspace.locations, workspace.clients, links.data ?? []),
    [workspace.locations, workspace.clients, links.data],
  );
  // Page filters; values that match nothing in the workspace are ignored.
  const client = params.client ? (workspace.clients.find((entry) => entry.id === params.client) ?? null) : null;
  const locationRow = params.location ? (allRows.find((row) => row.id === params.location) ?? null) : null;
  const clientId = client?.id ?? null;
  const locationId = locationRow?.id ?? null;
  const rows = allRows.filter((row) => (!clientId || row.clientId === clientId) && (!locationId || row.id === locationId));
  const liveRows = rows.filter((row) => row.link);
  const visits = liveRows.reduce((sum, row) => sum + (row.link?.views ?? 0), 0);
  const withoutLink = rows.filter((row) => !row.link);
  // The newest live link, to open a real client page from the brand preview.
  const sampleLinkUrl = allRows.find((row) => row.link)?.link?.url ?? null;

  const readyReports = useReadyReportCount({ clientId, locationId });
  const schedules = useReportSchedules({ ...(clientId ? { client_id: clientId } : {}), ...(locationId ? { location_id: locationId } : {}) });
  const activeEmails = schedules.data?.filter((schedule) => schedule.status === "active").length;

  /* Brand editor: open on `?edit=brand`, and by default for an owner whose brand was never saved. */
  const [brandEditing, setBrandEditing] = useState<boolean | null>(null);
  const brandNeverSaved = Boolean(branding.data && !branding.data.updated_at);
  const editingBrand = brandEditing ?? (params.edit === "brand" || (access.canEditBrand && !featureMissing && brandNeverSaved));
  const setEditingBrand = (next: boolean) => {
    setBrandEditing(next);
    if (!next && params.edit) setParams({ edit: null });
  };

  /* Client link drawer (`?link=`). Opening pushes a history entry, so Back closes it. */
  const [closingKey, setClosingKey] = useState<string | null>(null);
  const toBrand = useRef(false);
  const drawerRow = params.link ? (allRows.find((row) => row.id === params.link) ?? null) : null;
  const drawerTarget = params.link
    ? drawerRow
      ? { id: drawerRow.id, name: drawerRow.name, area: drawerRow.area, clientName: drawerRow.clientName }
      : { id: params.link, name: "This location", area: "", clientName: null }
    : null;
  const drawerOpen = Boolean(params.link) && closingKey !== location.key;
  const openLink = (row: ClientLinkRow) => {
    setClosingKey(null);
    setParams({ link: row.id }, { push: true, state: { linkDrawer: true } });
  };
  const closeDrawer = () => setClosingKey(location.key);
  const afterDrawerClosed = (event: Event) => {
    // Only a close the reader asked for; not the drawer unmounting because they left the page.
    if (closingKey !== location.key) return;
    const goBrand = toBrand.current;
    toBrand.current = false;
    if (goBrand) event.preventDefault();
    if ((location.state as { linkDrawer?: boolean } | null)?.linkDrawer) void navigate(-1);
    else setParams({ link: null });
    if (goBrand) {
      window.setTimeout(() => {
        scrollToSection("brand");
        document.getElementById("brand-name")?.focus({ preventScroll: true });
      }, 80);
    }
  };
  const editBrandFromDrawer = () => {
    toBrand.current = true;
    if (access.canEditBrand && !featureMissing) setEditingBrand(true);
    closeDrawer();
  };

  /* New client link: straight to the drawer when the page is narrowed to a location without one. */
  const [pickerOpen, setPickerOpen] = useState(false);
  const newLink = () => {
    if (locationRow && !locationRow.link) openLink(locationRow);
    else setPickerOpen(true);
  };
  const newLinkReason =
    workspace.locations.length === 0
      ? "Add a location first."
      : block.reason
        ? block.reason
        : links.isPending
          ? "Loading your client links…"
          : links.isSuccess && withoutLink.length === 0
            ? "Every location here has a client link."
            : null;

  const setCreate = (kind: "report" | "schedule" | null) => setParams({ create: kind });
  const reportsDone = (readyReports.data ?? 0) > 0 || (activeEmails ?? 0) > 0;

  return (
    <>
      <PageHeader
        icon={Stamp}
        tone="brand"
        title="White Label"
        description="Your brand on everything your clients see: live client pages, PDF reports and monthly emails."
        meta={access.canEdit && block.blocked ? <WriteBlockNote block={block} what="New client links, reports and emails" /> : undefined}
        actions={
          access.canEdit ? (
            <>
              <span title={workspace.locations.length === 0 ? "Add a location first." : (block.reason ?? undefined)}>
                <Button variant="outline" disabled={workspace.locations.length === 0 || block.blocked} onClick={() => setCreate("report")}>
                  <FilePlus2 aria-hidden /> Create report
                </Button>
              </span>
              {featureMissing ? null : (
                <span title={newLinkReason ?? undefined}>
                  <Button disabled={newLinkReason !== null} onClick={newLink}>
                    <Link2 aria-hidden /> New client link
                  </Button>
                </span>
              )}
            </>
          ) : null
        }
      >
        {workspace.clients.length > 0 || locationRow ? (
          <>
            {workspace.clients.length > 0 ? (
              <Select value={clientId ?? "all"} onValueChange={(value) => setParams({ client: value === "all" ? null : value, location: null })}>
                <SelectTrigger className="w-full sm:w-64" aria-label="Show one client">
                  <div className="flex min-w-0 items-center gap-2">
                    <Users aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      <SelectValue />
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">All clients</SelectItem>
                  {workspace.clients.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {locationRow ? (
              <LocationFilterChip name={locationRow.name} onClear={() => setParams({ location: null })} />
            ) : null}
          </>
        ) : null}
      </PageHeader>

      <SetupProgress
        counts={{
          brand: { loading: branding.isPending, branding: branding.data, logoUrl },
          links: { loading: links.isPending, live: liveRows.length, locations: rows.length, visits },
          reports: { loading: readyReports.isPending || schedules.isPending, ready: readyReports.data, emails: activeEmails },
        }}
        canEditBrand={access.canEditBrand}
        canEdit={access.canEdit}
        featureMissing={featureMissing}
        onBrand={() => {
          if (brandNeverSaved && access.canEditBrand && !featureMissing) setEditingBrand(true);
          scrollToSection("brand");
        }}
        onLinks={() => {
          if (!featureMissing && liveRows.length === 0 && access.canEdit && newLinkReason === null) newLink();
          else scrollToSection("links");
        }}
        onReports={() => {
          if (!reportsDone && access.canEdit && !block.blocked && workspace.locations.length > 0) setCreate("report");
          else scrollToSection("reports");
        }}
      />

      <section id="brand" aria-label="Your brand" className="scroll-mt-20">
        <StepHeading
          step={1}
          title="Your brand"
          description="Used on client links, PDF reports, share pages and report emails. Reports already made keep the brand they were made with."
        />
        <BrandSection
          branding={branding}
          orgName={workspace.organization?.name ?? null}
          canEditBrand={access.canEditBrand}
          featureMissing={featureMissing}
          editing={editingBrand}
          onEditingChange={setEditingBrand}
          sampleLinkUrl={sampleLinkUrl}
        />
      </section>

      <section id="links" aria-label="Client links" className="scroll-mt-20">
        <StepHeading
          step={2}
          title="Client links"
          description="One live page per location with your brand and the reports you choose. It updates itself after every refresh, so you send it once."
        />
        <ClientLinksSection
          rows={rows}
          loading={links.isPending}
          error={links.isError && !featureMissing}
          featureMissing={featureMissing}
          hasLocations={workspace.locations.length > 0}
          canEdit={access.canEdit}
          canBilling={canBilling}
          blockedReason={block.reason}
          onRetry={() => void links.refetch()}
          onOpen={openLink}
        />
      </section>

      <ReportsSection
        step={3}
        clientId={clientId}
        locationId={locationId}
        createReportOpen={params.create === "report"}
        onCreateReportOpenChange={(open) => setCreate(open ? "report" : null)}
        createScheduleOpen={params.create === "schedule"}
        onCreateScheduleOpenChange={(open) => setCreate(open ? "schedule" : null)}
      />

      <ClientLinkSheet target={drawerTarget} open={drawerOpen} onClose={closeDrawer} onClosed={afterDrawerClosed} onEditBrand={editBrandFromDrawer} />
      <LocationPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        rows={rows}
        onPick={(row) => {
          setPickerOpen(false);
          openLink(row);
        }}
      />
    </>
  );
}
