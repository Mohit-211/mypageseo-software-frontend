import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/shared/data-display";
import { SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog, FormSaveBar, RequiredFieldsNote } from "@/components/layout/shared/form-fields";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { Button } from "@/components/ui/button";
import {
  EMPTY_BRANDING,
  validateBranding,
  whiteLabelActions,
  type AgencyBranding,
  type WhiteLabelSnapshot,
} from "@/lib/white-label/white-label";
import { AgencyBrandingPreview } from "./agency-branding-preview";
import { BrandColors } from "./brand-colors";
import { AgencyIdentityFields, StyleFields } from "./branding-form";
import { FaviconUploader, LogoUploader } from "./logo-uploader";
import { PlatformBrandingToggle } from "./platform-branding-toggle";

/**
 * Branding tab: form on the left, live device preview on the right (below on
 * tablet and mobile). The draft is compared against saved branding to track
 * unsaved changes.
 */
export function BrandingSettings({ snapshot }: { snapshot: WhiteLabelSnapshot }) {
  const baseline = snapshot.branding ?? EMPTY_BRANDING;
  const [draft, setDraft] = useState<AgencyBranding>(baseline);
  const [submitted, setSubmitted] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { pending: saving, run } = useSubmitGuard();

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline]);
  const errors = useMemo(() => (submitted ? validateBranding(draft) : {}), [draft, submitted]);
  const hasErrors = Object.keys(errors).length > 0;

  const update = <K extends keyof AgencyBranding>(key: K, value: AgencyBranding[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSavedAt(null);
  };

  const save = () => {
    setSubmitted(true);
    if (Object.keys(validateBranding(draft)).length > 0) return;
    void run(async () => {
      setDraft(await whiteLabelActions.updateBranding(draft));
      setSavedAt(format(new Date(), "h:mm a"));
      toast.success("Branding settings updated successfully.");
    });
  };

  const remove = async () => {
    setRemoving(true);
    await whiteLabelActions.removeBranding();
    setDraft(EMPTY_BRANDING);
    setSubmitted(false);
    setRemoving(false);
    setConfirmRemove(false);
    toast.success("Agency branding removed.", { description: "Client reports now use the neutral default theme." });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <div className="min-w-0 space-y-6">
        <Panel title="Agency Details" description="How your agency is named and contacted on client reports.">
          <div className="space-y-4">
            <RequiredFieldsNote />
            <AgencyIdentityFields branding={draft} errors={errors} onChange={update} />
          </div>
        </Panel>

        <Panel title="Logo & Favicon" description="Uploads stay in this browser until file storage is connected.">
          <div className="space-y-6">
            <LogoUploader
              value={draft.logoUrl}
              fileName={draft.logoFileName}
              disabled={saving}
              onChange={(image) => setDraft((d) => ({ ...d, logoUrl: image?.url ?? null, logoFileName: image?.fileName ?? null }))}
            />
            <FaviconUploader
              value={draft.faviconUrl}
              fileName={draft.faviconFileName}
              disabled={saving}
              onChange={(image) => setDraft((d) => ({ ...d, faviconUrl: image?.url ?? null, faviconFileName: image?.fileName ?? null }))}
            />
          </div>
        </Panel>

        <Panel title="Brand Colors" description="The preview updates as you change colours.">
          <BrandColors branding={draft} errors={errors} onChange={update} />
        </Panel>

        <Panel title="Style" description="Button shape and typography used in client reports.">
          <StyleFields branding={draft} onChange={update} />
        </Panel>

        <Panel title="White-Label Settings" description="Control which platform branding clients see.">
          <PlatformBrandingToggle checked={draft.hidePlatformBranding} onCheckedChange={(checked) => update("hidePlatformBranding", checked)} />
          {snapshot.branding ? (
            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Remove agency branding</p>
                <p className="text-xs text-muted-foreground">Client reports switch to a neutral theme without your logo and colours.</p>
              </div>
              <Button type="button" variant="outline" className="text-critical hover:text-critical" onClick={() => setConfirmRemove(true)}>
                <Trash2 aria-hidden /> Remove Branding
              </Button>
            </div>
          ) : null}
        </Panel>

        <FormSaveBar
          dirty={dirty}
          saving={saving}
          hasErrors={hasErrors}
          savedAt={savedAt}
          error={null}
          savedLabel="Branding saved"
          pendingLabel="Saving branding…"
          onSave={save}
          onDiscard={() => {
            setDraft(baseline);
            setSubmitted(false);
          }}
        />
      </div>

      <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        <AgencyBrandingPreview snapshot={snapshot} draft={draft} dirty={dirty} />
      </aside>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={(open) => !removing && setConfirmRemove(open)}
        title="Remove agency branding?"
        description="Your logo, colours and agency details will be removed from client-facing reports. Report links keep working."
        confirmLabel="Remove Branding"
        pending={removing}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

export function BrandingSettingsSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading branding settings" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <div className="space-y-6">
        <SectionSkeleton lines={4} />
        <SectionSkeleton lines={3} />
        <SectionSkeleton lines={2} />
      </div>
      <SectionSkeleton lines={8} />
    </div>
  );
}
