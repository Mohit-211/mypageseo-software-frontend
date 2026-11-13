import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, FilePlus2, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReportType } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { REPORT_RANGES, REPORT_TYPES, REPORT_TYPES_WITH_PERIOD, REPORT_TYPE_LABEL, type ReportRange } from "@/lib/reports/report-meta";
import { useGenerateReport } from "@/lib/reports/use-generate-report";
import { useWriteBlock } from "@/lib/white-label/write-block";
import { cn } from "@/lib/utils";
import { ReportActions } from "./report-actions";
import { ReportTypeIcon } from "./report-type-icon";

type Job = ReturnType<typeof useGenerateReport>;

/**
 * Create a PDF report without leaving the page: choose the location, the report and its period,
 * then watch it generate and download, share or email it right here.
 */
export function GenerateReportDialog({
  open,
  onOpenChange,
  locationId,
  clientId,
  lockLocation = false,
  defaultType = "rank_tracker",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The location to start with (else the one picked last, else the first). */
  locationId?: string | null | undefined;
  /** Offer only this client's locations. */
  clientId?: string | null | undefined;
  lockLocation?: boolean;
  defaultType?: ReportType;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Mounted per opening, so every opening starts at "choose". */}
        {open ? (
          <GenerateBody
            locationId={locationId}
            clientId={clientId}
            lockLocation={lockLocation}
            defaultType={defaultType}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function GenerateBody({
  locationId,
  clientId,
  lockLocation,
  defaultType,
  onClose,
}: {
  locationId?: string | null | undefined;
  clientId?: string | null | undefined;
  lockLocation: boolean;
  defaultType: ReportType;
  onClose: () => void;
}) {
  const workspace = useWorkspace();
  const block = useWriteBlock();
  const job = useGenerateReport();
  const choices = clientId ? workspace.locations.filter((entry) => entry.clientId === clientId) : workspace.locations;
  const [location, setLocation] = useState<string>(
    () =>
      (locationId && workspace.locations.some((entry) => entry.id === locationId) ? locationId : null) ??
      (workspace.activeLocation && choices.some((entry) => entry.id === workspace.activeLocation?.id) ? workspace.activeLocation.id : null) ??
      choices[0]?.id ??
      "",
  );
  const [type, setType] = useState<ReportType>(defaultType);
  const [range, setRange] = useState<ReportRange>("28d");
  const withPeriod = REPORT_TYPES_WITH_PERIOD.includes(type);
  const locationName = workspace.locations.find((entry) => entry.id === location)?.businessName ?? "this location";

  if (job.phase !== "idle") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{REPORT_TYPE_LABEL[type] ?? "Report"}</DialogTitle>
          <DialogDescription>{locationName}</DialogDescription>
        </DialogHeader>
        <ReportProgress job={job} typeLabel={REPORT_TYPE_LABEL[type] ?? "report"} onBack={job.reset} onClose={onClose} />
      </>
    );
  }

  // Grouped by client, A to Z, "No client" last (agencies); a flat list otherwise.
  const groups = groupByClient(choices, workspace.clients);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create a PDF report</DialogTitle>
        <DialogDescription>Made from the latest data in about a minute. You can download, share or email it right here.</DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        {lockLocation ? null : (
          <div className="space-y-1.5">
            <Label htmlFor="report-location">Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger id="report-location" className="w-full">
                <SelectValue placeholder="Choose a location" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {groups.map((group) =>
                  group.label ? (
                    <SelectGroup key={group.key}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.rows.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.businessName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : (
                    group.rows.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.businessName}
                      </SelectItem>
                    ))
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-foreground">Report</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REPORT_TYPES.map((entry) => {
              const checked = type === entry.value;
              return (
                <label
                  key={entry.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring",
                    checked ? "border-primary bg-brand-tint ring-1 ring-primary/25" : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  <input type="radio" name="report-type" value={entry.value} checked={checked} onChange={() => setType(entry.value)} className="sr-only" />
                  <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-lg", checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <ReportTypeIcon type={entry.value} className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{entry.label}</span>
                    <span className="block text-xs text-muted-foreground">{entry.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {withPeriod ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Period</p>
            <SegmentedControl size="sm" aria-label="Period" value={range} onValueChange={setRange} options={REPORT_RANGES} />
          </div>
        ) : null}
        {block.reason ? <p className="text-sm text-muted-foreground">{block.reason}</p> : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!location || block.blocked}
          onClick={() => void job.start({ location_id: location, type, ...(withPeriod ? { range } : {}) })}
        >
          <FilePlus2 aria-hidden /> Create report
        </Button>
      </DialogFooter>
    </>
  );
}

function groupByClient<T extends { businessName: string; clientId?: string }>(
  rows: T[],
  clients: { id: string; name: string }[],
): { key: string; label: string | null; rows: T[] }[] {
  if (clients.length === 0) return [{ key: "all", label: null, rows }];
  const byClient = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.clientId ?? "";
    byClient.set(key, [...(byClient.get(key) ?? []), row]);
  }
  const name = (id: string) => clients.find((client) => client.id === id)?.name ?? "Other client";
  return [...byClient.entries()]
    .map(([key, list]) => ({ key: key || "none", label: key ? name(key) : "No client", rows: list }))
    .sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : (a.label ?? "").localeCompare(b.label ?? "")));
}

/**
 * The life of one report in a dialog: generating (polled), then ready (download, share, email,
 * view) or failed. Shared by the create dialog and the report buttons on module pages.
 */
export function ReportProgress({
  job,
  typeLabel,
  onBack,
  onClose,
}: {
  job: Job;
  typeLabel: string;
  /** "Try again": back to choosing (the create dialog) or a new attempt (module pages). */
  onBack?: (() => void) | undefined;
  onClose: () => void;
}) {
  if (job.phase === "error") {
    return (
      <>
        <ProgressTile tone="critical" icon={AlertTriangle} title="The report wasn't created">
          {job.error}
        </ProgressTile>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onBack ? <Button onClick={onBack}>Try again</Button> : null}
        </DialogFooter>
      </>
    );
  }
  if (job.phase === "failed") {
    return (
      <>
        <ProgressTile tone="critical" icon={AlertTriangle} title="The report couldn't be generated">
          {job.report?.failure_reason ?? "Something went wrong while making the PDF."} Try again in a moment.
        </ProgressTile>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onBack ? <Button onClick={onBack}>Try again</Button> : null}
        </DialogFooter>
      </>
    );
  }
  if (job.phase === "ready" && job.reportId) {
    return (
      <>
        <ProgressTile tone="success" icon={CheckCircle2} title="Your report is ready">
          {job.report?.location?.name ? `${typeLabel} for ${job.report.location.name}. ` : ""}It's in your PDF reports too.
        </ProgressTile>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ReportActions reportId={job.reportId} showArchive={false} />
          <Button asChild variant="link" className="h-auto px-0">
            <Link to={`/reports/${encodeURIComponent(job.reportId)}`}>
              View report <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </>
    );
  }
  return (
    <>
      <ProgressTile tone="working" icon={LoaderCircle} title={`Generating the ${typeLabel}…`}>
        {job.existing ? "One was already on its way, so you're seeing its progress. " : ""}
        Usually under a minute. You can close this: it will appear in your PDF reports.
      </ProgressTile>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}

const TILE_TONE = {
  success: "border-success/25 bg-success-surface/60 [&_[data-tile-icon]]:bg-success [&_[data-tile-icon]]:text-success-foreground",
  critical: "border-critical/25 bg-critical-surface/60 [&_[data-tile-icon]]:bg-critical [&_[data-tile-icon]]:text-critical-foreground",
  working: "border-primary/20 bg-brand-tint/60 [&_[data-tile-icon]]:bg-primary [&_[data-tile-icon]]:text-primary-foreground",
} as const;

function ProgressTile({ tone, icon: Icon, title, children }: { tone: keyof typeof TILE_TONE; icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div role={tone === "critical" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-xl border p-4", TILE_TONE[tone])}>
      <span data-tile-icon aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full">
        <Icon className={cn("size-5", tone === "working" && "animate-spin motion-reduce:animate-none")} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
