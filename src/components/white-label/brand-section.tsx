import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useBlocker } from "react-router-dom";
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, ExternalLink, Lock, Palette, PenLine, RotateCcw, X } from "lucide-react";
import { deleteBrandingLogo, updateBranding, uploadBrandingLogo, type Branding } from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { ConfirmDialog, FormAlert, FormSaveBar, FormTextField, FormTextareaField } from "@/components/layout/shared/form-fields";
import { ErrorState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatTime } from "@/lib/datetime";
import {
  BRAND_LIMITS,
  brandFormErrors,
  brandSaveErrorText,
  logoErrorText,
  sameBrandForm,
  toBrandForm,
  toBrandingInput,
  toPreviewData,
  websiteHost,
  type BrandForm,
} from "@/lib/white-label/brand-form";
import { HEX, readLogoFile } from "@/lib/white-label/branding";
import { BRANDING_KEY } from "@/lib/white-label/client-links";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, brandContrast, type BrandContrast } from "@/lib/white-label/color";
import { useBrandLogoUrl } from "@/lib/white-label/use-brand-logo";
import { cn } from "@/lib/utils";
import { BrandPreview } from "./brand-preview";
import { ColorField, ContrastPill, LogoField } from "./branding-fields";

/**
 * ① Your brand: a summary of the saved brand with its live preview, or (owner) the inline editor
 * with a preview that follows every keystroke. Members see the brand read-only.
 */
export function BrandSection({
  branding,
  orgName,
  canEditBrand,
  featureMissing,
  editing,
  onEditingChange,
  sampleLinkUrl,
}: {
  branding: UseQueryResult<Branding>;
  orgName: string | null;
  canEditBrand: boolean;
  /** The plan doesn't include white label: the brand can't be changed. */
  featureMissing: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  sampleLinkUrl: string | null;
}) {
  const logoUrl = useBrandLogoUrl(branding.data);

  if (branding.isPending) return <SectionSkeleton lines={5} />;
  if (branding.isError) {
    return <ErrorState compact description="Your brand couldn't be loaded." onRetry={() => void branding.refetch()} />;
  }

  const canEdit = canEditBrand && !featureMissing;
  return (
    <div className="space-y-4">
      {featureMissing ? (
        <FormAlert tone="warning" title="White-label branding isn't in your plan">
          Your reports use MyPageSEO's look until it is.{" "}
          {canEditBrand ? (
            <Link to="/settings/billing" className="font-medium text-primary underline-offset-2 hover:underline">
              See plans in Billing
            </Link>
          ) : (
            "Ask the account owner about upgrading."
          )}
        </FormAlert>
      ) : null}
      {editing && canEdit ? (
        <BrandEditor
          branding={branding.data}
          orgName={orgName}
          logoUrl={logoUrl}
          sampleLinkUrl={sampleLinkUrl}
          onDone={() => onEditingChange(false)}
          onSaved={() => onEditingChange(true)}
        />
      ) : (
        <BrandSummary
          branding={branding.data}
          orgName={orgName}
          logoUrl={logoUrl}
          canEdit={canEdit}
          canEditBrand={canEditBrand}
          sampleLinkUrl={sampleLinkUrl}
          onEdit={() => onEditingChange(true)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                     */
/* -------------------------------------------------------------------------- */

function BrandSummary({
  branding,
  orgName,
  logoUrl,
  canEdit,
  canEditBrand,
  sampleLinkUrl,
  onEdit,
}: {
  branding: Branding;
  orgName: string | null;
  logoUrl: string | null;
  canEdit: boolean;
  canEditBrand: boolean;
  sampleLinkUrl: string | null;
  onEdit: () => void;
}) {
  const form = toBrandForm(branding);
  const preview = toPreviewData(form, branding.name ?? orgName);
  const contrast = brandContrast(form.primary_color, form.secondary_color);
  const saved = Boolean(branding.updated_at);
  const host = websiteHost(branding.website_url);
  const tips = brandTips(branding, contrast);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-start gap-4 border-b border-border p-4 sm:p-5">
          <div className="grid h-16 w-32 shrink-0 place-items-center overflow-hidden rounded-lg bg-card p-2 ring-1 ring-border">
            {logoUrl ? (
              <img src={logoUrl} alt={`${preview.name} logo`} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs font-medium text-muted-foreground">No logo yet</span>
            )}
          </div>
          <div className="min-w-0 flex-[1_1_14rem]">
            <p className="truncate text-lg font-semibold tracking-tight text-foreground">{preview.name}</p>
            {host ? (
              <a
                href={branding.website_url ?? undefined}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate rounded-sm text-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate">{host}</span> <ExternalLink aria-hidden className="size-3.5 shrink-0" />
              </a>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">No website yet</p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">{saved ? `Saved ${formatDate(branding.updated_at)}` : "Not set up yet: reports use MyPageSEO's colours."}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit ? (
              <Button onClick={onEdit} variant={saved ? "outline" : "default"}>
                <PenLine aria-hidden /> {saved ? "Edit brand" : "Set up brand"}
              </Button>
            ) : !canEditBrand ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                <Lock aria-hidden className="size-3.5" /> Only the account owner can change your brand
              </span>
            ) : null}
          </div>
        </div>

        <dl className="grid flex-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-5">
          <SummaryItem label="Colours">
            <div className="space-y-2">
              <Swatch label="Primary" hex={form.primary_color} pill={<ContrastPill level={contrast.primary.level} ratio={contrast.primary.ratio} what="White text on the primary colour" />} />
              <Swatch label="Secondary" hex={form.secondary_color} pill={<ContrastPill level={contrast.secondary.level} ratio={contrast.secondary.ratio} what="The secondary colour on white" />} />
            </div>
          </SummaryItem>
          <SummaryItem label="Report emails">
            <p className="truncate">
              From <span className="font-medium">“{preview.sender}”</span>
            </p>
            <p className="truncate text-muted-foreground">Reply-to {branding.email_reply_to ?? "not set"}</p>
          </SummaryItem>
          <SummaryItem label="Contact line">
            <p className={cn("line-clamp-2", !branding.contact_text && "text-muted-foreground")}>{branding.contact_text || "Not set"}</p>
          </SummaryItem>
          <SummaryItem label="Footer">
            <p className={cn("line-clamp-2", !branding.footer_text && "text-muted-foreground")}>{branding.footer_text || `Not set (PDFs show “${preview.name}”)`}</p>
          </SummaryItem>
          <SummaryItem label="MyPageSEO mention">
            {branding.hide_mypageseo ? (
              <StatusBadge tone="success" icon={Check}>
                Hidden on PDFs and emails
              </StatusBadge>
            ) : (
              <span className="text-muted-foreground">“Powered by MyPageSEO” on PDFs and emails</span>
            )}
          </SummaryItem>
        </dl>

        {tips.length > 0 && canEdit ? (
          <div className="border-t border-border bg-warning-surface/60 px-4 py-3 sm:px-5">
            <ul className="space-y-1">
              {tips.map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-sm text-warning-foreground">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <BrandPreview brand={preview} logoUrl={logoUrl} sampleLinkUrl={sampleLinkUrl} />
    </div>
  );
}

/** What would make the brand work better, in plain words (shown to the owner). */
function brandTips(branding: Branding, contrast: BrandContrast): string[] {
  const tips: string[] = [];
  if (!branding.logo) tips.push("Add your logo: it heads every client page, PDF and email.");
  if (!branding.website_url) tips.push("Add your website so clients can reach you from their page.");
  if (contrast.primary.level === "poor") tips.push("White text is hard to read on your primary colour. Pick a darker one for PDFs and emails.");
  if (contrast.secondary.level === "poor") tips.push("Your secondary colour is hard to read as text on white. Pick a darker one.");
  return tips;
}

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Swatch({ label, hex, pill }: { label: string; hex: string; pill: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span aria-hidden className="size-6 shrink-0 rounded-md shadow-xs ring-1 ring-border-strong" style={{ backgroundColor: hex }} />
      <span className="font-mono text-xs uppercase text-foreground">{hex}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      {pill}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                      */
/* -------------------------------------------------------------------------- */

function BrandEditor({
  branding,
  orgName,
  logoUrl,
  sampleLinkUrl,
  onDone,
  onSaved,
}: {
  branding: Branding;
  orgName: string | null;
  logoUrl: string | null;
  sampleLinkUrl: string | null;
  onDone: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const initial = toBrandForm(branding);
  const [form, setForm] = useState<BrandForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  const dirty = !sameBrandForm(form, initial);
  // A brand that was never saved can be saved as it is (the defaults), which completes step 1. Only
  // the save bar's Save button and status line use this: leaving a pristine editor never asks
  // "Leave without saving?", and Discard stays off (there is nothing to undo).
  const neverSaved = !branding.updated_at;
  const errors = brandFormErrors(form);
  const hasErrors = Object.keys(errors).length > 0;
  const shownErrors = showErrors ? errors : {};
  const fallbackName = orgName ?? branding.name;
  // While a hex value is half typed, the preview keeps the last saved colour instead of jumping.
  const shown = {
    ...form,
    primary_color: HEX.test(form.primary_color) ? form.primary_color : initial.primary_color,
    secondary_color: HEX.test(form.secondary_color) ? form.secondary_color : initial.secondary_color,
  };
  const preview = toPreviewData(shown, fallbackName);
  const contrast = brandContrast(shown.primary_color, shown.secondary_color);

  const set = <K extends keyof BrandForm>(key: K, value: BrandForm[K]) => {
    setSavedAt(null);
    setError(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  // Leaving the page (another page, not this one's sections) with unsaved changes asks first.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  // Set by "Leave": the dialog's own close must not reset the blocker then. For browser Back the router
  // replays the navigation a moment after proceed(); a reset in between would block that replay again.
  const leavingRef = useRef(false);
  useEffect(() => {
    if (blocker.state === "unblocked" || !dirty) leavingRef.current = false;
  }, [blocker.state, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    if (saving) return;
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await updateBranding(toBrandingInput(form));
      queryClient.setQueryData(BRANDING_KEY, next);
      // The onboarding checklist's "brand" step is done once any branding is saved.
      void queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      setForm(toBrandForm(next));
      setShowErrors(false);
      setSavedAt(formatTime(new Date()));
      onSaved();
      toast.success("Brand saved. New reports and every client link use it now.");
    } catch (err) {
      setError(brandSaveErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = (file: File) => {
    readLogoFile(file).then(
      (dataUrl) => {
        setLogoBusy(true);
        void uploadBrandingLogo(dataUrl)
          .then((next) => {
            queryClient.setQueryData(BRANDING_KEY, next);
            void queryClient.invalidateQueries({ queryKey: BRANDING_KEY });
            toast.success("Logo saved.");
          })
          .catch((err: unknown) => toast.error(logoErrorText(err, "The logo couldn't be saved. Try again.")))
          .finally(() => setLogoBusy(false));
      },
      (err: Error) => toast.error(err.message),
    );
  };

  const removeLogo = () => {
    setLogoBusy(true);
    void deleteBrandingLogo()
      .then(() => queryClient.invalidateQueries({ queryKey: BRANDING_KEY }))
      .then(() => toast.success("Logo removed."))
      .catch((err: unknown) => toast.error(logoErrorText(err, "The logo couldn't be removed. Try again.")))
      .finally(() => setLogoBusy(false));
  };

  const close = () => (dirty ? setConfirmClose(true) : onDone());

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 rounded-xl border border-primary/30 bg-card shadow-card ring-2 ring-primary/10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <Palette aria-hidden className="size-4 shrink-0 text-primary" />
              <p className="text-sm font-semibold text-foreground">Editing your brand</p>
            </div>
            <Button variant="ghost" size="sm" onClick={close}>
              <X aria-hidden /> {dirty ? "Close" : "Done"}
            </Button>
          </div>

          <FieldGroup title="Name and logo" description="On top of every client page, PDF and email.">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormTextField
                id="brand-name"
                label="Agency name"
                value={form.agency_name}
                onChange={(value) => set("agency_name", value)}
                placeholder={orgName ?? branding.name ?? "Your agency"}
                maxLength={BRAND_LIMITS.agency_name}
                error={shownErrors.agency_name}
                hint="Leave empty to use your organization's name."
              />
              <FormTextField
                id="brand-website"
                label="Website"
                type="url"
                inputMode="url"
                value={form.website_url}
                onChange={(value) => set("website_url", value)}
                placeholder="https://youragency.com"
                maxLength={BRAND_LIMITS.website_url}
                error={shownErrors.website_url}
                hint="Linked from the top of every client page."
              />
            </div>
            <LogoField label="Logo" url={logoUrl} busy={logoBusy} hasLogo={Boolean(branding.logo)} onFile={uploadLogo} onRemove={removeLogo} />
          </FieldGroup>

          <FieldGroup
            title="Colours"
            description="The primary colour fills the header of PDFs and emails (with white text) and your client page. The secondary colour names the business on PDFs."
            action={
              form.primary_color !== DEFAULT_PRIMARY || form.secondary_color !== DEFAULT_SECONDARY ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  onClick={() => {
                    set("primary_color", DEFAULT_PRIMARY);
                    set("secondary_color", DEFAULT_SECONDARY);
                  }}
                >
                  <RotateCcw aria-hidden /> Use the default colours
                </Button>
              ) : null
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField
                id="brand-primary"
                label="Primary colour"
                value={form.primary_color}
                onChange={(value) => set("primary_color", value)}
                error={shownErrors.primary_color}
                aside={<ContrastPill level={contrast.primary.level} ratio={contrast.primary.ratio} what="White text on the primary colour" />}
                hint={contrast.primary.level === "poor" ? "White text on it is hard to read on PDFs and emails." : "White text sits on it in PDFs and emails."}
              />
              <ColorField
                id="brand-secondary"
                label="Secondary colour"
                value={form.secondary_color}
                onChange={(value) => set("secondary_color", value)}
                error={shownErrors.secondary_color}
                aside={<ContrastPill level={contrast.secondary.level} ratio={contrast.secondary.ratio} what="The secondary colour on white" />}
                hint={contrast.secondary.level === "poor" ? "Hard to read as text on white. Try a darker shade." : "Printed as text on white, so darker reads better."}
              />
            </div>
          </FieldGroup>

          <FieldGroup title="Contact and footer" description="Your details on PDFs and emails, so clients know who to call.">
            <FormTextField
              id="brand-contact"
              label="Contact line"
              value={form.contact_text}
              onChange={(value) => set("contact_text", value)}
              placeholder="hello@youragency.com · (416) 555-0199"
              maxLength={BRAND_LIMITS.contact_text}
              error={shownErrors.contact_text}
              hint="Under your name in the PDF header."
            />
            <FormTextareaField
              id="brand-footer"
              label="Footer"
              rows={2}
              value={form.footer_text}
              onChange={(value) => set("footer_text", value)}
              placeholder={`${preview.name} · Toronto, ON`}
              maxLength={BRAND_LIMITS.footer_text}
              error={shownErrors.footer_text}
              hint="At the bottom of every PDF page and email. Empty shows your name."
            />
          </FieldGroup>

          <FieldGroup title="Report emails" description="How reports you email, once or every month, arrive in your client's inbox.">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormTextField
                id="brand-sender"
                label="Sender name"
                value={form.email_sender_name}
                onChange={(value) => set("email_sender_name", value)}
                placeholder={`${preview.name} via MyPageSEO`}
                maxLength={BRAND_LIMITS.email_sender_name}
                error={shownErrors.email_sender_name}
                hint="Empty uses your name with “via MyPageSEO”."
              />
              <FormTextField
                id="brand-reply"
                label="Reply-to address"
                type="email"
                inputMode="email"
                value={form.email_reply_to}
                onChange={(value) => set("email_reply_to", value)}
                placeholder="hello@youragency.com"
                maxLength={BRAND_LIMITS.email_reply_to}
                error={shownErrors.email_reply_to}
                optional
                hint="Where your client's replies go."
              />
            </div>
          </FieldGroup>

          <FieldGroup title="MyPageSEO mention" last>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-strong px-3.5 py-3">
              <div className="min-w-0">
                <label htmlFor="brand-hide" className="text-sm font-medium text-foreground">
                  Hide “Powered by MyPageSEO”
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">On PDF reports, share pages and report emails. Client links never show it.</p>
              </div>
              <Switch id="brand-hide" checked={form.hide_mypageseo} onCheckedChange={(value) => set("hide_mypageseo", value)} />
            </div>
          </FieldGroup>
        </div>

        <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">
          <BrandPreview brand={preview} logoUrl={logoUrl} sampleLinkUrl={sampleLinkUrl} subtitle="Updates as you type." />
        </div>
      </div>

      <FormSaveBar
        dirty={dirty}
        // A never-saved brand can be saved as it is, but there is nothing to discard and nothing "unsaved"
        // to warn about: the status line says what saving does instead.
        canSave={dirty || neverSaved}
        statusText={neverSaved ? "Your brand isn't saved yet. Save it to use it on reports and client links." : undefined}
        saving={saving}
        hasErrors={showErrors && hasErrors}
        savedAt={savedAt}
        error={error}
        onSave={() => void save()}
        onDiscard={() => {
          setForm(initial);
          setShowErrors(false);
          setError(null);
        }}
        savedLabel="Brand saved"
      />

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Discard your changes?"
        description="Your brand keeps its saved name, colours and details."
        confirmLabel="Discard changes"
        onConfirm={() => {
          setConfirmClose(false);
          setForm(initial);
          onDone();
        }}
      />
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && !leavingRef.current) blocker.reset?.();
        }}
        title="Leave without saving?"
        description="Your brand changes aren't saved yet."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => {
          leavingRef.current = true;
          blocker.proceed?.();
        }}
      />
    </div>
  );
}

function FieldGroup({
  title,
  description,
  action,
  last,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  last?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("min-w-0 space-y-4 px-4 py-5 sm:px-5", !last && "border-b border-border")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 id={id} className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          {description ? <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
