import { useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { AiSettings } from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { FormAlert } from "@/components/layout/shared/form-fields";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/datetime";
import { settingsErrorText } from "@/lib/ai-settings/errors";
import { restrictedSuggestionText } from "@/lib/ai-settings/settings-form";
import { useUpdateAiSettings } from "@/lib/ai-settings/use-ai-settings";
import { DefaultTag } from "./settings-parts";

/**
 * ② "Restricted mode" (`#restricted`): replies that name no one, repeat nothing from the review, name
 * no service and use no keywords. It switches at once (no save bar):
 * - on: anyone who can edit (a member is asked first, since only the owner can switch it off again);
 * - off: only the owner (`restricted.can_switch_off`), after confirming that replies may name people and
 *   services (`{ restricted: false, attest: true }`). A member sees the switch locked while it is on.
 */
export function RestrictedModeSection({
  locationId,
  locationName,
  view,
  canEdit,
  isOwner,
}: {
  locationId: string;
  locationName: string;
  view: AiSettings;
  canEdit: boolean;
  /** The signed-in user is the account owner (asked before switching on only when not). */
  isOwner: boolean;
}) {
  const update = useUpdateAiSettings(locationId);
  const [asking, setAsking] = useState<"on" | "off" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const on = view.settings.restricted;
  const { restricted } = view;
  // A member (or a client user) can't switch it off; the backend says who can.
  const lockedOn = on && !restricted.can_switch_off;
  const disabled = !canEdit || lockedOn || update.isPending;

  const close = () => {
    if (update.isPending) return;
    setAsking(null);
    setConfirmed(false);
    setError(null);
  };

  const switchTo = (next: boolean) => {
    setError(null);
    update.mutate(next ? { restricted: true } : { restricted: false, attest: true }, {
      onSuccess: () => {
        setAsking(null);
        setConfirmed(false);
        toast.success(next ? "Restricted mode is on. New AI replies name no one." : "Restricted mode is off. New AI replies may name people and services.");
      },
      onError: (err) => {
        const text = settingsErrorText(err, next ? "Restricted mode couldn't be switched on. Try again." : "Restricted mode couldn't be switched off. Try again.");
        if (asking) setError(text);
        else toast.error(text);
      },
    });
  };

  const onCheckedChange = (next: boolean) => {
    if (next) {
      if (isOwner) switchTo(true);
      else setAsking("on");
    } else {
      setAsking("off");
    }
  };

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-foreground">
        Replies name no one, repeat nothing from the review, name no service and use no keywords. On by default for health, legal, financial, insurance and
        tax businesses.
      </p>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-strong px-3.5 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="ai-restricted" className="text-sm font-medium text-foreground">
              Restricted replies
            </label>
            <StatusBadge tone={on ? "info" : "neutral"} size="sm" icon={on ? ShieldCheck : undefined}>
              {on ? "On" : "Off"}
            </StatusBadge>
            {view.is_default.restricted ? <DefaultTag /> : null}
          </div>
          <p id="ai-restricted-help" className="mt-1 text-xs text-muted-foreground">
            {restrictedSuggestionText(restricted)}.
            {!on && restricted.attested_at ? ` Switched off by the owner on ${formatDate(restricted.attested_at)}.` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {update.isPending && !asking ? <Loader2 aria-label="Saving" className="size-4 animate-spin text-muted-foreground" /> : null}
          <Switch id="ai-restricted" checked={on} disabled={disabled} aria-describedby="ai-restricted-help" onCheckedChange={onCheckedChange} />
        </div>
      </div>

      {canEdit && lockedOn ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lock aria-hidden className="size-3.5 shrink-0" /> Only the account owner can switch restricted mode off.
        </p>
      ) : null}

      <AlertDialog open={asking !== null} onOpenChange={(open) => (open ? undefined : close())}>
        <AlertDialogContent>
          {asking === "off" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Switch restricted mode off?</AlertDialogTitle>
                <AlertDialogDescription>
                  New AI replies for {locationName} may then name the reviewer and your staff, mention your services and use your keywords. Health, legal,
                  financial, insurance and tax businesses usually keep it on.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-strong px-3.5 py-3">
                <Checkbox id="ai-restricted-attest" checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} className="mt-0.5" />
                <label htmlFor="ai-restricted-attest" className="cursor-pointer text-sm font-medium text-foreground">
                  I confirm replies for this business may name people and services
                </label>
              </div>
            </>
          ) : (
            <AlertDialogHeader>
              <AlertDialogTitle>Switch restricted mode on?</AlertDialogTitle>
              <AlertDialogDescription>
                New AI replies for {locationName} will name no one, repeat nothing from the review, name no service and use no keywords. Only the account
                owner can switch it off again.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          {error ? <FormAlert>{error}</FormAlert> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={update.isPending}>{asking === "off" ? "Keep it on" : "Cancel"}</AlertDialogCancel>
            <Button
              disabled={update.isPending || (asking === "off" && !confirmed)}
              aria-busy={update.isPending || undefined}
              onClick={() => switchTo(asking !== "off")}
            >
              {update.isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {asking === "off" ? "Switch it off" : "Switch it on"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
