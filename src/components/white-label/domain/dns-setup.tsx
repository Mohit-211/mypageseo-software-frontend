import { Check, Copy, Loader2, RotateCw, Trash2, X } from "lucide-react";
import { TableHead, TableRow, TableScroll, Th, tdClass } from "@/components/layout/shared/data-table";
import { Button } from "@/components/ui/button";
import type { CustomDomain, DomainStatus } from "@/lib/white-label/white-label";
import { cn } from "@/lib/utils";
import { copyText } from "../white-label-theme";
import { DomainStatusBadge } from "../white-label-ui";

type StepState = "done" | "current" | "failed" | "upcoming";

const STEPS = ["Add DNS record", "Verify domain", "SSL certificate", "Domain active"];

function stepStates(status: DomainStatus): StepState[] {
  switch (status) {
    case "pending_verification":
      return ["current", "upcoming", "upcoming", "upcoming"];
    case "failed":
      return ["done", "failed", "upcoming", "upcoming"];
    case "ssl_pending":
      return ["done", "done", "current", "upcoming"];
    case "connected":
      return ["done", "done", "done", "done"];
    default:
      return ["upcoming", "upcoming", "upcoming", "upcoming"];
  }
}

function SetupSteps({ status, checking }: { status: DomainStatus; checking: boolean }) {
  const states = stepStates(status);
  return (
    <ol className="grid gap-3 sm:grid-cols-4 sm:gap-2">
      {STEPS.map((label, i) => {
        const state = states[i]!;
        return (
          <li key={label} className="flex items-center gap-2.5 sm:flex-col sm:items-start sm:gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-primary bg-brand-tint text-primary",
                state === "failed" && "border-critical bg-critical-surface text-critical",
                state === "upcoming" && "border-border bg-background text-muted-foreground",
              )}
            >
              {state === "done" ? (
                <Check className="size-3.5" aria-hidden />
              ) : state === "failed" ? (
                <X className="size-3.5" aria-hidden />
              ) : state === "current" && checking ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                i + 1
              )}
            </span>
            <span className={cn("text-sm", state === "upcoming" ? "text-muted-foreground" : "font-medium text-foreground")}>
              {label}
              <span className="sr-only"> — {state}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Setup card shown after "Connect Domain": status, steps and the DNS records to add. No DNS is changed. */
export function DnsSetup({
  domain,
  checking,
  onVerify,
  onRemove,
}: {
  domain: CustomDomain;
  checking: boolean;
  onVerify: () => void;
  onRemove: () => void;
}) {
  const needsRecords = domain.status === "pending_verification" || domain.status === "failed";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Domain</p>
          <p className="truncate text-base font-semibold text-foreground">{domain.hostname}</p>
        </div>
        <DomainStatusBadge status={domain.status} />
      </div>

      <SetupSteps status={domain.status} checking={checking} />

      {needsRecords ? (
        <div>
          <p className="text-sm font-medium text-foreground">Add these records at your DNS provider</p>
          <p className="mt-0.5 text-xs text-muted-foreground">DNS changes can take up to 24 hours to propagate. Verify once the records are added.</p>
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            <TableScroll minWidth={560} label="DNS records to add">
              <TableHead>
                <Th>Type</Th>
                <Th>Host / Name</Th>
                <Th>Value</Th>
                <Th srOnly align="right">
                  Copy
                </Th>
              </TableHead>
              <tbody>
                {domain.records.map((record) => (
                  <TableRow key={record.type}>
                    <td className={`${tdClass} font-mono text-xs`}>{record.type}</td>
                    <td className={`${tdClass} font-mono text-xs`}>{record.host}</td>
                    <td className={`${tdClass} max-w-64 truncate font-mono text-xs`} title={record.value}>
                      {record.value}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Copy ${record.type} value`}
                        onClick={() => void copyText(record.value, `${record.type} value copied.`)}
                      >
                        <Copy aria-hidden />
                      </Button>
                    </td>
                  </TableRow>
                ))}
              </tbody>
            </TableScroll>
          </div>
        </div>
      ) : null}

      {domain.status !== "connected" ? (
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" className="text-critical hover:text-critical" onClick={onRemove} disabled={checking}>
            <Trash2 aria-hidden /> Remove domain
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {checking ? (
              <span role="status" className="text-center text-sm text-muted-foreground">
                Checking domain...
              </span>
            ) : null}
            <Button type="button" onClick={onVerify} disabled={checking}>
              {checking ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
              {domain.status === "ssl_pending" ? "Check SSL Status" : "Verify Domain"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
