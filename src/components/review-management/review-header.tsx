import type { ReactNode } from "react";
import { format } from "date-fns";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { DateRangeSelect } from "@/components/ai-visibility/ai-visibility-header";
import { PageHeader } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LocationSummary } from "@/lib/mypageseo/workspace";
import type { DateRangeValue } from "@/lib/reviews/review-management";

export function ProfileSelect({
  locations,
  locationId,
  onChange,
}: {
  locations: LocationSummary[];
  locationId: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select value={locationId} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full bg-surface text-sm sm:w-64" aria-label="Business profile">
        <SelectValue placeholder="Select a profile" />
      </SelectTrigger>
      <SelectContent>
        {locations.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.businessName} · {l.area}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function formatSyncTime(iso: string) {
  return format(new Date(iso), "MMMM d, yyyy 'at' h:mm a");
}

/** "Last synced …" line with a Sync Now link, or live progress while syncing. */
export function SyncStatus({
  lastSyncedAt,
  syncing,
  syncedCount,
  onSync,
}: {
  lastSyncedAt: string | null;
  syncing: boolean;
  /** Set right after a sync completes. */
  syncedCount: number | null;
  onSync: () => void;
}) {
  if (syncing) {
    return (
      <p role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
        Syncing reviews…
      </p>
    );
  }
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {syncedCount !== null ? (
        <span className="inline-flex items-center gap-1 font-medium text-success">
          <CheckCircle2 className="size-3.5" aria-hidden />
          {syncedCount.toLocaleString()} reviews synced
        </span>
      ) : null}
      <span>{lastSyncedAt ? `Last synced: ${formatSyncTime(lastSyncedAt)}` : "Not synced yet"}</span>
      <span aria-hidden>·</span>
      <button type="button" onClick={onSync} className="font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none">
        Sync Now
      </button>
    </p>
  );
}

export function ReviewHeader({
  profileSelect,
  range,
  onRangeChange,
  syncStatus,
  actions,
}: {
  profileSelect: ReactNode;
  range: DateRangeValue;
  onRangeChange: (range: DateRangeValue) => void;
  syncStatus: ReactNode;
  actions: ReactNode;
}) {
  return (
    <PageHeader
      title="Review Management"
      description="Monitor, analyze and respond to your customer reviews from one place."
      meta={syncStatus}
      actions={
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          <div className="col-span-2 sm:col-auto">{profileSelect}</div>
          <DateRangeSelect value={range} onChange={onRangeChange} className="col-span-2 block w-full sm:col-auto sm:w-auto" />
          {actions}
        </div>
      }
    />
  );
}

export function SyncButton({ syncing, onSync, disabled }: { syncing: boolean; onSync: () => void; disabled?: boolean }) {
  return (
    <Button onClick={onSync} disabled={syncing || disabled} className="w-full sm:w-auto">
      {syncing ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      {syncing ? "Syncing…" : "Sync Reviews"}
    </Button>
  );
}
