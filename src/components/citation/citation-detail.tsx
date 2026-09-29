import { useState } from "react";
import { AlertCircle, AlertTriangle, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { MetricCard, Panel, SectionHeader, StatusBadge, type StatusTone } from "@/components/layout/shared/data-display";
import { ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { CITATION_CAMPAIGN_LABEL, CITATION_STATE_LABEL, CitationDetailData, CitationNap, CitationState } from "@/lib/citations/citations";

const stateTone: Record<CitationState, StatusTone> = {
  correct: "success",
  inconsistent: "warning",
  missing: "critical",
  duplicate: "critical",
  pending: "info",
  unknown: "neutral",
};

const napFields = [
  { key: "name", label: "Business name" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
] as const;

export function CitationDetailLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading citation record">
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

export function CitationDetailContent({ data, onRetry }: { data: CitationDetailData; onRetry: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  if (data.status === "loading") return <CitationDetailLoading />;
  if (data.status === "error") {
    return (
      <ErrorState
        title="This citation record could not be loaded"
        description="We couldn't load the listing record for this directory. Try again without leaving the page."
        onRetry={onRetry}
      />
    );
  }

  const citation = data.citation;
  if (!citation) return null;

  const detected = citation.nap;
  const expected = data.expectedNap;
  const mismatched = (field: keyof CitationNap) =>
    expected !== null && expected[field] !== null && detected[field] !== null && expected[field] !== detected[field];

  const runCorrection = () => {
    setPending(true);
    setConfirming(false);
    toast.error("Citation correction could not be submitted", {
      description: "The directory submission service is not available in the current product integration.",
    });
    setPending(false);
  };

  return (
    <div className="space-y-6">
      <section aria-label="Citation status">
        <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
          <MetricCard
            accent="brand"
            label="Status"
            value={CITATION_STATE_LABEL[citation.state]}
            caption={citation.campaignState ? CITATION_CAMPAIGN_LABEL[citation.campaignState] : "No campaign state reported"}
          />
          <MetricCard
            accent="teal"
            label="Authority"
            value={citation.authority === null ? "—" : String(citation.authority)}
            caption={citation.authority === null ? "Metric unavailable" : "Directory strength"}
          />
          <MetricCard
            accent="amber"
            label="Discrepancies"
            value={String(citation.discrepancies.length)}
            caption={expected === null ? "Comparison unavailable" : "Fields differing from your record"}
          />
          <MetricCard
            accent="clay"
            label="Last checked"
            value={citation.lastChecked ?? "—"}
            caption={citation.lastChecked ? "Most recent verification" : "Never verified"}
          />
        </div>
      </section>

      <Panel title="Listing information" description="Values reported for this directory record">
        <dl className="grid gap-x-8 sm:grid-cols-2">
          <Field label="Directory" value={citation.directory} />
          <Field label="Directory type" value={citation.directoryType} />
          <Field label="Listing status" value={CITATION_STATE_LABEL[citation.state]} />
          <Field label="Category" value={data.category} />
          <Field label="Business name" value={detected.name} />
          <Field label="Phone" value={detected.phone} />
          <Field label="Address" value={detected.address} />
          <Field label="Website" value={detected.website} />
          <Field label="Listing URL" value={citation.listingUrl} />
          <Field label="Priority" value={citation.priority} />
        </dl>
      </Panel>

      <section aria-labelledby="nap-comparison">
        <SectionHeader title="NAP comparison" description="Your stored business information against the values detected on this directory" />
        {expected === null ? (
          <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground shadow-card">
            Consistency could not be evaluated: no expected business record was returned for comparison.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
            <div className="hidden grid-cols-[160px_1fr_1fr] gap-4 border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Field</span>
              <span>Expected</span>
              <span>Detected</span>
            </div>
            <ul className="divide-y divide-border">
              {napFields.map(({ key, label }) => {
                const differs = mismatched(key);
                return (
                  <li key={key} className={cn("grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr_1fr] sm:gap-4", differs && "bg-critical/5")}>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">{label}</span>
                    <span className="text-sm text-foreground">
                      <span className="mr-1 text-xs text-muted-foreground sm:hidden">Expected:</span>
                      {expected[key] ?? "Unavailable"}
                    </span>
                    <span className={cn("text-sm", differs ? "font-medium text-critical" : "text-foreground")}>
                      <span className="mr-1 text-xs text-muted-foreground sm:hidden">Detected:</span>
                      {detected[key] ?? "Unavailable"}
                      {differs ? <span className="ml-2 text-xs font-normal text-critical">Differs</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {citation.discrepancies.length > 0 || data.issues.length > 0 ? (
        <Panel title="Detected issues" description="Problems identified for this listing">
          <ul className="divide-y divide-border">
            {citation.discrepancies.map((item) => (
              <li key={`d-${item.field}`} className="flex items-start gap-3 py-3 first:pt-0">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-foreground">{item.field} does not match your record</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Detected {item.found ?? "no value"} — expected {item.expected ?? "no value"}.
                  </p>
                </div>
              </li>
            ))}
            {data.issues.map((issue) => {
              const Icon = issue.severity === "critical" ? AlertCircle : issue.severity === "warning" ? AlertTriangle : Info;
              return (
                <li key={issue.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", issue.severity === "critical" ? "text-critical" : issue.severity === "warning" ? "text-warning" : "text-info")} aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-foreground">{issue.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{issue.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {data.history && data.history.length > 0 ? (
        <Panel title="History" description="Recorded status changes for this listing">
          <ol className="space-y-3">
            {data.history.map((event) => (
              <li key={event.id} className="flex items-start gap-3">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{event.label}</p>
                    {event.state ? <StatusBadge tone={stateTone[event.state]}>{CITATION_STATE_LABEL[event.state]}</StatusBadge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.occurredAt}
                    {event.detail ? ` — ${event.detail}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}

      <Panel title="Actions" description="Operations available for this listing">
        <div className="flex flex-wrap gap-2">
          {citation.listingUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={citation.listingUrl} target="_blank" rel="noreferrer">
                Open listing <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          ) : null}
          {data.capabilities.canFixListing ? (
            <Button variant="accent" size="sm" disabled={pending} onClick={() => setConfirming(true)}>
              {pending ? "Submitting correction…" : "Submit correction"}
            </Button>
          ) : null}
          {data.capabilities.canRunCampaign ? <Button size="sm">Add to citation campaign</Button> : null}
        </div>
        {!data.capabilities.canFixListing && !data.capabilities.canRunCampaign && !citation.listingUrl ? (
          <p className="text-sm text-muted-foreground">
            No listing actions are available: correction and campaign submission are not part of the current product integration.
          </p>
        ) : null}
      </Panel>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit a correction for {citation.directory}?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends your stored business information to the directory. The listing may take time to update and the change cannot be withdrawn from Mypageseo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runCorrection}>Submit correction</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-b-0 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{value ?? "Unavailable"}</dd>
    </div>
  );
}
