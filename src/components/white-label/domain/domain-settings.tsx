import { SectionHeader } from "@/components/layout/shared/data-display";
import { CUSTOM_DOMAIN_PLACEHOLDER, activeReportDomain, reportPath, type WhiteLabelSnapshot } from "@/lib/white-label/white-label";
import { pickPreviewReport } from "../client-report-preview/preview-model";
import { CustomDomain } from "./custom-domain";
import { DefaultDomain } from "./default-domain";
import { DomainStatusGuide, DomainStatusSkeleton } from "./domain-status";

export function DomainSettings({ snapshot }: { snapshot: WhiteLabelSnapshot }) {
  const { client } = pickPreviewReport(snapshot);
  const active = activeReportDomain(snapshot.domain);
  // The default-domain example always shows the shared-domain format.
  const exampleUrl = client
    ? reportPath({ ...snapshot.domain, customDomain: null }, snapshot.agencySlug, client)
    : `${snapshot.domain.defaultDomain}/${snapshot.agencySlug}/your-client`;

  return (
    <div className="space-y-4">
      <SectionHeader title="Client-Facing Domain" description="Choose how your clients access their branded reports." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <DefaultDomain domain={snapshot.domain} exampleUrl={exampleUrl} inUse={!active.custom} />
          <CustomDomain
            domain={snapshot.domain.customDomain}
            defaultDomain={snapshot.domain.defaultDomain}
            verifying={snapshot.verifyingDomain}
            placeholder={CUSTOM_DOMAIN_PLACEHOLDER}
          />
        </div>
        <DomainStatusGuide />
      </div>
    </div>
  );
}

export function DomainSettingsSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading domain settings" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        <DomainStatusSkeleton />
        <DomainStatusSkeleton />
      </div>
      <DomainStatusSkeleton />
    </div>
  );
}
