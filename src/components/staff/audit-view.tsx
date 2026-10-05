import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Download,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Phone,
  RotateCcw,
  Star,
  X,
  XCircle,
} from "lucide-react";
import {
  closeSalesAudit,
  downloadSalesAuditPdf,
  getSalesAudit,
  isApiError,
  type AuditChecklistItem,
  type AuditCompetitor,
  type SalesAudit,
} from "@/api";
import { GridMap, type GridMapPoint } from "@/components/ranking/rank-map";
import { MetricCard, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { ErrorState } from "@/components/layout/shared/feedback/states";
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
import { Button } from "@/components/ui/button";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { BUCKET_MARKER_CLASS } from "@/lib/rankings/format";
import { AUDIT_LEGEND, FAILURE_TEXT, WARNING_TEXT, auditErrorText, auditQueryKey, cellBucket, cellText, pct } from "@/lib/staff/audit-format";
import { cn } from "@/lib/utils";

const POLL_MS = 2500;

/** One audit: polls until done / failed, then shows the ranking and the quick score. */
export function AuditView({
  auditId,
  onClosed,
  onRetry,
}: {
  auditId: string;
  onClosed: () => void;
  /** Run the same business and keyword again (after a failure). */
  onRetry: (audit: SalesAudit) => void;
}) {
  const queryClient = useQueryClient();
  const audit = useQuery({
    queryKey: auditQueryKey(auditId),
    queryFn: ({ signal }) => getSalesAudit(auditId, signal),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "done" || status === "failed" || query.state.error ? false : POLL_MS;
    },
    retry: (count, error) => !(isApiError(error) && error.status === 404) && count < 2,
  });

  const close = useMutation({
    mutationFn: () => closeSalesAudit(auditId),
    onSuccess: () => {
      toast.success("Audit closed.");
      queryClient.removeQueries({ queryKey: auditQueryKey(auditId) });
      void queryClient.invalidateQueries({ queryKey: ["staff", "audits"] });
      onClosed();
    },
    onError: (error) => {
      // Already gone: treat as closed.
      if (isApiError(error) && error.reason === "audit_not_found") {
        void queryClient.invalidateQueries({ queryKey: ["staff", "audits"] });
        onClosed();
        return;
      }
      toast.error(auditErrorText(error));
    },
  });

  if (audit.isPending) {
    return (
      <Panel>
        <div className="flex items-center gap-3 py-10 text-sm text-muted-foreground" role="status">
          <LoaderCircle aria-hidden className="size-5 animate-spin" /> Loading the audit…
        </div>
      </Panel>
    );
  }
  if (audit.isError) {
    const gone = isApiError(audit.error) && audit.error.reason === "audit_not_found";
    return (
      <ErrorState
        title={gone ? "This audit is no longer available" : "The audit couldn't be loaded"}
        description={gone ? "It was closed, or it expired 24 hours after it started." : auditErrorText(audit.error)}
        {...(gone ? { onRetry: onClosed, retryLabel: "Start a new audit" } : { onRetry: () => void audit.refetch() })}
      />
    );
  }

  const data = audit.data;
  return (
    <div className="space-y-6">
      <AuditHeader audit={data} closing={close.isPending} onClose={() => close.mutate()} />
      {data.status === "queued" || data.status === "running" ? (
        <AuditProgress audit={data} />
      ) : data.status === "failed" ? (
        <Panel>
          <div className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <XCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-critical" />
              <div>
                <p className="font-medium text-foreground">The audit failed</p>
                <p className="mt-1 text-sm text-muted-foreground">{FAILURE_TEXT[data.failure_reason ?? ""] ?? FAILURE_TEXT.internal_error}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => onRetry(data)}>
              <RotateCcw aria-hidden /> Run again
            </Button>
          </div>
        </Panel>
      ) : data.result ? (
        <AuditResult audit={data} result={data.result} />
      ) : null}
    </div>
  );
}

function AuditHeader({ audit, closing, onClose }: { audit: SalesAudit; closing: boolean; onClose: () => void }) {
  const { business } = audit;
  const [downloading, setDownloading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await downloadSalesAuditPdf(audit.id);
      const url = URL.createObjectURL(blob);
      Object.assign(window.document.createElement("a"), { href: url, download: filename }).click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(isApiError(error) && error.reason === "audit_not_ready" ? "The PDF is available once the audit is done." : auditErrorText(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{business.name}</h1>
            {business.category ? <StatusBadge>{business.category}</StatusBadge> : null}
          </div>
          {business.address ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin aria-hidden className="size-3.5 shrink-0" /> {business.address}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {business.rating !== null ? (
              <span className="inline-flex items-center gap-1">
                <Star aria-hidden className="size-3.5 fill-warning text-warning" />
                <span className="font-medium text-foreground">{business.rating.toFixed(1)}</span>
                {business.user_rating_count !== null ? `(${business.user_rating_count.toLocaleString()} reviews)` : null}
              </span>
            ) : null}
            {business.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone aria-hidden className="size-3.5" /> {business.phone}
              </span>
            ) : null}
            {business.website ? (
              <a href={business.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Website <ExternalLink aria-hidden className="size-3" />
              </a>
            ) : null}
          </div>
          {audit.attribution ? <p className="mt-1 text-[11px] text-muted-foreground">{audit.attribution.text}</p> : null}
          <p className="mt-3 text-sm">
            Keyword <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{audit.keyword}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              Started {formatDateTime(audit.created_at)} · open until {formatDateTime(audit.expires_at)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button disabled={audit.status !== "done" || downloading} onClick={() => void download()}>
            {downloading ? <LoaderCircle aria-hidden className="animate-spin" /> : <Download aria-hidden />} Export PDF
          </Button>
          <Button variant="outline" disabled={closing} onClick={() => setConfirmClose(true)}>
            {closing ? <LoaderCircle aria-hidden className="animate-spin" /> : <X aria-hidden />} Close
          </Button>
        </div>
      </div>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this audit?</AlertDialogTitle>
            <AlertDialogDescription>
              The audit is deleted and can't be opened again. Export the PDF first if you want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it open</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>Close audit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

const STEPS = [
  "Placing a 7×7 grid within 5 km of the business",
  "Searching the keyword from all 49 points",
  "Finding who ranks higher and scoring the profiles",
];

function AuditProgress({ audit }: { audit: SalesAudit }) {
  const active = audit.status === "queued" ? 0 : 1;
  return (
    <Panel>
      <div className="py-6" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <LoaderCircle aria-hidden className="size-6 animate-spin text-primary" />
          <div>
            <p className="font-medium text-foreground">{audit.status === "queued" ? "Queued…" : "Running the audit…"}</p>
            <p className="text-sm text-muted-foreground">This usually takes 15–30 seconds. Started at {formatTime(audit.created_at)}.</p>
          </div>
        </div>
        <ol className="mt-5 space-y-2.5">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-2.5 text-sm">
              {index < active ? (
                <CheckCircle2 aria-hidden className="size-4 text-success" />
              ) : index === active ? (
                <LoaderCircle aria-hidden className="size-4 animate-spin text-primary" />
              ) : (
                <CircleDashed aria-hidden className="size-4 text-muted-foreground" />
              )}
              <span className={index > active ? "text-muted-foreground" : "text-foreground"}>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

function AuditResult({ audit, result }: { audit: SalesAudit; result: NonNullable<SalesAudit["result"]> }) {
  const { summary } = result;
  const center = { lat: audit.business.lat, lng: audit.business.lng };
  const points = useMemo<GridMapPoint[]>(
    () =>
      result.cells.map((cell) => ({
        key: `${cell.row}-${cell.col}`,
        lat: cell.lat,
        lng: cell.lng,
        text: cellText(cell),
        bucket: cellBucket(cell),
        title:
          cell.status === "error"
            ? "This point didn't answer"
            : cell.status === "not_found" || cell.rank === null
              ? "Not in the top 30 here"
              : `Rank ${cell.rank} here`,
      })),
    [result.cells],
  );
  const centerText = summary.center_status === "error" ? "–" : summary.center_rank === null ? "30+" : String(summary.center_rank);

  return (
    <>
      {audit.warnings.length > 0 ? (
        <div className="space-y-2">
          {audit.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2 rounded-md border border-warning/35 bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> {WARNING_TEXT[warning] ?? warning}
            </p>
          ))}
        </div>
      ) : null}

      <section aria-label="Ranking summary" className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
        <MetricCard label="Rank at the business" accent="brand" value={centerText} caption="Google Maps, at the business's address" />
        <MetricCard
          label="Average rank"
          accent="teal"
          value={summary.avg_rank === null ? "—" : summary.avg_rank.toFixed(1)}
          caption={`Across ${summary.points - summary.failed_points} points · 30+ counted as 31`}
        />
        <MetricCard label="Found in the top 30" accent="green" value={pct(summary.found_rate)} caption="Share of grid points" />
        <MetricCard label="Map pack (top 3)" accent="amber" value={pct(summary.top3_rate)} caption="Share of grid points in the top 3" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <Panel
          title="Ranking heatmap"
          description={`“${audit.keyword}” searched from ${audit.grid.size}×${audit.grid.size} points within ${audit.grid.radius_km} km, ${audit.grid.spacing_km.toFixed(1)} km apart`}
        >
          <GridMap points={points} center={center} className="h-[440px] w-full rounded-md" />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Legend">
            {AUDIT_LEGEND.map((item) => (
              <li key={item.bucket} className="flex items-center gap-1.5">
                <span aria-hidden className={cn("size-3 rounded-full border", BUCKET_MARKER_CLASS[item.bucket])} />
                {item.label}
              </li>
            ))}
          </ul>
        </Panel>
        <HigherList audit={audit} higher={result.higher} />
      </div>

      <QuickScore audit={audit} competitors={result.competitors} centerText={centerText} />
    </>
  );
}

function HigherList({ audit, higher }: { audit: SalesAudit; higher: NonNullable<SalesAudit["result"]>["higher"] }) {
  return (
    <Panel title="Who ranks higher" description="At the business's address, in Google Maps order">
      {higher === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Business names aren't available for this audit.</p>
      ) : higher.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nobody: {audit.business.name} is the top result here.</p>
      ) : (
        <>
          <ol className="-mx-4 -my-1 max-h-[440px] divide-y divide-border overflow-y-auto">
            {higher.map((row) => (
              <li key={`${row.rank}-${row.name}`} className={cn("flex items-start gap-3 px-4 py-2.5", row.is_self && "bg-accent/60")}>
                <span className="w-6 shrink-0 pt-0.5 text-right text-sm font-semibold tabular text-muted-foreground">{row.rank}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {row.name}
                    {row.is_self ? <span className="ml-2 text-xs font-normal text-primary">This business</span> : null}
                  </p>
                  {row.address ? <p className="truncate text-xs text-muted-foreground">{row.address}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          {audit.attribution ? <p className="mt-3 text-right text-[11px] text-muted-foreground">{audit.attribution.text}</p> : null}
        </>
      )}
    </Panel>
  );
}

const STATE_ICON: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  good: { icon: CheckCircle2, className: "text-success", label: "Good" },
  partial: { icon: AlertTriangle, className: "text-warning", label: "Partly done" },
  missing: { icon: XCircle, className: "text-critical", label: "Missing" },
};

function StateIcon({ item }: { item: AuditChecklistItem | undefined }) {
  if (!item) return <span className="text-muted-foreground">—</span>;
  const state = STATE_ICON[item.state];
  if (!state) return <span className="text-xs text-muted-foreground">{item.detail ?? "—"}</span>;
  const Icon = state.icon;
  return (
    <span className="inline-flex items-center gap-1.5" title={item.detail ?? state.label}>
      <Icon aria-hidden className={cn("size-4 shrink-0", state.className)} />
      <span className="text-xs text-muted-foreground">{item.detail ?? state.label}</span>
    </span>
  );
}

function gradeTone(score: number | null | undefined): "success" | "warning" | "critical" | "neutral" {
  if (score == null) return "neutral";
  return score >= 80 ? "success" : score >= 50 ? "warning" : "critical";
}

function QuickScore({ audit, competitors, centerText }: { audit: SalesAudit; competitors: AuditCompetitor[]; centerText: string }) {
  const { business } = audit;
  const columns = [
    {
      key: "self",
      name: business.name,
      isSelf: true,
      rank: centerText,
      score: business.score,
      rating: business.rating,
      reviews: business.user_rating_count,
      photos: business.photo_count,
      checklist: business.checklist,
    },
    ...competitors.map((competitor) => ({
      key: `${competitor.rank}-${competitor.name}`,
      name: competitor.name,
      isSelf: false,
      rank: String(competitor.rank),
      score: competitor.score,
      rating: competitor.facts?.rating ?? null,
      reviews: competitor.facts?.user_rating_count ?? null,
      photos: competitor.facts?.photo_count ?? null,
      checklist: competitor.checklist,
    })),
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
      <Panel title="Quick GBP score" description="From the public Google profile">
        <div className="flex items-center gap-4">
          <div className="grid size-20 shrink-0 place-items-center rounded-full border-4 border-primary/20">
            <span className="text-2xl font-semibold tabular text-foreground">{business.score?.score ?? "—"}</span>
          </div>
          <div>
            {business.score?.grade ? <StatusBadge tone={gradeTone(business.score.score)}>Grade {business.score.grade}</StatusBadge> : null}
            <p className="mt-1.5 text-sm text-muted-foreground">out of 100</p>
          </div>
        </div>
        <ul className="mt-5 divide-y divide-border">
          {business.checklist.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-foreground">{item.label}</span>
              <StateIcon item={item} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Compared with the top 3" description="The top 3 other businesses at its address">
        {competitors.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">The top 3 aren't available for this audit.</p>
        ) : (
          <div className="-m-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-surface-strong text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium" />
                  {columns.map((column) => (
                    <th key={column.key} scope="col" className={cn("px-3 py-2.5 align-bottom font-medium", column.isSelf && "bg-accent/60")}>
                      <span className={cn("line-clamp-2 text-foreground", column.isSelf && "text-primary")}>{column.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <ComparisonRow label="Rank at the address" values={columns.map((column) => ({ key: column.key, isSelf: column.isSelf, node: <span className="font-semibold tabular">{column.rank}</span> }))} />
                <ComparisonRow
                  label="Public score"
                  values={columns.map((column) => ({
                    key: column.key,
                    isSelf: column.isSelf,
                    node: column.score ? (
                      <StatusBadge tone={gradeTone(column.score.score)}>
                        {column.score.score ?? "—"}
                        {column.score.grade ? ` · ${column.score.grade}` : ""}
                      </StatusBadge>
                    ) : (
                      <span className="text-muted-foreground">Unavailable</span>
                    ),
                  }))}
                />
                <ComparisonRow
                  label="Rating"
                  values={columns.map((column) => ({
                    key: column.key,
                    isSelf: column.isSelf,
                    node:
                      column.rating === null ? (
                        "—"
                      ) : (
                        <span className="inline-flex items-center gap-1 tabular">
                          <Star aria-hidden className="size-3.5 fill-warning text-warning" /> {column.rating.toFixed(1)}
                        </span>
                      ),
                  }))}
                />
                <ComparisonRow label="Reviews" values={columns.map((column) => ({ key: column.key, isSelf: column.isSelf, node: <span className="tabular">{column.reviews?.toLocaleString() ?? "—"}</span> }))} />
                <ComparisonRow label="Photos" values={columns.map((column) => ({ key: column.key, isSelf: column.isSelf, node: <span className="tabular">{column.photos === null ? "—" : column.photos >= 10 ? "10+" : column.photos}</span> }))} />
                {business.checklist
                  .filter((item) => item.id !== "rating" && item.id !== "photos")
                  .map((item) => (
                    <ComparisonRow
                      key={item.id}
                      label={item.label}
                      values={columns.map((column) => ({
                        key: column.key,
                        isSelf: column.isSelf,
                        node: <StateIcon item={column.checklist?.find((entry) => entry.id === item.id)} />,
                      }))}
                    />
                  ))}
              </tbody>
            </table>
            {audit.attribution ? <p className="px-4 py-2 text-right text-[11px] text-muted-foreground">{audit.attribution.text}</p> : null}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ComparisonRow({ label, values }: { label: string; values: { key: string; isSelf: boolean; node: React.ReactNode }[] }) {
  return (
    <tr>
      <th scope="row" className="px-4 py-2.5 text-xs font-medium text-muted-foreground">{label}</th>
      {values.map((value) => (
        <td key={value.key} className={cn("px-3 py-2.5", value.isSelf && "bg-accent/60")}>{value.node}</td>
      ))}
    </tr>
  );
}
