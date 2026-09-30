import { CheckCircle2, CircleDashed, Clock3, Loader2, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/data-display";
import {
  DOMAIN_STATUS_LABEL,
  DOMAIN_STATUS_TONE,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  type DomainStatus,
  type ReportStatus,
  type ReportTheme,
} from "@/lib/white-label/white-label";
import { cn } from "@/lib/utils";

const DOMAIN_STATUS_ICON = {
  not_connected: CircleDashed,
  pending_verification: Clock3,
  connected: CheckCircle2,
  ssl_pending: Loader2,
  failed: XCircle,
} satisfies Record<DomainStatus, unknown>;

export function DomainStatusBadge({ status, className }: { status: DomainStatus; className?: string }) {
  const Icon = DOMAIN_STATUS_ICON[status];
  return (
    <StatusBadge tone={DOMAIN_STATUS_TONE[status]} {...(className ? { className } : {})}>
      <Icon className={cn("size-3", status === "ssl_pending" && "animate-spin [animation-duration:2.5s]")} aria-hidden />
      {DOMAIN_STATUS_LABEL[status]}
    </StatusBadge>
  );
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return <StatusBadge tone={REPORT_STATUS_TONE[status]}>{REPORT_STATUS_LABEL[status]}</StatusBadge>;
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0]?.slice(0, 2) ?? "A")).toUpperCase();
}

/** Agency logo, or a monogram in the brand colour when no logo is uploaded. */
export function AgencyMark({ theme, className, showName = false }: { theme: ReportTheme; className?: string; showName?: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {theme.logoUrl ? (
        <img src={theme.logoUrl} alt={`${theme.agencyName} logo`} className="h-9 w-auto max-w-40 shrink-0 object-contain" />
      ) : (
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-(--wl-radius) bg-(--wl-primary) text-sm font-semibold text-(--wl-primary-fg)"
        >
          {initials(theme.agencyName)}
        </span>
      )}
      {showName || !theme.logoUrl ? <span className="truncate text-sm font-semibold text-slate-900">{theme.agencyName}</span> : null}
    </span>
  );
}

/** Small neutral status row: icon + label + value. */
export function StatusLine({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: "done" | "pending" | "off";
}) {
  const Icon = state === "done" ? CheckCircle2 : state === "pending" ? Clock3 : CircleDashed;
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("flex items-center gap-1.5 text-sm font-medium", state === "off" ? "text-muted-foreground" : "text-foreground")}>
        <Icon className={cn("size-4", state === "done" ? "text-foreground/70" : "text-muted-foreground")} aria-hidden />
        {value}
      </dd>
    </div>
  );
}
