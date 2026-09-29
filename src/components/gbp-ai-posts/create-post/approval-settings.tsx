import { Info, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ApprovalSettings({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-tint text-primary">
          <ShieldCheck className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Label htmlFor="post-require-approval" className="text-sm font-medium text-foreground">
            Require approval before publishing
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A teammate or client reviews AI content before it goes live on Google.
          </p>
        </div>
        <Switch id="post-require-approval" checked={value} onCheckedChange={onChange} />
      </div>
      {value ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-warning/35 bg-warning-surface px-3 py-2 text-xs text-warning-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          This post will be saved as <strong className="font-semibold">Pending Approval</strong> and won't publish until it's approved.
        </p>
      ) : null}
    </Panel>
  );
}
