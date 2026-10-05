import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LoaderCircle, Play } from "lucide-react";
import { listSalesAudits, startSalesAudit, type AuditPlaceSuggestion, type AuditStatus, type SalesAudit } from "@/api";
import { AuditView } from "@/components/staff/audit-view";
import { BusinessSearch } from "@/components/staff/business-search";
import { StaffGate, StaffShell } from "@/components/staff/staff-shell";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { AuthFormError } from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTime } from "@/lib/datetime";
import { auditErrorText, auditQueryKey } from "@/lib/staff/audit-format";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<AuditStatus, { tone: "neutral" | "info" | "success" | "critical"; label: string }> = {
  queued: { tone: "neutral", label: "Queued" },
  running: { tone: "info", label: "Running" },
  done: { tone: "success", label: "Done" },
  failed: { tone: "critical", label: "Failed" },
};

/** The staff dashboard: run a free audit for one business and keyword, show it, export it, close it. */
function StaffAuditsPage() {
  return <StaffGate>{(admin) => <StaffShell admin={admin}><AuditWorkspace /></StaffShell>}</StaffGate>;
}

function AuditWorkspace() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const auditId = params.get("audit");
  const select = (id: string | null) => setParams(id ? { audit: id } : {}, { replace: false });

  const audits = useQuery({
    queryKey: ["staff", "audits"],
    queryFn: ({ signal }) => listSalesAudits(signal),
    // Keep statuses in the list current while one is still running.
    refetchInterval: (query) => (query.state.data?.some((audit) => audit.status === "queued" || audit.status === "running") ? 5000 : false),
  });

  const started = (audit: SalesAudit) => {
    queryClient.setQueryData(auditQueryKey(audit.id), audit);
    void queryClient.invalidateQueries({ queryKey: ["staff", "audits"] });
    select(audit.id);
  };

  const retry = useMutation({
    mutationFn: (audit: SalesAudit) => startSalesAudit({ place_id: audit.business.place_id, keyword: audit.keyword }),
    onSuccess: started,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-6">
        <NewAuditForm onStarted={started} />
        <Panel title="Open audits" description="Closed automatically 24 hours after they start">
          {audits.isPending ? (
            <p className="py-4 text-sm text-muted-foreground">Loading…</p>
          ) : audits.isError ? (
            <p className="py-4 text-sm text-critical">{auditErrorText(audits.error)}</p>
          ) : audits.data.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No open audits.</p>
          ) : (
            <ul className="-mx-4 -my-1 divide-y divide-border">
              {audits.data.map((audit) => (
                <li key={audit.id}>
                  <button
                    type="button"
                    onClick={() => select(audit.id)}
                    aria-current={audit.id === auditId ? "true" : undefined}
                    className={cn("flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-muted/60", audit.id === auditId && "bg-accent/60")}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{audit.business.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {audit.keyword} · {formatTime(audit.created_at)}
                      </p>
                    </div>
                    <StatusBadge tone={STATUS_BADGE[audit.status].tone}>{STATUS_BADGE[audit.status].label}</StatusBadge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="min-w-0">
        {retry.isError ? <div className="mb-4"><AuthFormError message={auditErrorText(retry.error)} /></div> : null}
        {auditId ? (
          <AuditView key={auditId} auditId={auditId} onClosed={() => select(null)} onRetry={(audit) => retry.mutate(audit)} />
        ) : (
          <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-border bg-surface p-8 text-center">
            <div className="max-w-sm">
              <ClipboardList aria-hidden className="mx-auto size-10 text-muted-foreground/60" />
              <h1 className="mt-3 text-lg font-semibold text-foreground">Free local SEO audit</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Pick a business and a keyword. In about 30 seconds you get its Google Maps ranking heatmap within 5 km, who ranks higher, and a
                quick score of its profile against the top 3.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function newSession() {
  return crypto.randomUUID();
}

function NewAuditForm({ onStarted }: { onStarted: (audit: SalesAudit) => void }) {
  // One Autocomplete session per search box; the start call ends it, so a new one follows.
  const [session, setSession] = useState(newSession);
  const [place, setPlace] = useState<AuditPlaceSuggestion | null>(null);
  const [keyword, setKeyword] = useState("");
  const [keywordError, setKeywordError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () => startSalesAudit({ place_id: place!.place_id, session, keyword: keyword.trim() }),
    onSuccess: (audit) => {
      setSession(newSession());
      setPlace(null);
      setKeyword("");
      onStarted(audit);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = keyword.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setKeywordError("Enter a keyword of 2–80 characters.");
      return;
    }
    if (!place || start.isPending) return;
    start.mutate();
  };

  return (
    <Panel title="New audit" description="US and Canada · one business, one keyword">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label>Business</Label>
          <BusinessSearch session={session} value={place} onChange={setPlace} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-keyword">Keyword</Label>
          <Input
            id="audit-keyword"
            placeholder="e.g. plumber, dentist near me"
            value={keyword}
            maxLength={80}
            aria-invalid={Boolean(keywordError)}
            onChange={(event) => {
              setKeyword(event.target.value);
              setKeywordError(null);
            }}
          />
          {keywordError ? <p className="text-xs text-critical">{keywordError}</p> : null}
        </div>
        {start.isError ? <AuthFormError message={auditErrorText(start.error)} /> : null}
        <Button type="submit" className="w-full" disabled={!place || start.isPending}>
          {start.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />} Run audit
        </Button>
      </form>
    </Panel>
  );
}

export default StaffAuditsPage;
