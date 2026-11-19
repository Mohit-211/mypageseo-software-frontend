import { useId, useState } from "react";
import { toast } from "sonner";
import { LoaderCircle, RotateCw, ShieldCheck } from "lucide-react";
import type { PostSeries } from "@/api";
import { ConfirmDialog, FormAlert } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/hooks/use-access";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useViewerUserId } from "@/lib/posts/ai-runs";
import {
  autoConsentAsk,
  autoConsentDialog,
  autoConsentError,
  autoConsentGrantedText,
  autoConsentState,
  autoConsentText,
  autoConsentWithdrawCopy,
  useReloadSeries,
  useSetSeriesAutoConsent,
  type AutoConsentGrantMethod,
  type AutoConsentNames,
} from "@/lib/posts/series-consent";

type ConsentProps = {
  locationId: string;
  series: PostSeries;
  /** The location's name and its client (agency), for the consent text. */
  locationName: string;
  clientName?: string | null | undefined;
};

/**
 * An agency client's approval of a series' automatic publishing, on its card (Phase 25c). While the series publishes
 * on its own, automatic publishing is switched on and the approval is missing, it says so for who is looking
 * (`grant_method`): a client user of the location's client approves ("Approve automatic posts"), the agency owner
 * records the client's approval, a member reads who can. Once given, a quiet line says who gave it and when, with
 * "Withdraw" for whoever may (shown whatever the mode, so it can always be withdrawn). Nothing in a Business
 * organization.
 */
export function SeriesAutoConsent({ locationId, series, locationName, clientName }: ConsentProps) {
  const { organization } = useWorkspace();
  const access = useAccess();
  const me = useViewerUserId();
  const withdraw = useSetSeriesAutoConsent(locationId, series.series_id);
  const reload = useReloadSeries(locationId);
  const consent = series.auto_publish?.consent;
  const state = autoConsentState(series);
  const titleId = useId();
  const [dialog, setDialog] = useState<AutoConsentGrantMethod | null>(null);
  const [confirming, setConfirming] = useState(false);
  const names: AutoConsentNames = { agency: organization?.name, client: clientName, location: locationName, series: series.name };
  if (!consent || state === "none") return null;
  const method = consent.grant_method;

  if (state === "granted") {
    const confirm = autoConsentWithdrawCopy(names);
    const run = async () => {
      setConfirming(false);
      try {
        await withdraw.mutateAsync(false);
        toast.success("Approval withdrawn", { description: `Posts of “${series.name}” wait for review again.` });
      } catch (err) {
        const mapped = autoConsentError(err, false);
        if (mapped.kind === "not_required" || mapped.reload) reload();
        if (mapped.kind === "message") toast.error(mapped.message);
      }
    };
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface-strong px-3 py-2 text-sm text-foreground">
        <ShieldCheck aria-hidden className="size-4 shrink-0 text-success" />
        <span className="min-w-0 flex-1">{autoConsentGrantedText(consent, { userId: me, clientUser: access.role === "client_user" }, clientName)}</span>
        {method ? (
          <>
            <Button size="sm" variant="ghost" className="-my-1 text-critical hover:text-critical" disabled={withdraw.isPending} onClick={() => setConfirming(true)}>
              {withdraw.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
              {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
            </Button>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title={confirm.title}
              description={confirm.description}
              confirmLabel="Withdraw"
              cancelLabel="Keep it"
              onConfirm={() => void run()}
            />
          </>
        ) : null}
      </div>
    );
  }

  const copy = autoConsentAsk(method, names);
  return (
    <section aria-labelledby={titleId} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-warning/45 bg-warning-surface px-3 py-2.5">
      <ShieldCheck aria-hidden className="size-5 shrink-0 text-warning-foreground max-sm:hidden" />
      <div className="min-w-0 flex-[1_1_16rem]">
        <h4 id={titleId} className="text-sm font-semibold text-warning-foreground">
          {copy.title}
        </h4>
        <p className="text-sm text-foreground">{copy.body}</p>
      </div>
      {copy.action && method ? (
        <Button size="sm" className="shrink-0" onClick={() => setDialog(method)}>
          <ShieldCheck aria-hidden /> {copy.action}
        </Button>
      ) : null}
      {dialog ? <GrantDialog locationId={locationId} series={series} method={dialog} names={names} onClose={() => setDialog(null)} /> : null}
    </section>
  );
}

/** The consent (a client user) or the attestation (the owner), with the box to tick before it is recorded. */
function GrantDialog({
  locationId,
  series,
  method,
  names,
  onClose,
}: {
  locationId: string;
  series: PostSeries;
  method: AutoConsentGrantMethod;
  names: AutoConsentNames;
  onClose: () => void;
}) {
  const grant = useSetSeriesAutoConsent(locationId, series.series_id);
  const reload = useReloadSeries(locationId);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<{ message: string; reload: boolean } | null>(null);
  const checkboxId = useId();
  const copy = autoConsentDialog(method, names);
  const pending = grant.isPending;

  const submit = async () => {
    if (!agreed || pending) return;
    setError(null);
    try {
      await grant.mutateAsync(true);
      toast.success(copy.success, { description: copy.successDetail });
      onClose();
    } catch (err) {
      const mapped = autoConsentError(err, true);
      if (mapped.kind === "not_required") {
        reload();
        onClose();
        return;
      }
      setError({ message: mapped.message, reload: Boolean(mapped.reload) });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || pending ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {/* The exact text recorded with its version (`consent_version`). */}
          <blockquote className="rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">{autoConsentText(method, names)}</blockquote>
          <label htmlFor={checkboxId} className="-my-1 flex min-h-9 cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
            <Checkbox id={checkboxId} checked={agreed} disabled={pending} onCheckedChange={(value) => setAgreed(value === true)} />
            {copy.checkbox}
          </label>
          <p className="text-xs text-muted-foreground">{copy.note}</p>
          {error ? (
            <FormAlert tone="critical">
              <span>{error.message}</span>
              {error.reload ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 flex bg-card"
                  onClick={() => {
                    reload();
                    onClose();
                  }}
                >
                  <RotateCw aria-hidden /> Reload
                </Button>
              ) : null}
            </FormAlert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!agreed || pending} aria-busy={pending || undefined}>
              {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <ShieldCheck aria-hidden />}
              {pending ? copy.pending : copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
